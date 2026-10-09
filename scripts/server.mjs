import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { attachLocalRealtime } from './local-realtime.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'app/public');
const cmsRoot = path.join(projectRoot, 'app/cms-reference');
const mediaCacheRoot = path.join(projectRoot, '.artifacts/media-cache');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const cmsKinds = new Set(['about', 'contact', 'media', 'metadata', 'projects']);
const cmsVersions = new Set(['production', 'staging', 'dev', 'latest']);
const gcsOrigin = 'https://storage.googleapis.com';
const gcsMediaPrefix = gcsOrigin + '/activetheory-v6.appspot.com/media/';
const mediaByHash = new Map();
const assistantThreads = new Map();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
  '.vs': 'text/plain; charset=utf-8',
  '.ktx2': 'image/ktx2',
  '.cube': 'text/plain; charset=utf-8'
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function indexMediaUrls(value) {
  if (typeof value === 'string') {
    if (value.startsWith(gcsMediaPrefix)) mediaByHash.set(sha256(value), value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) indexMediaUrls(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) indexMediaUrls(item);
  }
}

function buildMediaAllowlist() {
  for (const entry of fs.readdirSync(cmsRoot)) {
    if (!entry.endsWith('.json')) continue;
    try {
      indexMediaUrls(JSON.parse(fs.readFileSync(path.join(cmsRoot, entry), 'utf8')));
    } catch (error) {
      console.warn('Skipping unreadable CMS snapshot ' + entry + ': ' + error.message);
    }
  }
}

function rewriteCmsMedia(value) {
  if (typeof value === 'string' && value.startsWith(gcsMediaPrefix)) {
    const hash = sha256(value);
    return mediaByHash.has(hash) ? '/media-cache/' + hash : value;
  }
  if (Array.isArray(value)) return value.map(rewriteCmsMedia);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteCmsMedia(child)]));
  }
  return value;
}

function sendText(res, status, text, extraHeaders = {}) {
  const body = Buffer.from(text);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function safePath(requestPath) {
  const effectivePath = requestPath === '/unsupported' || requestPath === '/unsupported/'
    ? '/unsupported.html'
    : requestPath;
  const candidate = path.resolve(publicRoot, '.' + (effectivePath === '/' ? '/index.html' : effectivePath));
  const relative = path.relative(publicRoot, candidate);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return null;
  return candidate;
}

function isMissingStaticPath(requestPath) {
  return requestPath.startsWith('/assets/')
    || requestPath.startsWith('/api/')
    || requestPath.startsWith('/ws/')
    || requestPath.startsWith('/media-cache/')
    || requestPath.startsWith('/cms/')
    || requestPath === '/sw.js'
    || requestPath === '/robots.txt'
    || /\.(?:html|mjs?|cjs|json|css|wasm|woff2?|otf|ttf|svg|png|jpe?g|webp|gif|mp4|mov|webm|mp3|wav|bin|ktx2|ico|txt|vs|cube)$/i.test(requestPath);
}

async function handleCms(req, res, requestPath) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const prefix = '/cms/';
  const filename = requestPath.startsWith(prefix) ? requestPath.slice(prefix.length) : '';
  if (!filename.endsWith('.json')) return sendText(res, 404, 'Not Found');
  const parts = filename.slice(0, -5).split('-');
  const version = parts.pop();
  const kind = parts.join('-');
  if (!cmsKinds.has(kind) || !cmsVersions.has(version)) return sendText(res, 404, 'Not Found');

  // The recovered bundle requests "dev" because window.PROD is undefined.
  // Keep that behavior. The "latest" alias resolves to the captured production snapshot.
  const effectiveVersion = version === 'latest' ? 'production' : version;
  const file = path.join(cmsRoot, kind + '-' + effectiveVersion + '.json');
  try {
    const parsed = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    const body = Buffer.from(JSON.stringify(rewriteCmsMedia(parsed)));
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error('CMS snapshot error for ' + kind + '-' + effectiveVersion + ': ' + error.message);
    return sendText(res, 500, 'CMS snapshot unavailable');
  }
}

