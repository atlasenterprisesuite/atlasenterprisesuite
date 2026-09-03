import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createStaticServer } from '../server.mjs';

async function withServer(run) {
  const server = createStaticServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('serves the ATLAS shell at root and Site Review route', async () => {
  await withServer(async (baseUrl) => {
    for (const path of ['/', '/sites/review']) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.match(body, /ATLAS Site Review Center/i);
    }
  });
});

test('serves static assets and rejects unknown paths', async () => {
  await withServer(async (baseUrl) => {
    const css = await fetch(`${baseUrl}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const missing = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(missing.status, 404);
  });
});
