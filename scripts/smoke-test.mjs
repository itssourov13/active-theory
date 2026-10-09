import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
let failures = 0;
let passes = 0;

async function check(name, run) {
  try {
    await run();
    passes++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const checks = [
  { path: '/', status: 200, includes: '<title>Active Theory · Creative Digital Experiences</title>' },
  { path: '/', status: 200, includes: '<script src="/phase1-local-bridge.js"></script>' },
  { path: '/studio/', status: 200, includes: '<title>Active Theory · Creative Digital Experiences</title>' },
  // /work/<known-slug> receives live-matching SSR meta: title = "{name} · Active Theory".
  { path: '/work/dream-portal', status: 200, includes: '<title>Dream Portal · Active Theory</title>' },
  { path: '/work/not-a-real-project', status: 200, includes: '<title>Active Theory · Creative Digital Experiences</title>' },
  { path: '/unsupported', status: 200, includes: 'Your browser is not supported' },
  { path: '/phase1-local-bridge.js', status: 200, includes: 'phase1Fetch' },
  { path: '/assets/js/app.1780406240914.js', status: 200, includes: 'function RNG' },
  { path: '/assets/js/hydra/hydra-thread.js', status: 200 },
  { path: '/assets/fonts/NBArchitektStd-Regular.json', status: 200, contentType: 'application/json' },
  { path: '/assets/fonts/NBArchitektStd-Light.json', status: 200, contentType: 'application/json' },
  { path: '/assets/fonts/NBArchitektStd-Bold.json', status: 200, contentType: 'application/json' },
  { path: '/assets/js/lib/_draco/draco_wasm_wrapper.js', status: 200, contentType: 'javascript' },
  { path: '/assets/js/lib/_draco/draco_decoder.wasm', status: 200, contentType: 'application/wasm' },
  { path: '/assets/js/lib/basis_transcoder.js', status: 200, contentType: 'javascript' },
  { path: '/assets/js/lib/basis_transcoder.wasm', status: 200, contentType: 'application/wasm' },
  { path: '/assets/data/uil.1780406240914.json', status: 200 },
  { path: '/assets/shaders/compiled.vs', status: 200 },
  { path: '/assets/not-found-phase1-smoke.json', status: 404 },
  { path: '/api/not-found-phase1-smoke', status: 404 },
  { path: '/..%2fREADME.md', status: 400 }
];

for (const item of checks) {
  await check(`HTTP ${item.status} ${item.path}`, async () => {
    const response = await fetch(`${base}${item.path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.text();
    assert.equal(response.status, item.status, 'unexpected HTTP status');
    if (item.contentType) assert.ok((response.headers.get('content-type') || '').includes(item.contentType), `content-type should include ${item.contentType}`);
    if (item.includes) assert.ok(body.includes(item.includes), `body should include ${JSON.stringify(item.includes)}`);
  });
}

let cmsProjects;
await check('captured CMS is served locally and keeps all 65 projects', async () => {
  const response = await fetch(`${base}/cms/projects-dev.json`, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/json/i);
  cmsProjects = await response.json();
  assert.ok(Array.isArray(cmsProjects));
  assert.equal(cmsProjects.length, 65);
  const imageUrl = cmsProjects[0]?.projectLogo?.sizes?.i400px?.url;
  assert.match(imageUrl || '', /^\/media-cache\/[a-f0-9]{64}$/);
});

const knownMedia = 'https://storage.googleapis.com/activetheory-v6.appspot.com/media/dream-400x200.jpg';
const mediaKey = createHash('sha256').update(knownMedia).digest('hex');
await check('allowlisted live CMS image can be fetched and cached locally', async () => {
  const response = await fetch(`${base}/media-cache/${mediaKey}`, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /image\/jpeg/i);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, 2619);
});
await check('cached media serves HEAD and byte ranges', async () => {
  const head = await fetch(`${base}/media-cache/${mediaKey}`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('x-asset-cache'), 'HIT');
  assert.equal(Number(head.headers.get('content-length')), 2619);

  const range = await fetch(`${base}/media-cache/${mediaKey}`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 0-9/2619');
  assert.equal((await range.arrayBuffer()).byteLength, 10);
});

await check('assistant API reproduces the recovered four-request contract', async () => {
  async function post(action, body = {}) {
    const response = await fetch(`${base}/api/assistant/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    });
    assert.equal(response.status, 200, `${action} returned HTTP ${response.status}`);
    return response.json();
  }
  const thread = await post('createThread');
  assert.ok(thread.id);
  const message = await post('createMessage', { threadId: thread.id, content: 'Tell me about Dream Portal' });
  assert.ok(message.message);
  const run = await post('createRun', { threadId: thread.id });
  assert.equal(run.slug, 'dream-portal');
  const result = await post('listMessage', { threadId: thread.id });
  assert.match(result.text, /Dream Portal/);
});

await check('assistant API rejects unknown threads and wrong methods', async () => {
  const unknown = await fetch(`${base}/api/assistant/createMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: 'missing-thread', content: 'hello' })
  });
  assert.equal(unknown.status, 404);
  const wrongMethod = await fetch(`${base}/api/assistant/createThread`);
  assert.equal(wrongMethod.status, 405);
});

await check('local realtime implements room join, state sync and disconnect events', async () => {
  const wsUrl = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws';
  const first = new WebSocket(wsUrl, ['permessage-deflate']);
  const second = new WebSocket(wsUrl, ['permessage-deflate']);
  const queues = [[], []];
  const waitForOpen = socket => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), 5000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket open failed')); }, { once: true });
  });
  const waitForEvent = (queue, name) => new Promise((resolve, reject) => {
    const find = () => queue.find(item => item && item._evt === name);
    const existing = find();
    if (existing) return resolve(existing);
    const started = Date.now();
    const timer = setInterval(() => {
      const found = find();
      if (found) { clearInterval(timer); resolve(found); }
      else if (Date.now() - started > 5000) { clearInterval(timer); reject(new Error('Timeout waiting for ' + name)); }
    }, 25);
  });
  for (const [i, socket] of [first, second].entries()) {
    socket.addEventListener('message', event => {
      try { queues[i].push(JSON.parse(String(event.data))); } catch {}
    });
  }
  try {
    await Promise.all([waitForOpen(first), waitForOpen(second)]);
    assert.equal(first.protocol, 'permessage-deflate');
    first.send(JSON.stringify({ _evt: 'findAny', type: 'phase1-smoke', forceNewRoom: true }));
    const found = await waitForEvent(queues[0], 'findAny_response');
    first.send(JSON.stringify({ _evt: 'join', id: found.id, user: { label: 'first' }, MAX_IN_ROOM: 3, type: 'phase1-smoke' }));
    const firstJoin = await waitForEvent(queues[0], 'join_response');
    assert.equal(firstJoin.success, true);

    second.send(JSON.stringify({ _evt: 'join', id: found.id, user: { label: 'second' }, MAX_IN_ROOM: 3, type: 'phase1-smoke' }));
    const secondJoin = await waitForEvent(queues[1], 'join_response');
    assert.equal(secondJoin.success, true);
    assert.equal(secondJoin.players.length, 2);
    const opened = await waitForEvent(queues[0], 'open_connection');
    assert.equal(opened.gcID, secondJoin.myID);

    first.send(JSON.stringify({ _evt: 'request_state' }));
    const state = await waitForEvent(queues[0], 'rebroadcast_players');
    assert.ok(Array.isArray(state.data));
    assert.ok(state.data.some(player => player.id === secondJoin.myID));

    second.send(JSON.stringify({ _evt: 'leave', id: found.id }));
    const disconnected = await waitForEvent(queues[0], 'player_disconnect');
    assert.equal(disconnected.id, secondJoin.myID);
  } finally {
    await Promise.all([first, second].map(socket => new Promise(resolve => {
      if (socket.readyState === WebSocket.CLOSED) return resolve();
      const timer = setTimeout(resolve, 1000);
      socket.addEventListener('close', () => { clearTimeout(timer); resolve(); }, { once: true });
      try { socket.close(); } catch { clearTimeout(timer); resolve(); }
    })));
  }
});

if (failures) {
  console.error(`\nSMOKE FAILED: ${failures}/${passes + failures} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`\nSMOKE PASSED: ${passes}/${passes} checks`);
}