function parseRange(header, size) {
  if (!header) return null;
  if (!header.startsWith('bytes=') || header.includes(',')) return { invalid: true };
  const parts = header.slice(6).split('-');
  if (parts.length !== 2 || (!parts[0] && !parts[1])) return { invalid: true };
  let start;
  let end;
  if (!parts[0]) {
    const suffixLength = Number(parts[1]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return { invalid: true };
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(parts[0]);
    end = parts[1] ? Number(parts[1]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return { invalid: true };
  }
  return { start, end: Math.min(end, size - 1) };
}

async function waitForDrain(writable) {
  if (writable.destroyed || writable.writableEnded) throw new Error('Stream closed');
  await once(writable, 'drain');
}

async function serveCachedMedia(req, res, url, cacheFile) {
  const stat = await fs.promises.stat(cacheFile);
  const range = parseRange(req.headers.range, stat.size);
  if (range && range.invalid) {
    return sendText(res, 416, 'Range Not Satisfiable', {
      'Content-Range': 'bytes */' + stat.size,
      'Accept-Ranges': 'bytes'
    });
  }
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  const headers = {
    'Content-Type': mime[ext] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': range ? range.end - range.start + 1 : stat.size,
    'X-Content-Type-Options': 'nosniff',
    'X-Asset-Cache': 'HIT'
  };
  if (range) headers['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + stat.size;
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(cacheFile, range ? { start: range.start, end: range.end } : {});
  stream.on('error', error => {
    if (!res.headersSent) sendText(res, 500, 'Media cache read failed');
    else res.destroy(error);
  });
  stream.pipe(res);
}

async function serveRemoteMedia(req, res, url, cacheFile) {
  if (req.method === 'HEAD') {
    const upstream = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const headers = {
      'Content-Type': upstream.headers.get('content-type') || mime[path.extname(new URL(url).pathname).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
      'Cache-Control': 'no-store',
      'X-Asset-Cache': 'MISS'
    };
    for (const key of ['content-length', 'etag', 'last-modified']) {
      const value = upstream.headers.get(key);
      if (value) headers[key] = value;
    }
    res.writeHead(upstream.status, headers);
    return res.end();
  }

  const isRangeRequest = Boolean(req.headers.range);
  const upstream = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'accept-encoding': 'identity',
      ...(isRangeRequest ? { range: req.headers.range } : {})
    }
  });
  if (!upstream.ok && upstream.status !== 206) return sendText(res, upstream.status, 'Upstream media unavailable');

  const ext = path.extname(new URL(url).pathname).toLowerCase();
  const headers = {
    'Content-Type': upstream.headers.get('content-type') || mime[ext] || 'application/octet-stream',
    'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
    'Cache-Control': 'no-store',
    'X-Asset-Cache': 'MISS',
    'X-Content-Type-Options': 'nosniff'
  };
  for (const key of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const value = upstream.headers.get(key);
    if (value) headers[key] = value;
  }
  res.writeHead(upstream.status, headers);
  if (!upstream.body) return res.end();

  // Partial responses are forwarded but never cached as complete files.
  if (isRangeRequest || upstream.status === 206) {
    for await (const part of upstream.body) {
      if (!res.write(Buffer.from(part))) await waitForDrain(res);
    }
    return res.end();
  }

  await fs.promises.mkdir(mediaCacheRoot, { recursive: true });
  const tempFile = cacheFile + '.' + process.pid + '.' + crypto.randomBytes(5).toString('hex') + '.tmp';
  const writer = fs.createWriteStream(tempFile, { flags: 'wx' });
  try {
    for await (const part of upstream.body) {
      const chunk = Buffer.from(part);
      if (!writer.write(chunk)) await waitForDrain(writer);
      if (!res.write(chunk)) await waitForDrain(res);
    }
    await new Promise((resolve, reject) => {
      writer.once('error', reject);
      writer.end(resolve);
    });
    await fs.promises.rename(tempFile, cacheFile);
    return res.end();
  } catch (error) {
    writer.destroy();
    await fs.promises.rm(tempFile, { force: true }).catch(() => {});
    console.error('Media stream error: ' + error.message);
    if (!res.headersSent) return sendText(res, 502, 'Unable to load media');
    return res.destroy(error);
  }
}

async function handleMedia(req, res, requestPath) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }
  const prefix = '/media-cache/';
  const hash = requestPath.startsWith(prefix) ? requestPath.slice(prefix.length) : '';
  if (hash.length !== 64 || !/^[a-f0-9]+$/.test(hash)) return sendText(res, 404, 'Not Found');
  const url = mediaByHash.get(hash);
  if (!url) return sendText(res, 404, 'Media is not present in captured CMS allowlist');

  const cacheFile = path.join(mediaCacheRoot, hash);
  try {
    const stat = await fs.promises.stat(cacheFile);
    if (stat.isFile()) return await serveCachedMedia(req, res, url, cacheFile);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Media-cache stat error: ' + error.message);
  }
  try {
    return await serveRemoteMedia(req, res, url, cacheFile);
  } catch (error) {
    console.error('Media fetch error: ' + error.message);
    if (!res.headersSent) return sendText(res, 502, 'Unable to load media');
    return res.destroy(error);
  }
}

