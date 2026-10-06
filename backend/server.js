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

let players = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Register new player
  socket.on('join_game', (data) => {
    const safeName = String(data.name || `Agent-${socket.id.substring(0, 4)}`).substring(0, 20);
    players[socket.id] = {
      id: socket.id,
      name: safeName,
      health: 100,
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
      lastAttack: 0
    };
    // Send current game state to new player
    socket.emit('game_state', players);
    // Broadcast new player to others
    socket.broadcast.emit('player_joined', players[socket.id]);
  });

  // Handle player sending attackers
  socket.on('deploy_attackers', (data) => {
    const player = players[socket.id];
    if (!player) return;

    // Rate limiting: max 1 attack per 2 seconds
    const now = Date.now();
    if (now - player.lastAttack < 2000) return;
    player.lastAttack = now;

    // Hard limit on agent count to prevent crashes
    let agentCount = parseInt(data.agentCount) || 1;
    agentCount = Math.min(Math.max(agentCount, 1), 50); // Cap at 50

    io.emit('attack_launched', {
      attackerId: socket.id,
      targetId: data.targetId,
      agentCount: agentCount
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    io.emit('player_left', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
