import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Navigation from './components/Navigation';
import Battlefield from './pages/Battlefield';
import ActivityLog from './pages/ActivityLog';
import Intel from './pages/Intel';
import Lobby from './pages/Lobby';
import './index.css';

export default function App() {
  const [active, setActive] = useState(false);
  const [socket, setSocket] = useState(null);
  const [myId, setMyId] = useState(null);
  const [pin, setPin] = useState(null);
  const [playerName, setPlayerName] = useState('');
  
  const [castles, setCastles] = useState([]);
  const [agents, setAgents] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const requestRef = useRef(null);
  const stateRef = useRef({ castles: [], agents: [] });

  useEffect(() => {
    stateRef.current = { castles, agents };
  }, [castles, agents]);

  const addLog = (msg) => {
    setLogs(prev => {
      const newLogs = [{ time: new Date().toLocaleTimeString(), msg }, ...prev];
      return newLogs.slice(0, 100); 
    });
  };

  const joinGame = (name, gamePin) => {
    setPlayerName(name);
    setPin(gamePin);
    
    if (socket) socket.disconnect();
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const newSocket = io(backendUrl);
    
    newSocket.on('connect', () => {
      setMyId(newSocket.id);
      newSocket.emit('join_game', { name, pin: gamePin });
      addLog(`Connected to network [${gamePin}] as ${name}`);
      setActive(true);
    });

    newSocket.on('game_state', (players) => {
      const newCastles = Object.values(players).map(p => ({
        ...p,
        isSelf: p.id === newSocket.id,
        attackConfig: null,
        defendConfig: null
      }));
      setCastles(newCastles);
    });

    newSocket.on('player_joined', (player) => {
      setCastles(prev => [...prev.filter(c => c.id !== player.id), { ...player, isSelf: false }]);
      addLog(`Entity joined the network: ${player.name}`);
    });

    newSocket.on('player_left', (playerId) => {
      setCastles(prev => {
        const p = prev.find(c => c.id === playerId);
        if (p) addLog(`Entity disconnected: ${p.name}`);
        return prev.filter(c => c.id !== playerId);
      });
    });

    newSocket.on('attack_launched', (data) => {
      const { attackerId, targetId, agentCount } = data;
      const { castles } = stateRef.current;
      const attacker = castles.find(c => c.id === attackerId);
      const target = castles.find(c => c.id === targetId);
      
      if (attacker && target) {
        spawnAgents(attackerId, targetId, attacker.x, attacker.y, agentCount, 'attacker');
        if (targetId === newSocket.id) {
          addLog(`WARNING: Incoming attack from ${attacker.name}! (${agentCount} agents)`);
        } else if (attackerId === newSocket.id) {
          addLog(`Deployed ${agentCount} agents to attack ${target.name}.`);
        }
      }
    });

    setSocket(newSocket);
  };

  const connectGame = (parsedAttack, parsedDefend) => {
    if (socket) {
      setCastles(prev => prev.map(c => 
        c.isSelf ? { ...c, attackConfig: parsedAttack, defendConfig: parsedDefend } : c
      ));
      addLog(`Configuration updated successfully.`);
    }
  };

  useEffect(() => {
    if (!active) return;
    let lastTime = performance.now();
    let attackCooldown = 0;

    const update = (time) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      
      const { castles, agents } = stateRef.current;
      
      const me = castles.find(c => c.isSelf);
      if (me && me.health > 0 && socket && me.attackConfig) {
        attackCooldown -= dt;
        if (attackCooldown <= 0) {
          attackCooldown = 2.5; 
          const target = castles.find(c => c.name === me.attackConfig.target || c.id === me.attackConfig.target);
          if (target && target.id !== me.id) {
            socket.emit('deploy_attackers', {
              targetId: target.id,
              agentCount: me.attackConfig.agentCount
            });
          }
        }
      }

      if (agents.length > 0) {
        setAgents(prevAgents => {
          let newAgents = [];
          setCastles(currentCastles => {
            let updatedCastles = [...currentCastles];
            
            prevAgents.forEach(agent => {
              const targetCastle = updatedCastles.find(c => c.id === agent.targetId);
              if (!targetCastle || targetCastle.health <= 0) return;
              
              const dx = targetCastle.x - agent.x;
              const dy = targetCastle.y - agent.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              
              if (dist < 10) {
                const castleIndex = updatedCastles.findIndex(c => c.id === targetCastle.id);
                if (castleIndex !== -1) {
                  let damage = 5;
                  if (updatedCastles[castleIndex].defendConfig?.firewallActive) damage = 1;
                  updatedCastles[castleIndex].health = Math.max(0, updatedCastles[castleIndex].health - damage);
                }
              } else {
                const speed = 150;
                newAgents.push({
                  ...agent,
                  x: agent.x + (dx / dist) * speed * dt,
                  y: agent.y + (dy / dist) * speed * dt
                });
              }
            });
            return updatedCastles;
          });
          return newAgents;
        });
      }

      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [active, socket]);

  const spawnAgents = (ownerId, targetId, x, y, count, type) => {
    setAgents(prev => {
      const newAgents = [];
      for (let i = 0; i < count; i++) {
        newAgents.push({
          id: Math.random().toString(36).substr(2, 9),
          ownerId,
          targetId,
          x: x + (Math.random() - 0.5) * 40,
          y: y + (Math.random() - 0.5) * 40,
          type
        });
      }
      return [...prev, ...newAgents];
    });
  };

  const sharedState = {
    castles,
    agents,
    logs,
    active,
    connectGame,
    myId,
    pin
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        {active && <Navigation pin={pin} />}
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/lobby" />} />
            <Route path="/lobby" element={<Lobby joinGame={joinGame} />} />
            {active && (
              <>
                <Route path="/battlefield" element={<Battlefield {...sharedState} />} />
                <Route path="/logs" element={<ActivityLog logs={logs} />} />
                <Route path="/intel" element={<Intel castles={castles} />} />
              </>
            )}
            {!active && <Route path="*" element={<Navigate to="/lobby" />} />}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
