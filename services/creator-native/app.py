from __future__ import annotations

import hmac
import json
import os
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from native_composer import readiness, render_video

MAX_BODY_BYTES = 1_000_000


def bearer_authorized(header: str, expected_token: str) -> bool:
    if not expected_token:
        return False
    prefix = 'Bearer '
    if not header.startswith(prefix):
        return False
    return hmac.compare_digest(header[len(prefix):], expected_token)


def safe_asset_path(root: Path, name: str) -> Path:
    if not name or Path(name).name != name or name in {'.', '..'}:
        raise ValueError('invalid_asset_path')
    resolved_root = root.resolve()
    candidate = (resolved_root / name).resolve()
    if candidate.parent != resolved_root:
        raise ValueError('invalid_asset_path')
    return candidate


def _json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('content-type', 'application/json; charset=utf-8')
    handler.send_header('content-length', str(len(body)))
    handler.send_header('cache-control', 'no-store')
    handler.end_headers()
    handler.wfile.write(body)


class NativeComposerHandler(BaseHTTPRequestHandler):
    server_version = 'ATLASNativeComposer/1.0'

    @property
    def asset_root(self) -> Path:
        root = Path(os.environ.get('ATLAS_NATIVE_ASSET_DIR', '/var/lib/atlas-creator-native'))
        root.mkdir(parents=True, exist_ok=True)
        return root

    @property
    def token(self) -> str:
        return os.environ.get('ATLAS_NATIVE_COMPOSER_TOKEN', '')

    def _authorized(self) -> bool:
        return bearer_authorized(self.headers.get('authorization', ''), self.token)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == '/health':
            _json(self, 200, readiness())
            return
        if path.startswith('/assets/'):
            if not self._authorized():
                _json(self, 401, {'ok': False, 'error': 'authorization_required'})
                return
            name = path.removeprefix('/assets/')
            try:
                asset = safe_asset_path(self.asset_root, name)
            except ValueError:
                _json(self, 400, {'ok': False, 'error': 'invalid_asset_path'})
                return
            if not asset.exists() or not asset.is_file():
                _json(self, 404, {'ok': False, 'error': 'asset_not_found'})
                return
            data = asset.read_bytes()
            self.send_response(200)
            self.send_header('content-type', 'video/mp4')
            self.send_header('content-length', str(len(data)))
            self.send_header('cache-control', 'private, no-store')
            self.end_headers()
            self.wfile.write(data)
            return
        _json(self, 404, {'ok': False, 'error': 'not_found'})

    def do_POST(self) -> None:
        if urlparse(self.path).path != '/generate':
            _json(self, 404, {'ok': False, 'error': 'not_found'})
            return
        if not self._authorized():
            _json(self, 401, {'ok': False, 'error': 'authorization_required'})
            return
        try:
            length = int(self.headers.get('content-length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            _json(self, 413 if length > MAX_BODY_BYTES else 400, {'ok': False, 'error': 'invalid_body'})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
            if not isinstance(payload, dict):
                raise ValueError('invalid_json')
            job_id = str(uuid.uuid4())
            output_name = f'{job_id}.mp4'
            output = safe_asset_path(self.asset_root, output_name)
            result = render_video(payload, output)
            _json(self, 201, {
                **result,
                'jobId': job_id,
                'assetPath': f'/assets/{output_name}',
                'output': None,
            })
        except ValueError as exc:
            _json(self, 422, {'ok': False, 'error': str(exc)})
        except Exception:
            _json(self, 500, {'ok': False, 'error': 'render_failed'})

    def log_message(self, format: str, *args) -> None:
        print(f'[atlas-native] {self.address_string()} {format % args}')


def main() -> None:
    host = os.environ.get('ATLAS_NATIVE_HOST', '127.0.0.1')
    port = int(os.environ.get('ATLAS_NATIVE_PORT', '8789'))
    server = ThreadingHTTPServer((host, port), NativeComposerHandler)
    print(f'ATLAS Native Composer listening on {host}:{port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
