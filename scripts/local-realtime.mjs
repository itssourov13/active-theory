import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SUBPROTOCOL = 'permessage-deflate';
const MAX_FRAME_BYTES = 2 * 1024 * 1024;
const rooms = new Map();
const clients = new Set();

function frame(payload, opcode = 1) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x80 | opcode, body.length]);
  } else if (body.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  return Buffer.concat([header, body]);
}

function writeFrame(client, payload, opcode = 1) {
  if (client.closed || client.socket.destroyed) return false;
  return client.socket.write(frame(payload, opcode));
}

function sendEvent(client, event, data = {}) {
  if (!client || client.closed) return;
  const packet = Object.assign({}, data, { _evt: event });
  writeFrame(client, JSON.stringify(packet));
}

function allRoomClients(room) {
  const members = [...room.members.values()].map(member => member.client);
  return new Set([...members, ...room.watchers.values()]);
}

function broadcastRoom(room, event, data = {}, exceptClient = null) {
  for (const client of allRoomClients(room)) {
    if (client !== exceptClient) sendEvent(client, event, data);
  }
}

function playerRecords(room) {
  return [...room.members.values()].map(member => ({
    id: member.client.id,
    data: member.userData || {}
  }));
}

function makeRoom(id, type = 'any', maxInRoom = 3, timeoutDisconnect = 360000) {
  const room = {
    id: String(id),
    type: String(type || 'any'),
    maxInRoom: Number.isFinite(Number(maxInRoom)) && Number(maxInRoom) > 0 ? Number(maxInRoom) : 3,
    timeoutDisconnect: Number(timeoutDisconnect) || 360000,
    hostId: null,
    members: new Map(),
    watchers: new Map(),
    createdAt: Date.now()
  };
  rooms.set(room.id, room);
  return room;
}

function getRoom(id) {
  return rooms.get(String(id));
}

function scheduleEmptyRoomCleanup(room) {
  setTimeout(() => {
    if (!room.members.size && !room.watchers.size && rooms.get(room.id) === room) {
      rooms.delete(room.id);
    }
  }, 60_000).unref?.();
}

function removeFromRoom(client) {
  if (!client.roomId) return;
  const room = getRoom(client.roomId);
  client.roomId = null;
  if (!room) return;
  const wasMember = room.members.delete(client.id);
  room.watchers.delete(client.id);
  if (wasMember) {
    broadcastRoom(room, 'player_disconnect', { id: client.id }, client);
    if (room.hostId === client.id) {
      room.hostId = room.members.keys().next().value || null;
      if (room.hostId) {
        const nextHost = room.members.get(room.hostId).client;
        sendEvent(nextHost, 'become_host', { id: room.id });
      }
    }
  }
  if (!room.members.size && !room.watchers.size) scheduleEmptyRoomCleanup(room);
}

function replyRoundTrip(client, action, data) {
  sendEvent(client, action + '_response', data);
}

