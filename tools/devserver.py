"""Local preview server with caching disabled, so edits show up on every reload.

    python3 tools/devserver.py 8766          # this Mac only
    python3 tools/devserver.py 8770 --lan    # also reachable from the iPad on the same Wi-Fi
"""
import http.server
import sys


PRIVATE = ('.', 'tools', '__pycache__')   # .env (API key), .venv, .cache, .git


class NoCache(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        parts = self.path.split('?')[0].split('/')
        if any(p.startswith(PRIVATE) for p in parts if p):
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
host = '0.0.0.0' if '--lan' in sys.argv else '127.0.0.1'
http.server.ThreadingHTTPServer((host, port), NoCache).serve_forever()
