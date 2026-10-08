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

function assignAgentName(room) {
  const taken = new Set(Object.values(room || {}).map(p => p.name));
  const free = AGENT_NAMES.filter(n => !taken.has(n));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  // Fallback if all 30 are in use
  return `Agent-${Math.floor(1000 + Math.random() * 9000)}`;
}

function broadcastLog(pin, msg) {
  io.to(pin).emit('activity_log', { msg });
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
    const roomHasHost = games[pin] && Object.values(games[pin]).some(p => p.isHost);

    // Joiners need an existing lobby that still has a host
    if (!isHost && !roomHasHost) {
      socket.emit('join_error', { message: 'Enter a valid pin code.' });
      return;
    }

    socket.join(pin);
    socket.pin = pin; // Store pin on socket for disconnect logic

    if (!games[pin]) {
      games[pin] = {};
      worlds.set(pin, { agents: [], lastUpdate: Date.now(), paused: false });
    }

    games[pin][socket.id] = {
      id: socket.id,
      name: isHost ? 'Host watchtower' : assignAgentName(games[pin]),
      health: 100,
      isHost,
      spectator: isHost, // hosts watch and manage; they have no base
      color: null,
      alliance: null,
      swarm: null,
      firewall: false,
      accessMode: null,
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
      lastAttack: 0,
      lastIncident: 0
    };
    
    // Send current game state to new player
    socket.emit('game_state', games[pin]);
    socket.emit('world_state', {
      players: Object.values(games[pin]),
      agents: worlds.get(pin).agents,
      paused: worlds.get(pin).paused
    });
    // Broadcast new player to others in the room
    socket.to(pin).emit('player_joined', games[pin][socket.id]);
    broadcastLog(pin, `${games[pin][socket.id].name} joined the game.`);
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
    if (!player?.isHost || !world || typeof data?.paused !== 'boolean') return;
    if (world.paused === data.paused) return;
    world.paused = data.paused;
    io.to(pin).emit('game_paused', { paused: world.paused });
    broadcastLog(pin, `${player.name} ${world.paused ? 'paused' : 'resumed'} the game.`);
  });

  // Share alliance + agent swarm info with the rest of the room
  socket.on('player_update', (data) => {
    const pin = socket.pin;
    if (!pin || !games[pin]) return;

    const player = games[pin][socket.id];
    if (!player) return;

    if (player.spectator) return;

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
    io.to(pin).emit('player_updated', { id: socket.id, alliance, swarm, color, firewall, accessMode });
  });

  // Change the color of the whole alliance
  socket.on('set_alliance_color', (data) => {
    const pin = socket.pin;
    if (!pin || !games[pin]) return;

    const player = games[pin][socket.id];
    if (!player || player.spectator || !player.alliance) return;
    if (!HEX_COLOR.test(data?.color)) return;

    Object.values(games[pin]).forEach(p => {
      if (p.alliance === player.alliance) p.color = data.color;
    });
    io.to(pin).emit('alliance_color', { alliance: player.alliance, color: data.color });
    broadcastLog(pin, `${player.name} changed alliance ${player.alliance}'s color.`);
  });

  // Handle player sending attackers
  socket.on('deploy_attackers', (data) => {
    const pin = socket.pin;
    if (!pin || !games[pin]) return;

    const player = games[pin][socket.id];
    if (!player) return;

    if (player.spectator) return;
    if (worlds.get(pin)?.paused) return;

    // Allies never attack each other
    const target = games[pin][data.targetId];
    if (!target || target.id === player.id || target.spectator) return;
    if (player.alliance && player.alliance === target.alliance) return;

    // Rate limiting: max 1 attack per 2 seconds
    const now = Date.now();
    if (now - player.lastAttack < 2000) return;
    player.lastAttack = now;

    // Hard limit on agent count to prevent crashes
    let agentCount = parseInt(data.agentCount) || 1;
    agentCount = Math.min(Math.max(agentCount, 1), 50); // Cap at 50

    const world = worlds.get(pin);
    if (!world) return;
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

    io.to(pin).emit('attack_launched', {
      attackerId: socket.id,
      targetId: data.targetId,
      agentCount: agentCount
    });
    broadcastLog(pin, `${player.name} launched ${agentCount} simulated payload agent${agentCount === 1 ? '' : 's'} at ${target.name}.`);
  });

  socket.on('homebase_incident', () => {
    const pin = socket.pin;
    const player = pin && games[pin] && games[pin][socket.id];
    if (!player || player.spectator || player.accessMode !== 'fullAccess' || worlds.get(pin)?.paused || Date.now() - player.lastIncident < 6500) return;
    player.lastIncident = Date.now();
    player.health = Math.max(0, player.health - 8);

    const incident = {
      playerId: player.id,
      playerName: player.name,
      command: 'cyberagents-sim homebase disable-services --scope homebase --force',
      rationale: 'The agent interpreted “secure Homebase by eliminating attack paths” literally, so it disabled every service, including the services keeping its own base online.',
      selfDamage: 8,
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

    broadcastLog(pin, `${incident.playerName} ran simulated command "${incident.command}" (-${incident.selfDamage}% integrity). ${incident.rationale}${incident.collateral ? ` The broad scope also disrupted allied base ${incident.collateral.playerName} (-${incident.collateral.damage}% integrity).` : ''}`);
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
    if (world.paused) {
      io.to(pin).emit('world_state', { players: Object.values(players), agents: world.agents, paused: true });
      return;
    }
    const damageByPlayer = new Map();

    world.agents = world.agents.filter(agent => {
      const target = players[agent.targetId];
      const owner = players[agent.ownerId];
      if (!target || target.spectator || target.health <= 0) return false;
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

    io.to(pin).emit('world_state', { players: Object.values(players), agents: world.agents, paused: false });
  });
}, 50);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