function handleRequest(client, message) {
  const event = message && typeof message._evt === 'string' ? message._evt : '';
  if (!event) return;
  delete message._evt;
  client.lastSeenAt = Date.now();

  if (event === 'register') {
    client.channel = message.channel || '';
    return;
  }
  if (event === 'findAny') {
    const type = String(message.type || 'any');
    let room = null;
    if (!message.forceNewRoom) {
      for (const candidate of rooms.values()) {
        const compatibleType = type === 'any' || candidate.type === type;
        if (compatibleType && candidate.members.size < candidate.maxInRoom) {
          room = candidate;
          break;
        }
      }
    }
    if (!room) room = makeRoom('room_' + crypto.randomUUID(), type, 3);
    return replyRoundTrip(client, 'findAny', { id: room.id });
  }
  if (event === 'create') {
    const id = String(message.id || ('room_' + crypto.randomUUID()));
    const existing = rooms.get(id);
    if (existing) {
      return replyRoundTrip(client, 'create', {
        success: true,
        id,
        maxInRoom: existing.maxInRoom,
        timeoutDisconnect: existing.timeoutDisconnect,
        type: existing.type
      });
    }
    const room = makeRoom(id, message.type || 'any', message.MAX_IN_ROOM, message.TIMEOUT_DISCONNECT);
    return replyRoundTrip(client, 'create', {
      success: true,
      id: room.id,
      maxInRoom: room.maxInRoom,
      timeoutDisconnect: room.timeoutDisconnect,
      type: room.type
    });
  }
  if (event === 'join') {
    const room = getRoom(message.id);
    if (!room) return replyRoundTrip(client, 'join', { success: false, reason: 'room-not-found' });
    if (!room.members.has(client.id) && room.members.size >= (Number(message.MAX_IN_ROOM) || room.maxInRoom)) {
      return replyRoundTrip(client, 'join', { success: false, reason: 'room-full' });
    }
    const existingMembers = [...room.members.values()];
    client.userData = message.user && typeof message.user === 'object' ? message.user : {};
    client.roomId = room.id;
    client.watching = false;
    room.watchers.delete(client.id);
    room.members.set(client.id, { client, userData: client.userData, joinedAt: Date.now() });
    if (!room.hostId) room.hostId = client.id;
    replyRoundTrip(client, 'join', {
      success: true,
      id: room.id,
      myID: client.id,
      host: room.hostId === client.id,
      players: playerRecords(room)
    });
    for (const member of existingMembers) {
      sendEvent(member.client, 'open_connection', { gcID: client.id, data: client.userData });
    }
    return;
  }
  if (event === 'watch') {
    const room = getRoom(message.id);
    if (!room) return replyRoundTrip(client, 'watch', { success: false, reason: 'room-not-found' });
    removeFromRoom(client);
    client.roomId = room.id;
    client.watching = true;
    client.userData = message.user && typeof message.user === 'object' ? message.user : {};
    room.watchers.set(client.id, client);
    return replyRoundTrip(client, 'watch', {
      success: true,
      id: room.id,
      myID: client.id,
      players: playerRecords(room)
    });
  }
  if (event === 'leave') {
    removeFromRoom(client);
    return replyRoundTrip(client, 'leave', { success: true });
  }
  if (event === 'request_state') {
    const room = client.roomId && getRoom(client.roomId);
    if (room) {
      const data = playerRecords(room).filter(player => player.id !== client.id);
      sendEvent(client, 'rebroadcast_players', { data });
    }
    return;
  }
  if (event === 'alive') return;
  if (event === 'findNearby') return replyRoundTrip(client, 'findNearby', { rooms: [] });
  if (event === 'roomCount') {
    const room = getRoom(message.roomId);
    return replyRoundTrip(client, 'roomCount', { count: room ? room.members.size : 0 });
  }
  if (event === 'locate_server') {
    return replyRoundTrip(client, 'locate_server', { roomId: message.roomId, server: 'local' });
  }

  if (event === 'server_data' || event === 'broadcast') {
    for (const peer of clients) {
      if (peer !== client && !peer.closed && (event === 'broadcast' || peer.roomId === client.roomId)) {
        sendEvent(peer, event, message);
      }
    }
    return;
  }

  const room = client.roomId && getRoom(client.roomId);
  if (!room) return;
  if (event === 'update_user_data') {
    const targetId = message.gcID || client.id;
    const member = room.members.get(targetId);
    if (member) member.userData = message.data || {};
    broadcastRoom(room, event, message, client);
    return;
  }
  if (event === 'establish_rtc') {
    const target = [...allRoomClients(room)].find(peer => peer.id === message.to);
    if (target) sendEvent(target, event, Object.assign({}, message, { from: client.id }));
    return;
  }
  if (event === 'ws_data') {
    const targetId = message.to;
    if (targetId) {
      const target = [...allRoomClients(room)].find(peer => peer.id === targetId);
      if (target) sendEvent(target, event, Object.assign({}, message, { from: client.id }));
    } else {
      broadcastRoom(room, event, Object.assign({}, message, { from: client.id }), client);
    }
    return;
  }
  if ([
    'start_game', 'end_game', 'force_disconnect', 'pin', 'unpin',
    'promote_watcher', 'rebroadcast_players'
  ].includes(event)) {
    broadcastRoom(room, event, message, client);
  }
}

function acceptMessage(client, opcode, payload) {
  if (opcode === 0x8) {
    writeFrame(client, payload.length ? payload : Buffer.from([0x03, 0xe8]), 0x8);
    client.socket.end();
    const closeTimer = setTimeout(() => {
      if (!client.socket.destroyed) client.socket.destroy();
    }, 250);
    closeTimer.unref?.();
    return;
  }
  if (opcode === 0x9) {
    writeFrame(client, payload, 0xA);
    return;
  }
  if (opcode === 0xA) return;
  if (opcode === 0x2) {
    // The captured client uses a "binary:" JSON envelope for its room fallback.
    const text = payload.toString('utf8');
    if (text.startsWith('binary:')) {
      try {
        const data = JSON.parse(text.slice(7));
        if (data && typeof data === 'object') handleRequest(client, { _evt: 'ws_data', ...data });
      } catch {}
    }
    return;
  }
  if (opcode !== 0x1) return;
  const text = payload.toString('utf8');
  if (text === 'ping') return writeFrame(client, 'pong');
  if (text === 'pong') return;
  if (text.startsWith('binary:')) {
    try {
      const data = JSON.parse(text.slice(7));
      if (data && typeof data === 'object') handleRequest(client, { _evt: 'ws_data', ...data });
    } catch {}
    return;
  }
  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object' && !Array.isArray(data)) handleRequest(client, data);
  } catch {}
}