const capturedProjects = JSON.parse(fs.readFileSync(path.join(cmsRoot, 'projects-dev.json'), 'utf8'));
const stopWords = new Set([
  'about', 'after', 'also', 'and', 'are', 'can', 'could', 'find', 'for',
  'from', 'help', 'here', 'into', 'looking', 'me', 'more', 'of', 'on',
  'please', 'project', 'projects', 'show', 'similar', 'some', 'something',
  'that', 'the', 'their', 'them', 'there', 'this', 'to', 'want', 'with',
  'work', 'you', 'your', 'tell', 'what', 'which', 'who'
]);

async function readJsonBody(req, limit = 16 * 1024) {
  const chunks = [];
  let length = 0;
  for await (const part of req) {
    const chunk = Buffer.from(part);
    length += chunk.length;
    if (length > limit) {
      const error = new Error('Request body exceeds the allowed size');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!length) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      const error = new Error('Request body must be a JSON object');
      error.status = 400;
      throw error;
    }
    return value;
  } catch (error) {
    if (error.status) throw error;
    const invalid = new Error('Malformed JSON request body');
    invalid.status = 400;
    throw invalid;
  }
}

function tokens(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function chooseProject(message) {
  const query = String(message || '').slice(0, 4000).toLowerCase();
  const queryTokens = Array.from(new Set(tokens(query).filter(token => token.length > 2 && !stopWords.has(token))));
  if (!queryTokens.length) return null;

  let best = null;
  let bestScore = 0;
  for (const project of capturedProjects) {
    const slug = String(project.slug || '').toLowerCase();
    const name = String(project.name || '').toLowerCase();
    const client = String(project.clientName || '').toLowerCase();
    const tags = String(project.tags || '').toLowerCase();
    const description = String(project.description || '').toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      if (slug.replaceAll('-', ' ').replaceAll('_', ' ').split(' ').includes(token)) score += 6;
      if (name.includes(token)) score += 6;
      if (client.includes(token)) score += 4;
      if (tags.includes(token)) score += 3;
      if (description.includes(token)) score += 1;
    }
    if (name && query.includes(name)) score += 12;
    if (slug && query.includes(slug.replaceAll('-', ' '))) score += 12;
    if (score > bestScore) {
      best = project;
      bestScore = score;
    }
  }
  return bestScore >= 4 ? best : null;
}

function runLocalAssistant(thread) {
  const latest = [...thread.messages].reverse().find(message => message.role === 'user');
  const project = chooseProject(latest ? latest.content : '');
  if (!project) {
    return {
      slug: '',
      text: 'I can help you explore Active Theory’s work. Try mentioning a project, client, or topic from the portfolio.'
    };
  }
  const client = String(project.clientName || '').trim();
  const description = String(project.description || '').trim();
  const text = client
    ? String(project.name) + ' was created for ' + client + '. ' + description
    : String(project.name) + '. ' + description;
  return { slug: String(project.slug || ''), text: text.trim() };
}

