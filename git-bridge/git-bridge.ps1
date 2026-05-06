# GitCite localhost git bridge — PowerShell equivalent.
# DESIGN_SPEC §14.4. Same surface as git_bridge.py.
# Run from inside the git working tree:
#     pwsh ./git-bridge.ps1

$ErrorActionPreference = 'Stop'
$Port = 7117
$Workdir = (Get-Location).Path

function Test-OriginAllowed {
    param([string]$Origin)
    if (-not $Origin) { return $false }
    if ($Origin -eq 'null') { return $true }
    try {
        $u = [System.Uri]$Origin
        return ($u.Host -eq 'localhost' -or $u.Host -eq '127.0.0.1')
    } catch { return $false }
}

function Send-CorsResponse {
    param($Context, [int]$Status, [string]$Body, [string]$Origin, [string]$ContentType = 'application/json')
    $r = $Context.Response
    $r.StatusCode = $Status
    $r.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    $r.Headers['Access-Control-Allow-Headers'] = 'content-type'
    $r.Headers['Vary'] = 'Origin'
    if (Test-OriginAllowed $Origin) {
        $r.Headers['Access-Control-Allow-Origin'] = $Origin
    }
    $r.ContentType = $ContentType
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $r.OutputStream.Write($bytes, 0, $bytes.Length)
    $r.OutputStream.Close()
}

function Run-Git {
    param([Parameter(ValueFromRemainingArguments=$true)] $Args)
    $out = & git @Args 2>&1
    if ($LASTEXITCODE -ne 0) { throw "git $Args failed: $out" }
    return ($out -join "`n").Trim()
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Listening on localhost:$Port — working directory: $Workdir"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $origin = $request.Headers['Origin']

        if ($request.HttpMethod -eq 'OPTIONS') {
            Send-CorsResponse $context 204 '' $origin
            continue
        }
        if (-not (Test-OriginAllowed $origin)) {
            Send-CorsResponse $context 403 '{"error":"forbidden"}' $origin
            continue
        }

        if ($request.HttpMethod -eq 'GET' -and $request.Url.AbsolutePath -eq '/status') {
            try {
                $branch = Run-Git rev-parse --abbrev-ref HEAD
                $porcelain = Run-Git status --porcelain
                $dirty = -not [string]::IsNullOrWhiteSpace($porcelain)
                $payload = @{ workdir = $Workdir; branch = $branch; dirty = $dirty } | ConvertTo-Json -Compress
                Send-CorsResponse $context 200 $payload $origin
            } catch {
                Send-CorsResponse $context 500 (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress) $origin
            }
            continue
        }

        if ($request.HttpMethod -eq 'POST' -and $request.Url.AbsolutePath -eq '/commit') {
            try {
                $reader = [System.IO.StreamReader]::new($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                $path = $body.path
                $content = $body.content
                $message = if ($body.message) { $body.message } else { 'GitCite save' }
                $branch = $body.branch
                if (-not $path) { throw 'missing path' }
                $target = Join-Path $Workdir $path
                $resolved = [System.IO.Path]::GetFullPath($target)
                if (-not $resolved.StartsWith($Workdir)) { throw 'path outside workdir' }
                New-Item -Path (Split-Path $resolved) -ItemType Directory -Force | Out-Null
                Set-Content -Path $resolved -Value $content -Encoding UTF8
                Run-Git add $path | Out-Null
                Run-Git commit -m $message | Out-Null
                if ($branch) { Run-Git push origin "HEAD:$branch" | Out-Null }
                else { Run-Git push | Out-Null }
                $sha = Run-Git rev-parse HEAD
                Send-CorsResponse $context 200 (@{ sha = $sha; pushed = $true } | ConvertTo-Json -Compress) $origin
            } catch {
                Send-CorsResponse $context 500 (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress) $origin
            }
            continue
        }

        Send-CorsResponse $context 404 '{"error":"not found"}' $origin
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
