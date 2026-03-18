import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const DIST_DIR = resolve(process.cwd(), 'dist-web');
const DEFAULT_HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.PORT || '8081');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function parseArgs(argv) {
  let host = DEFAULT_HOST;
  let port = DEFAULT_PORT;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--host' && next) {
      host = next;
      index += 1;
      continue;
    }

    if (current === '--port' && next) {
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --port value: ${next}`);
      }
      port = parsed;
      index += 1;
    }
  }

  return { host, port };
}

function getContentType(filePath) {
  return MIME_TYPES[extname(filePath)] || 'application/octet-stream';
}

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent((urlPath || '/').split('?')[0]);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^[/\\]/, '');
  const resolved = resolve(join(DIST_DIR, candidate));

  if (!resolved.startsWith(DIST_DIR)) {
    return null;
  }

  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    const nestedIndex = resolve(join(resolved, 'index.html'));
    if (nestedIndex.startsWith(DIST_DIR) && existsSync(nestedIndex)) {
      return nestedIndex;
    }
  }

  if (existsSync(resolved)) {
    return resolved;
  }

  const fallback = resolve(join(DIST_DIR, 'index.html'));
  return existsSync(fallback) ? fallback : null;
}

if (!existsSync(DIST_DIR)) {
  throw new Error(`dist-web was not found at ${DIST_DIR}. Run "npm run build:web" first.`);
}

const { host, port } = parseArgs(process.argv.slice(2));

const server = createServer((request, response) => {
  try {
    const filePath = resolveRequestPath(request.url || '/');

    if (!filePath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found.');
      return;
    }

    response.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-cache',
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`Hosting dist-web at http://${host}:${port}`);
});
