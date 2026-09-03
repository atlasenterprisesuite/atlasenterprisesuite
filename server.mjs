import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(HERE, 'src');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function safeTarget(rootDir, pathname) {
  const appRoute = pathname === '/' || pathname === '/sites/review' || pathname === '/sites/review/' ? '/index.html' : pathname;
  const decoded = decodeURIComponent(appRoute);
  const relative = decoded.replace(/^\/+/, '');
  const root = path.resolve(rootDir);
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

export function createStaticServer({ rootDir = DEFAULT_ROOT } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://atlas.local');
      const target = safeTarget(rootDir, requestUrl.pathname);
      if (!target) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
      }

      let info;
      try {
        info = await stat(target);
      } catch {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not Found');
        return;
      }

      if (!info.isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not Found');
        return;
      }

      const body = await readFile(target);
      const extension = path.extname(target).toLowerCase();
      response.writeHead(200, {
        'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'cache-control': extension === '.html' ? 'no-store' : 'public, max-age=300',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'same-origin'
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`Internal Server Error: ${error.message}`);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const server = createStaticServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`ATLAS Site Review Center listening on http://0.0.0.0:${port}`);
  });
}
