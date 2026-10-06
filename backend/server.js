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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Register new player in a specific game room
  socket.on('join_game', (data) => {
    const pin = data.pin;
    if (!pin) return;
    
    const isHost = data.isHost === true;
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
    }

    const safeName = String(data.name || `Agent-${socket.id.substring(0, 4)}`).substring(0, 20);
    games[pin][socket.id] = {
      id: socket.id,
      name: safeName,
      health: 100,
      isHost,
      alliance: null,
      swarm: null,
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
      lastAttack: 0
    };
    
    // Send current game state to new player
    socket.emit('game_state', games[pin]);
    // Broadcast new player to others in the room
    socket.to(pin).emit('player_joined', games[pin][socket.id]);
  });

  // Share alliance + agent swarm info with the rest of the room
  socket.on('player_update', (data) => {
    const pin = socket.pin;
    if (!pin || !games[pin]) return;

    const player = games[pin][socket.id];
    if (!player) return;

    const alliance = typeof data?.alliance === 'string'
      ? data.alliance.trim().substring(0, 20) || null
      : null;
    const clamp = (n) => Math.min(Math.max(parseInt(n) || 0, 0), 50);
    const swarm = data?.swarm
      ? { red: clamp(data.swarm.red), blue: clamp(data.swarm.blue) }
      : null;

    player.alliance = alliance;
    player.swarm = swarm;
    io.to(pin).emit('player_updated', { id: socket.id, alliance, swarm });
  });

  // Handle player sending attackers
  socket.on('deploy_attackers', (data) => {
    const pin = socket.pin;
    if (!pin || !games[pin]) return;

    const player = games[pin][socket.id];
    if (!player) return;

    // Allies never attack each other
    const target = games[pin][data.targetId];
    if (!target || target.id === player.id) return;
    if (player.alliance && player.alliance === target.alliance) return;

    // Rate limiting: max 1 attack per 2 seconds
    const now = Date.now();
    if (now - player.lastAttack < 2000) return;
    player.lastAttack = now;

    // Hard limit on agent count to prevent crashes
    let agentCount = parseInt(data.agentCount) || 1;
    agentCount = Math.min(Math.max(agentCount, 1), 50); // Cap at 50

    io.to(pin).emit('attack_launched', {
      attackerId: socket.id,
      targetId: data.targetId,
      agentCount: agentCount
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const pin = socket.pin;
    if (pin && games[pin]) {
      delete games[pin][socket.id];
      io.to(pin).emit('player_left', socket.id);
      
      // Cleanup empty games
      if (Object.keys(games[pin]).length === 0) {
        delete games[pin];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
