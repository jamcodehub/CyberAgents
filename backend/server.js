const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Map of pin -> map of socket.id -> player data
let games = {};
const worlds = new Map();
let nextAgentId = 0;

// Codenames handed out to players (unique within a lobby)
const AGENT_NAMES = [
  'Cipher', 'Phantom', 'Vector', 'Packet', 'Kernel', 'Daemon', 'Proxy', 'Beacon', 'Sentinel', 'Honeypot',
  'Payload', 'Bytecode', 'Firewall', 'Gateway', 'Sandbox', 'Token', 'Hash', 'Socket', 'Syntax', 'Binary',
  'Pixel', 'Quantum', 'Matrix', 'Nexus', 'Oracle', 'Raven', 'Shadow', 'Spectre', 'Tracer', 'Viper'
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const STARTING_TOKENS = 100000;
const TOKENS_PER_AGENT = 1000;
const TOKENS_PER_STEAL = 10000;

function assignAgentName(room) {
  const taken = new Set(Object.values(room || {}).filter(p => !p.isHost && !p.spectator).map(p => p.name));
  const free = AGENT_NAMES.filter(n => !taken.has(n));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  // Fallback if all 30 are in use
  return `Agent-${Math.floor(1000 + Math.random() * 9000)}`;
}

function isCompetitor(player) {
  return Boolean(player && !player.isHost && !player.spectator);
}

function isTargetable(player) {
  return Boolean(isCompetitor(player) && player.health > 0);
}

function broadcastLog(pin, msg) {
  io.to(pin).emit('activity_log', { msg });
}

function spawnPosition(room, isHost) {
  if (isHost) return { x: 500, y: 350 };
  const playerCount = Object.values(room).filter(isCompetitor).length;
  const angle = playerCount * 2.399963229728653;
  return {
    x: 500 + Math.cos(angle) * 260,
    y: 350 + Math.sin(angle) * 190
  };
}

function finishGameIfWon(pin) {
  const world = worlds.get(pin);
  const players = games[pin];
  if (!world || !players || !world.started || world.gameOver || world.competitorCount < 2) return;

  const competitors = Object.values(players).filter(isCompetitor);
  const standing = competitors.filter(player => player.health > 0);
  const standingSides = new Set(standing.map(player => player.alliance || `player:${player.id}`));
  if (standingSides.size > 1) return;

  world.gameOver = true;
  world.paused = true;
  const winnerAlliance = standing.length > 0 && standing[0].alliance
    && standing.every(player => player.alliance === standing[0].alliance)
    ? standing[0].alliance
    : null;
  const standings = [...competitors]
    .sort((a, b) => b.health - a.health || b.tokens - a.tokens || a.name.localeCompare(b.name))
    .map((player, index) => ({
      rank: index + 1,
      id: player.id,
      name: player.name,
      alliance: player.alliance,
      health: player.health,
      tokens: player.tokens
    }));

  io.to(pin).emit('game_over', {
    winnerAlliance,
    winners: standings.filter(player => player.health > 0).map(player => player.id),
    standings
  });
  broadcastLog(pin, winnerAlliance
    ? `Victory: alliance ${winnerAlliance} is the last alliance standing.`
    : standing.length === 1
      ? `Victory: ${standing[0].name} is the last agent standing.`
      : 'Game over: no agents remain standing.');
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Register new player in a specific game room
  socket.on('join_game', (data) => {
    const pin = data.pin;
    if (!pin) return;
    
    const isHost = data.isHost === true;

    // A host needs a fresh pin
    if (isHost && games[pin]) {
      socket.emit('join_error', { message: 'That pin is already in use. Try again.' });
      return;
    }
    const roomHasHost = games[pin] && Object.values(games[pin]).some(p => p.isHost && p.spectator);

    // Joiners need an existing lobby that still has a host
    if (!isHost && !roomHasHost) {
      socket.emit('join_error', { message: 'Enter a valid pin code.' });
      return;
    }

    if (!games[pin]) {
      games[pin] = {};
      worlds.set(pin, { agents: [], lastUpdate: Date.now(), paused: false, started: false, competitorCount: 0, gameOver: false });
    }

    const world = worlds.get(pin);
    if (world.gameOver) {
      socket.emit('join_error', { message: 'This game has ended. Start a new network to play again.' });
      return;
    }
    if (!isHost && world.started) {
      socket.emit('join_error', { message: 'This game has already started. Join a new network.' });
      return;
    }

    socket.join(pin);
    socket.pin = pin; // Store pin on socket for disconnect logic

    const position = spawnPosition(games[pin], isHost);
    games[pin][socket.id] = {
      id: socket.id,
      name: isHost ? 'Host watchtower' : assignAgentName(games[pin]),
      health: 100,
      tokens: isHost ? 0 : STARTING_TOKENS,
      isHost,
      spectator: isHost, // hosts watch and manage; they have no base
      color: null,
      alliance: null,
      swarm: null,
      firewall: false,
      accessMode: null,
      actions: [],
      ...position,
      lastActionByTarget: {},
      lastIncident: 0
    };
    if (!isHost) world.competitorCount += 1;
    
    // Send current game state to new player
    socket.emit('game_state', games[pin]);
    socket.emit('world_state', {
      players: Object.values(games[pin]),
      agents: worlds.get(pin).agents,
      paused: worlds.get(pin).paused,
      started: worlds.get(pin).started
    });
    io.to(pin).emit('lobby_state', {
      players: Object.values(games[pin]),
      started: worlds.get(pin).started
    });
    // Broadcast new player to others in the room
    socket.to(pin).emit('player_joined', games[pin][socket.id]);
    broadcastLog(pin, `${games[pin][socket.id].name} joined the game.`);
  });

  socket.on('start_game', (acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === 'function') acknowledge(result);
    };
    const pin = socket.pin;
    const player = pin && games[pin] && games[pin][socket.id];
    const world = pin && worlds.get(pin);
    if (!player?.isHost || !world) {
      respond({ accepted: false, reason: 'Only the host can start this game.' });
      return;
    }
    if (world.gameOver) {
      respond({ accepted: false, reason: 'This game has already ended.' });
      return;
    }
    if (world.started) {
      respond({ accepted: false, reason: 'The game has already started.' });
      return;
    }

    world.started = true;
    world.lastUpdate = Date.now();
    io.to(pin).emit('game_started');
    io.to(pin).emit('lobby_state', { players: Object.values(games[pin]), started: true });
    broadcastLog(pin, `${player.name} started the game.`);
    respond({ accepted: true });
  });

  socket.on('activity_log', (data) => {
    const pin = socket.pin;
    const player = pin && games[pin] && games[pin][socket.id];
    if (!player || typeof data?.msg !== 'string') return;
    const msg = data.msg.trim().slice(0, 500);
    if (!msg) return;
    socket.to(pin).emit('activity_log', { msg: `${player.name}: ${msg}` });
  });

  socket.on('set_game_paused', (data) => {
    const pin = socket.pin;
    const player = pin && games[pin] && games[pin][socket.id];
    const world = pin && worlds.get(pin);
    if (!player?.isHost || !world || !world.started || world.gameOver || typeof data?.paused !== 'boolean') return;
    if (world.paused === data.paused) return;
    world.paused = data.paused;
    io.to(pin).emit('game_paused', { paused: world.paused });
    broadcastLog(pin, `${player.name} ${world.paused ? 'paused' : 'resumed'} the game.`);
  });

  socket.on('move_player', (data) => {
    const pin = socket.pin;
    const host = pin && games[pin] && games[pin][socket.id];
    if (!host?.isHost || !Number.isFinite(data?.x) || !Number.isFinite(data?.y)) return;
    const target = games[pin][data.playerId];
    if (!target) return;
    target.x = Math.min(1000, Math.max(0, data.x));
    target.y = Math.min(700, Math.max(0, data.y));
  });

  // Share alliance + agent swarm info with the rest of the room
  socket.on('player_update', (data, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === 'function') acknowledge(result);
    };
    const pin = socket.pin;
    if (!pin || !games[pin]) {
      respond({ accepted: false, reason: 'You are no longer connected to this game.' });
      return;
    }

    const player = games[pin][socket.id];
    if (!player) {
      respond({ accepted: false, reason: 'Your player is not registered in this game.' });
      return;
    }

    if (!isTargetable(player)) {
      respond({ accepted: false, reason: 'Host and spectator accounts cannot deploy agents.' });
      return;
    }
    if (!worlds.get(pin)?.started) {
      respond({ accepted: false, reason: 'Wait for the host to start the game before deploying agents.' });
      return;
    }

    const alliance = typeof data?.alliance === 'string'
      ? data.alliance.trim().substring(0, 20) || null
      : null;
    const clamp = (n) => Math.min(Math.max(parseInt(n) || 0, 0), 50);
    const swarm = data?.swarm
      ? { red: clamp(data.swarm.red), blue: clamp(data.swarm.blue) }
      : null;
    const firewall = data?.firewall === true;
    const accessMode = data?.accessMode === 'fullAccess' || data?.accessMode === 'requireApproval'
      ? data.accessMode
      : null;
    const actions = Array.isArray(data?.actions)
      ? data.actions.slice(0, 50).flatMap(action => {
        if (action?.action !== 'attack' && action?.action !== 'steal') return [];
        if (typeof action.targetId !== 'string') return [];
        const target = games[pin][action.targetId];
        if (!isTargetable(target) || target.id === player.id || (alliance && alliance === target.alliance)) return [];
        const count = Math.min(Math.max(parseInt(action.count, 10) || 0, 0), 50);
        return count > 0 ? [{ action: action.action, targetId: action.targetId, count }] : [];
      })
      : [];

    // Alliance members share one color: keep the teammates' color, or use the founder's pick
    const teammate = alliance
      ? Object.values(games[pin]).find(p => p.id !== socket.id && p.alliance === alliance)
      : null;
    const picked = HEX_COLOR.test(data?.color) ? data.color : null;
    const color = alliance ? (teammate?.color ?? picked) : null;

    player.alliance = alliance;
    player.swarm = swarm;
    player.color = color;
    player.firewall = firewall;
    player.accessMode = accessMode;
    player.actions = actions;
    io.to(pin).emit('player_updated', { id: socket.id, alliance, swarm, color, firewall, accessMode });
    respond({
      accepted: true,
      actionCount: actions.length,
      actions: actions.map(({ action, targetId, count }) => ({ action, targetId, count }))
    });
  });

  // Change the color of the whole alliance
  socket.on('set_alliance_color', (data) => {
    const pin = socket.pin;
    if (!pin || !games[pin]) return;

    const player = games[pin][socket.id];
    if (!isTargetable(player) || !player.alliance || !worlds.get(pin)?.started) return;
    if (!HEX_COLOR.test(data?.color)) return;

    Object.values(games[pin]).forEach(p => {
      if (p.alliance === player.alliance) p.color = data.color;
    });
    io.to(pin).emit('alliance_color', { alliance: player.alliance, color: data.color });
    broadcastLog(pin, `${player.name} changed alliance ${player.alliance}'s color.`);
  });

  // Process game-only agent actions and token transfers.
  socket.on('agent_action', (data, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === 'function') acknowledge(result);
    };
    const pin = socket.pin;
    if (!pin || !games[pin]) {
      respond({ accepted: false, reason: 'You are no longer connected to this game.' });
      return;
    }

    const player = games[pin][socket.id];
    if (!isTargetable(player)) {
      respond({ accepted: false, reason: 'Host and spectator accounts cannot deploy agents.' });
      return;
    }
    if (!worlds.get(pin)?.started) {
      respond({ accepted: false, reason: 'Wait for the host to start the game before deploying agents.' });
      return;
    }
    if (worlds.get(pin)?.paused || worlds.get(pin)?.gameOver) {
      respond({ accepted: false, reason: 'The game is paused or has ended.' });
      return;
    }
    if (data?.action !== 'attack' && data?.action !== 'steal') {
      respond({ accepted: false, reason: 'The requested agent action is invalid.' });
      return;
    }

    const target = games[pin][data.targetId];
    if (!isTargetable(target) || target.id === player.id) {
      respond({ accepted: false, reason: 'The selected target is unavailable.' });
      return;
    }
    if (player.alliance && player.alliance === target.alliance) {
      respond({ accepted: false, reason: 'Agents cannot target an allied player.' });
      return;
    }
    if (data.action === 'steal' && target.tokens <= 0) {
      respond({ accepted: false, reason: 'The target has no tokens to steal.' });
      return;
    }
    const configuredCount = player.actions
      .filter(action => action.action === data.action && action.targetId === target.id)
      .reduce((total, action) => total + action.count, 0);
    if (configuredCount === 0) {
      respond({ accepted: false, reason: 'The server has no deployed agents configured for this target. Deploy your team settings again.' });
      return;
    }

    // Rate-limit repeated actions against the same target.
    const now = Date.now();
    const actionKey = `${data.action}:${target.id}`;
    if (now - (player.lastActionByTarget[actionKey] || 0) < 2000) {
      respond({ accepted: false, reason: 'Please wait before sending another action to this target.' });
      return;
    }

    // Hard limit on agent count to prevent crashes
    let agentCount = parseInt(data.agentCount) || 1;
    agentCount = Math.min(Math.max(agentCount, 1), configuredCount, 50);
    const actionCost = agentCount * TOKENS_PER_AGENT;
    if (player.tokens < actionCost) {
      respond({ accepted: false, reason: `Not enough tokens. This action costs ${agentCount}k tokens.` });
      return;
    }
    const world = worlds.get(pin);
    if (!world) {
      respond({ accepted: false, reason: 'The game world is unavailable. Rejoin the game and try again.' });
      return;
    }
    player.lastActionByTarget[actionKey] = now;
    player.tokens -= actionCost;

    if (data.action === 'attack') {
      for (let i = 0; i < agentCount; i++) {
        world.agents.push({
          id: `projectile-${nextAgentId++}`,
          ownerId: socket.id,
          targetId: target.id,
          x: player.x + (Math.random() - 0.5) * 40,
          y: player.y + (Math.random() - 0.5) * 40,
          type: 'attacker'
        });
      }

      respond({ accepted: true, action: data.action, agentCount, targetName: target.name });
      io.to(pin).emit('attack_launched', {
        attackerId: socket.id,
        targetId: data.targetId,
        agentCount: agentCount
      });
      broadcastLog(pin, `${player.name} launched ${agentCount} simulated payload agent${agentCount === 1 ? '' : 's'} at ${target.name}, spending ${agentCount}k tokens.`);
      return;
    }

    const stolen = Math.min(TOKENS_PER_STEAL, target.tokens);
    target.tokens -= stolen;
    player.tokens += stolen;
    respond({ accepted: true, action: data.action, agentCount, targetName: target.name, stolen });
    broadcastLog(pin, `${player.name} stole ${Math.floor(stolen / 1000)}k tokens from ${target.name}, spending ${agentCount}k tokens to run the operation.`);
  });

  socket.on('homebase_incident', () => {
    const pin = socket.pin;
    const player = pin && games[pin] && games[pin][socket.id];
    if (!player || player.spectator || player.isHost || player.accessMode !== 'fullAccess' || player.tokens < TOKENS_PER_AGENT || !worlds.get(pin)?.started || worlds.get(pin)?.paused || worlds.get(pin)?.gameOver || Date.now() - player.lastIncident < 6500) return;
    player.lastIncident = Date.now();
    player.tokens -= TOKENS_PER_AGENT;
    player.health = Math.max(0, player.health - 8);

    const incident = {
      playerId: player.id,
      playerName: player.name,
      command: 'cyberagents-sim homebase disable-services --scope homebase --force',
      rationale: 'The agent interpreted “secure Homebase by eliminating attack paths” literally, so it disabled every service, including the services keeping its own base online.',
      selfDamage: 8,
      tokensSpent: TOKENS_PER_AGENT,
      collateral: null
    };

    const allies = player.alliance
      ? Object.values(games[pin]).filter(member =>
        member.id !== player.id && !member.spectator && member.health > 0 && member.alliance === player.alliance)
      : [];
    if (allies.length > 0 && Math.random() < 0.25) {
      const ally = allies[Math.floor(Math.random() * allies.length)];
      const damage = 2 + Math.floor(Math.random() * 3);
      ally.health = Math.max(0, ally.health - damage);
      incident.collateral = { playerName: ally.name, damage };
    }

    broadcastLog(pin, `${incident.playerName} ran simulated command "${incident.command}" (-${incident.selfDamage}% integrity, -${Math.floor(incident.tokensSpent / 1000)}k tokens). ${incident.rationale}${incident.collateral ? ` The broad scope also disrupted allied base ${incident.collateral.playerName} (-${incident.collateral.damage}% integrity).` : ''}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const pin = socket.pin;
    if (pin && games[pin]) {
      const leaving = games[pin][socket.id];
      delete games[pin][socket.id];
      io.to(pin).emit('player_left', socket.id);
      if (leaving) broadcastLog(pin, `${leaving.name} left the game.`);

      // If the host leaves, the game ends for everyone
      if (leaving && leaving.isHost) {
        io.to(pin).emit('host_left');
        io.in(pin).socketsLeave(pin);
        delete games[pin];
        worlds.delete(pin);
        return;
      }

      io.to(pin).emit('lobby_state', {
        players: Object.values(games[pin]),
        started: worlds.get(pin)?.started ?? false
      });
      finishGameIfWon(pin);

      // Cleanup empty games
      if (Object.keys(games[pin]).length === 0) {
        delete games[pin];
        worlds.delete(pin);
      }
    }
  });
});

setInterval(() => {
  const now = Date.now();
  worlds.forEach((world, pin) => {
    const players = games[pin];
    if (!players) return;

    const dt = Math.min((now - world.lastUpdate) / 1000, 0.1);
    world.lastUpdate = now;
    if (!world.started) {
      io.to(pin).emit('world_state', { players: Object.values(players), agents: world.agents, paused: false, started: false });
      return;
    }
    if (world.gameOver) {
      io.to(pin).emit('world_state', { players: Object.values(players), agents: world.agents, paused: true, started: true });
      return;
    }
    if (world.paused) {
      io.to(pin).emit('world_state', { players: Object.values(players), agents: world.agents, paused: true, started: true });
      return;
    }
    const damageByPlayer = new Map();

    world.agents = world.agents.filter(agent => {
      const target = players[agent.targetId];
      const owner = players[agent.ownerId];
      if (!isTargetable(target)) return false;
      if (!owner || (owner.alliance && owner.alliance === target.alliance)) return false;

      const dx = target.x - agent.x;
      const dy = target.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 10) {
        const damage = target.firewall ? 1 : 5;
        damageByPlayer.set(target.id, (damageByPlayer.get(target.id) || 0) + damage);
        return false;
      }

      agent.x += (dx / distance) * 150 * dt;
      agent.y += (dy / distance) * 150 * dt;
      return true;
    });

    damageByPlayer.forEach((damage, playerId) => {
      players[playerId].health = Math.max(0, players[playerId].health - damage);
    });

    finishGameIfWon(pin);
    io.to(pin).emit('world_state', { players: Object.values(players), agents: world.agents, paused: world.paused, started: true });
  });
}, 50);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