function parseFrames(client) {
  while (!client.closed && client.buffer.length >= 2) {
    const first = client.buffer[0];
    const second = client.buffer[1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let payloadLength = second & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      if (client.buffer.length < 4) return;
      payloadLength = client.buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (client.buffer.length < 10) return;
      const bigLength = client.buffer.readBigUInt64BE(2);
      if (bigLength > BigInt(MAX_FRAME_BYTES)) {
        writeFrame(client, Buffer.from([0x03, 0xf1]), 0x8);
        client.socket.destroy();
        return;
      }
      payloadLength = Number(bigLength);
      offset = 10;
    }

    if (payloadLength > MAX_FRAME_BYTES) {
      writeFrame(client, Buffer.from([0x03, 0xf1]), 0x8);
      client.socket.destroy();
      return;
    }
    if (!masked) {
      writeFrame(client, Buffer.from([0x03, 0xea]), 0x8);
      client.socket.destroy();
      return;
    }
    if (client.buffer.length < offset + 4 + payloadLength) return;

    const mask = client.buffer.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.from(client.buffer.subarray(offset, offset + payloadLength));
    client.buffer = client.buffer.subarray(offset + payloadLength);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];

    if (opcode >= 0x8) {
      acceptMessage(client, opcode, payload);
      continue;
    }

    if (opcode === 0x0) {
      if (!client.fragmentOpcode) continue;
      client.fragments.push(payload);
      client.fragmentBytes += payload.length;
      if (client.fragmentBytes > MAX_FRAME_BYTES) {
        client.socket.destroy();
        return;
      }
      if (first & 0x80) {
        const complete = Buffer.concat(client.fragments);
        const originalOpcode = client.fragmentOpcode;
        client.fragmentOpcode = null;
        client.fragments = [];
        client.fragmentBytes = 0;
        acceptMessage(client, originalOpcode, complete);
      }
      continue;
    }

    if (opcode === 0x1 || opcode === 0x2) {
      if (first & 0x80) {
        acceptMessage(client, opcode, payload);
      } else {
        client.fragmentOpcode = opcode;
        client.fragments = [payload];
        client.fragmentBytes = payload.length;
      }
    }
  }
}

function closeClient(client) {
  if (client.closed) return;
  client.closed = true;
  clients.delete(client);
  removeFromRoom(client);
}

export function attachLocalRealtime(server) {
  server.on('upgrade', (req, socket, head) => {
    const requestPath = String(req.url || '').split('?')[0];
    if (requestPath !== '/ws' && !requestPath.startsWith('/ws:')) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    const version = req.headers['sec-websocket-version'];
    if (!key || version !== '13') {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const offered = String(req.headers['sec-websocket-protocol'] || '').split(',').map(value => value.trim());
    const protocol = offered.includes(SUBPROTOCOL) ? SUBPROTOCOL : '';
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Accept: ' + accept
    ];
    if (protocol) headers.push('Sec-WebSocket-Protocol: ' + protocol);
    socket.write(headers.join('\r\n') + '\r\n\r\n');

    const client = {
      id: 'gc_' + crypto.randomUUID(),
      socket,
      buffer: Buffer.alloc(0),
      fragmentOpcode: null,
      fragments: [],
      fragmentBytes: 0,
      roomId: null,
      watching: false,
      userData: {},
      lastSeenAt: Date.now(),
      closed: false
    };
    clients.add(client);
    socket.on('data', chunk => {
      if (client.closed) return;
      client.buffer = Buffer.concat([client.buffer, chunk]);
      parseFrames(client);
    });
    socket.on('error', () => closeClient(client));
    socket.on('close', () => closeClient(client));
    if (head && head.length) {
      client.buffer = Buffer.concat([client.buffer, head]);
      parseFrames(client);
    }
  });

  return {
    get rooms() { return rooms.size; },
    get clients() { return clients.size; }
  };
}
