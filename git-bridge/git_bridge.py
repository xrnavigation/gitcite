#!/usr/bin/env python3
"""
GitCite localhost git bridge — DESIGN_SPEC §14.4.

Standard library only. Listens on localhost:7117. Two endpoints:

  GET /status   → { workdir, branch, dirty }
  POST /commit  → { sha, pushed: true }
                  body: { path, content, message, branch }

CORS allow-list: http://localhost:* and file://. Refuses every other origin.
Run from inside the git working tree:

    python3 git_bridge.py
"""

from __future__ import annotations

import http.server
import json
import os
import socketserver
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

PORT = 7117
WORKDIR = Path(os.getcwd()).resolve()


def run_git(*args: str) -> str:
    return subprocess.check_output(("git", *args), cwd=WORKDIR, text=True).strip()


def origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if origin == "null":  # file://
        return True
    parsed = urlparse(origin)
    return parsed.hostname in ("localhost", "127.0.0.1")


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "gitcite-bridge/1.0"

    def _cors(self, status: int, body: bytes, content_type: str = "application/json") -> None:
        origin = self.headers.get("Origin", "")
        self.send_response(status)
        if origin_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._cors(204, b"")

    def do_GET(self) -> None:  # noqa: N802
        if not origin_allowed(self.headers.get("Origin")):
            return self._cors(403, b'{"error":"forbidden"}')
        if self.path != "/status":
            return self._cors(404, b'{"error":"not found"}')
        try:
            branch = run_git("rev-parse", "--abbrev-ref", "HEAD")
            dirty = bool(run_git("status", "--porcelain"))
        except subprocess.CalledProcessError as e:
            return self._cors(500, json.dumps({"error": str(e)}).encode())
        body = json.dumps({"workdir": str(WORKDIR), "branch": branch, "dirty": dirty}).encode()
        self._cors(200, body)

    def do_POST(self) -> None:  # noqa: N802
        if not origin_allowed(self.headers.get("Origin")):
            return self._cors(403, b'{"error":"forbidden"}')
        if self.path != "/commit":
            return self._cors(404, b'{"error":"not found"}')
        length = int(self.headers.get("Content-Length", "0"))
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return self._cors(400, b'{"error":"bad request"}')
        path = data.get("path")
        content = data.get("content", "")
        message = data.get("message", "GitCite save")
        branch = data.get("branch")
        if not path or not isinstance(path, str):
            return self._cors(400, b'{"error":"missing path"}')
        target = (WORKDIR / path).resolve()
        if not str(target).startswith(str(WORKDIR)):
            return self._cors(400, b'{"error":"path outside workdir"}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        try:
            run_git("add", str(target.relative_to(WORKDIR)))
            run_git("commit", "-m", message)
            if branch:
                run_git("push", "origin", f"HEAD:{branch}")
            else:
                run_git("push")
            sha = run_git("rev-parse", "HEAD")
        except subprocess.CalledProcessError as e:
            return self._cors(500, json.dumps({"error": str(e)}).encode())
        self._cors(200, json.dumps({"sha": sha, "pushed": True}).encode())

    def log_message(self, fmt: str, *args) -> None:  # silence default logging
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args))


def main() -> None:
    print(f"Listening on localhost:{PORT} — working directory: {WORKDIR}")
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.")


if __name__ == "__main__":
    main()
