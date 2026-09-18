import tls from 'node:tls';
import { createHash, randomBytes } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function makeFrame(opcode, payload = Buffer.alloc(0)) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const mask = randomBytes(4);
  let header;
  if (data.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | data.length;
  } else if (data.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  const masked = Buffer.alloc(data.length);
  for (let index = 0; index < data.length; index += 1) masked[index] = data[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

function parseFrames(buffer, handlers) {
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;
    if (!fin) throw new Error('fragmented_websocket_frames_not_supported');
    if (masked) throw new Error('server_websocket_frame_must_not_be_masked');
    if (length === 126) {
      if (buffer.length - offset < 4) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (buffer.length - offset < 10) break;
      const value = buffer.readBigUInt64BE(offset + 2);
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('websocket_frame_too_large');
      length = Number(value);
      headerLength = 10;
    }
    if (buffer.length - offset < headerLength + length) break;
    const payload = buffer.subarray(offset + headerLength, offset + headerLength + length);
    offset += headerLength + length;

    if (opcode === 0x1) handlers.text(payload.toString('utf8'));
    else if (opcode === 0x8) handlers.close(payload);
    else if (opcode === 0x9) handlers.ping(payload);
    else if (opcode === 0xa) handlers.pong();
  }
  return buffer.subarray(offset);
}

export async function connectMtlsWebSocket({
  url,
  certificate,
  privateKey,
  headers = {},
  onMessage = () => {},
  onClose = () => {}
}) {
  const target = new URL(url);
  if (target.protocol !== 'wss:') throw new Error('realtime_url_must_be_wss');
  const port = Number(target.port || 443);
  const socket = tls.connect({
    host: target.hostname,
    port,
    servername: target.hostname,
    cert: certificate,
    key: privateKey,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('realtime_tls_timeout')), 15_000);
    socket.once('secureConnect', () => { clearTimeout(timer); resolve(); });
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
  });

  const websocketKey = randomBytes(16).toString('base64');
  const expectedAccept = createHash('sha1').update(websocketKey + GUID).digest('base64');
  const path = `${target.pathname || '/'}${target.search || ''}`;
  const headerLines = [
    `GET ${path} HTTP/1.1`,
    `Host: ${target.host}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${websocketKey}`,
    'Sec-WebSocket-Version: 13',
    'User-Agent: ATLAS-Local-Agent/1.0',
    ...Object.entries(headers).map(([name, value]) => `${name}: ${String(value)}`),
    '',
    ''
  ];
  socket.write(headerLines.join('\r\n'));

  let receiveBuffer = Buffer.alloc(0);
  let upgraded = false;
  let closed = false;
  let resolveUpgrade;
  let rejectUpgrade;
  const upgradePromise = new Promise((resolve, reject) => { resolveUpgrade = resolve; rejectUpgrade = reject; });
  const upgradeTimer = setTimeout(() => rejectUpgrade(new Error('realtime_upgrade_timeout')), 15_000);

  function fail(error) {
    if (!upgraded) rejectUpgrade(error);
    try { socket.destroy(); } catch {}
  }

  socket.on('data', (chunk) => {
    receiveBuffer = Buffer.concat([receiveBuffer, chunk]);
    if (!upgraded) {
      const boundary = receiveBuffer.indexOf('\r\n\r\n');
      if (boundary < 0) return;
      const head = receiveBuffer.subarray(0, boundary).toString('utf8');
      receiveBuffer = receiveBuffer.subarray(boundary + 4);
      const lines = head.split('\r\n');
      const status = lines.shift() || '';
      const responseHeaders = new Map();
      for (const line of lines) {
        const separator = line.indexOf(':');
        if (separator > 0) responseHeaders.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
      }
      if (!/^HTTP\/1\.[01] 101\b/.test(status)) {
        const match = status.match(/\s(\d{3})\s/);
        return fail(new Error(`realtime_upgrade_rejected_${match?.[1] || 'unknown'}`));
      }
      if (responseHeaders.get('sec-websocket-accept') !== expectedAccept) {
        return fail(new Error('realtime_upgrade_accept_mismatch'));
      }
      upgraded = true;
      clearTimeout(upgradeTimer);
      resolveUpgrade();
    }

    try {
      receiveBuffer = parseFrames(receiveBuffer, {
        text(message) { onMessage(message); },
        close(payload) {
          if (!closed) socket.write(makeFrame(0x8, payload));
          closed = true;
          socket.end();
        },
        ping(payload) { socket.write(makeFrame(0xa, payload)); },
        pong() {}
      });
    } catch (error) {
      fail(error);
    }
  });

  socket.on('error', (error) => {
    if (!upgraded) rejectUpgrade(error);
    if (!closed) onClose(error);
    closed = true;
  });
  socket.on('close', () => {
    if (!closed) onClose(null);
    closed = true;
  });

  await upgradePromise;

  return {
    sendText(value) {
      if (closed) throw new Error('realtime_socket_closed');
      socket.write(makeFrame(0x1, Buffer.from(String(value))));
    },
    ping() {
      if (!closed) socket.write(makeFrame(0x9, Buffer.from('atlas')));
    },
    close() {
      if (closed) return;
      closed = true;
      socket.write(makeFrame(0x8));
      socket.end();
    }
  };
}