async function handleAssistant(req, res, requestPath) {
  const prefix = '/api/assistant/';
  const action = requestPath.startsWith(prefix) ? requestPath.slice(prefix.length) : '';
  const allowed = new Set(['createThread', 'createMessage', 'createRun', 'listMessage']);
  if (!allowed.has(action)) return sendJson(res, 404, { error: 'Unknown assistant action' });
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed', allowed: ['POST'] });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, error.status || 400, { error: error.message });
  }

  if (action === 'createThread') {
    if (assistantThreads.size >= 256) {
      const oldest = assistantThreads.keys().next().value;
      if (oldest) assistantThreads.delete(oldest);
    }
    const id = 'thread_' + crypto.randomUUID();
    assistantThreads.set(id, { id, createdAt: Date.now(), messages: [], result: null });
    return sendJson(res, 200, { id });
  }

  if (typeof body.threadId !== 'string' || !assistantThreads.has(body.threadId)) {
    return sendJson(res, 404, { error: 'Assistant thread not found' });
  }
  const thread = assistantThreads.get(body.threadId);
  thread.updatedAt = Date.now();

  if (action === 'createMessage') {
    if (typeof body.content !== 'string' || !body.content.trim()) {
      return sendJson(res, 400, { error: 'content must be a non-empty string' });
    }
    if (body.content.length > 4000) {
      return sendJson(res, 413, { error: 'content exceeds 4000 characters' });
    }
    thread.messages.push({ id: 'msg_' + crypto.randomUUID(), role: 'user', content: body.content.trim() });
    thread.result = null;
    return sendJson(res, 200, { message: thread.messages[thread.messages.length - 1].id });
  }

  if (action === 'createRun') {
    thread.result = runLocalAssistant(thread);
    return sendJson(res, 200, { slug: thread.result.slug });
  }

  if (action === 'listMessage') return sendJson(res, 200, { text: thread.result ? thread.result.text : '' });
  return sendJson(res, 404, { error: 'Unknown assistant action' });
}

function serveHtmlWithBridge(file, res, req) {
  fs.readFile(file, 'utf8', (error, html) => {
    if (error) return sendText(res, 500, 'Unable to read site entry');
    const marker = '<script>!function(){window._ENV_=';
    if (!html.includes(marker)) return sendText(res, 500, 'Live HTML bootstrap marker was not found');
    const bridge = '<script src="/phase1-local-bridge.js"></script>\n    ';
    const body = Buffer.from(html.replace(marker, bridge + marker));
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Local-Integration': 'phase1-local-bridge'
    });
    if (req.method === 'HEAD') return res.end();
    res.end(body);
  });
}

buildMediaAllowlist();

const server = http.createServer(async (req, res) => {
  let requestPath;
  try {
    requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return sendText(res, 400, 'Bad Request');
  }

  if (requestPath.startsWith('/cms/')) return await handleCms(req, res, requestPath);
  if (requestPath.startsWith('/media-cache/')) return await handleMedia(req, res, requestPath);
  if (requestPath.startsWith('/api/assistant/')) return await handleAssistant(req, res, requestPath);
  if (requestPath.startsWith('/api/')) return sendText(res, 404, 'API route not implemented');

  const file = safePath(requestPath);
  if (!file) return sendText(res, 400, 'Bad Request');

  fs.stat(file, (error, stat) => {
    if (!error && stat.isFile()) {
      if (requestPath === '/' || requestPath === '/index.html') return serveHtmlWithBridge(file, res, req);
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mime[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
      return;
    }
    if (isMissingStaticPath(requestPath)) return sendText(res, 404, 'Not Found');
    return serveHtmlWithBridge(path.join(publicRoot, 'index.html'), res, req);
  });
});

attachLocalRealtime(server);

server.listen(port, host, () => {
  console.log('Active Theory Phase 1 server: http://' + host + ':' + port);
  console.log('CMS/media allowlist loaded: ' + mediaByHash.size + ' unique media URLs');
});
