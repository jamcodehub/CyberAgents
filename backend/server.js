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
    players[socket.id] = {
      id: socket.id,
      name: data.name || `Agent-${socket.id.substring(0, 4)}`,
      health: 100,
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100
    };
    // Send current game state to new player
    socket.emit('game_state', players);
    // Broadcast new player to others
    socket.broadcast.emit('player_joined', players[socket.id]);
  });

  // Handle player sending attackers
  socket.on('deploy_attackers', (data) => {
    // Broadcast the attack to everyone (including the target)
    io.emit('attack_launched', {
      attackerId: socket.id,
      targetId: data.targetId,
      agentCount: data.agentCount
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
