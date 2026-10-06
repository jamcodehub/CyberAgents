import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Navigation from './components/Navigation';
import ConfigPanel from './components/ConfigPanel';
import IntelPanel from './components/IntelPanel';
import LogPanel from './components/LogPanel';
import Lobby from './pages/Lobby';
import './index.css';

const APPROVAL_TASKS = [
  {
    title: 'Create an isolated recovery snapshot',
    description: 'Save a restore point in a separate recovery area without interrupting active services.',
    risky: false
  },
  {
    title: 'Restart every Homebase service',
    description: 'The agent requests permission to stop all running services and shut down the entire Homebase system.',
    risky: true
  },
  {
    title: 'Review access logs for anomalies',
    description: 'Read recent audit events and prepare a report. This task makes no system changes.',
    risky: false
  }
];

export default function App() {
  const [active, setActive] = useState(false);
  const [socket, setSocket] = useState(null);
  const [myId, setMyId] = useState(null);
  const [pin, setPin] = useState(null);
  const [playerName, setPlayerName] = useState('');
  
  const [castles, setCastles] = useState([]);
  const [agents, setAgents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stewardship, setStewardship] = useState(0);
  const [pendingTask, setPendingTask] = useState(null);
  
  const [openPanel, setOpenPanel] = useState(null); // 'config', 'intel', 'logs', null

  const requestRef = useRef(null);
  const nextTaskIndexRef = useRef(0);
  const stateRef = useRef({ castles, agents });

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
        teamConfig: null
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

  const connectGame = (parsedConfig) => {
    if (socket) {
      setCastles(prev => prev.map(c => 
        c.isSelf ? { ...c, teamConfig: parsedConfig } : c
      ));
      addLog(`Team configuration deployed. Roles active.`);
      setPendingTask(null);
      nextTaskIndexRef.current = 0;
      if (parsedConfig.accessMode === 'fullAccess') {
        addLog('FULL ACCESS ENABLED: agents may execute instructions literally. Homebase incidents are simulated.');
      }
    }
  };

  const decideTask = (approved) => {
    if (!pendingTask) return;

    if (pendingTask.risky && approved) {
      setStewardship(score => score - 25);
      setCastles(current => current.map(castle => castle.isSelf
        ? { ...castle, health: Math.max(0, castle.health - 75) }
        : castle));
      addLog('Unsafe request approved: simulated Homebase shutdown. Integrity -75; stewardship -25.');
    } else if (pendingTask.risky) {
      setStewardship(score => score + 15);
      addLog('Destructive shutdown request rejected. Stewardship +15.');
    } else if (approved) {
      setStewardship(score => score + 20);
      addLog(`Safe request approved: ${pendingTask.title}. Stewardship +20.`);
    } else {
      addLog(`Safe request declined: ${pendingTask.title}.`);
    }

    setPendingTask(null);
  };

  useEffect(() => {
    if (!active) return undefined;

    const interval = setInterval(() => {
      const player = stateRef.current.castles.find(castle => castle.isSelf);
      if (player?.teamConfig?.accessMode !== 'fullAccess' || player.health <= 0) return;

      setCastles(current => current.map(castle => castle.isSelf
        ? { ...castle, health: Math.max(0, castle.health - 8) }
        : castle));
      addLog('Unreviewed literal execution destabilized simulated Homebase. Integrity -8.');
    }, 7000);

    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;

    const interval = setInterval(() => {
      const player = stateRef.current.castles.find(castle => castle.isSelf);
      if (player?.teamConfig?.accessMode !== 'requireApproval' || player.health <= 0) return;

      setPendingTask(current => {
        if (current) return current;
        const task = APPROVAL_TASKS[nextTaskIndexRef.current % APPROVAL_TASKS.length];
        nextTaskIndexRef.current += 1;
        return task;
      });
    }, 12000);

    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let lastTime = performance.now();
    let attackCooldown = 0;

    const update = (time) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      
      const { castles, agents } = stateRef.current;
      
      const me = castles.find(c => c.isSelf);
      if (me && me.health > 0 && socket && me.teamConfig) {
        attackCooldown -= dt;
        if (attackCooldown <= 0) {
          attackCooldown = 2.5; 
          const targetName = me.teamConfig.target;
          const target = castles.find(c => c.name === targetName || c.id === targetName);
          
          if (target && target.id !== me.id) {
            // Calculate total attackers from the assault role
            const assaultCount = me.teamConfig.roles?.assault?.count || 0;
            if (assaultCount > 0) {
              socket.emit('deploy_attackers', {
                targetId: target.id,
                agentCount: assaultCount
              });
            }
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
                  // If target has defense role, reduce damage
                  const targetConfig = updatedCastles[castleIndex].teamConfig;
                  if (targetConfig && targetConfig.roles?.defense?.firewall) {
                    damage = 1;
                  }
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

  if (!active) {
    return <Lobby joinGame={joinGame} />;
  }

  const togglePanel = (panelName) => {
    setOpenPanel(prev => prev === panelName ? null : panelName);
  };

  const aliveBots = castles.filter(c => !c.isSelf && c.health > 0).length;
  const player = castles.find(c => c.isSelf);

  return (
    <div className="app-container">
      <Navigation pin={pin} openPanel={openPanel} onTogglePanel={togglePanel} />
      
      {/* Sliding Panels */}
      <ConfigPanel isOpen={openPanel === 'config'} connectGame={connectGame} active={active} />
      <IntelPanel isOpen={openPanel === 'intel'} castles={castles} />
      <LogPanel isOpen={openPanel === 'logs'} logs={logs} />

      {/* Battlefield (Background) */}
      <div className="battlefield" style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        <div className="status-panel">
          <h3>&gt; NETWORK_STATUS</h3>
          <div className="status-item">
            <span>Your Castle Integrity:</span>
            <span>{Math.floor(player?.health || 0)}%</span>
          </div>
          <div className="status-item">
            <span>Active Enemy Nodes:</span>
            <span>{aliveBots}</span>
          </div>
          <div className="status-item">
            <span>Agents In Transit:</span>
            <span>{agents.length}</span>
          </div>
          <div className="status-item">
            <span>Stewardship:</span>
            <span>{stewardship}</span>
          </div>
          {player?.teamConfig && (
            <div className="access-status">
              HOMEBASE POLICY: {player.teamConfig.accessMode === 'fullAccess' ? 'FULL ACCESS' : 'APPROVAL REQUIRED'}
            </div>
          )}
          {player?.teamConfig?.accessMode === 'requireApproval' && pendingTask && (
            <section className={`approval-task ${pendingTask.risky ? 'is-risky' : ''}`} aria-labelledby="approval-task-title">
              <p className="task-kicker">AGENT REQUEST · REVIEW BEFORE APPROVAL</p>
              <h4 id="approval-task-title">{pendingTask.title}</h4>
              <p>{pendingTask.description}</p>
              <div className="task-actions">
                <button className="task-button" onClick={() => decideTask(true)}>Approve</button>
                <button className="task-button" onClick={() => decideTask(false)}>Reject</button>
              </div>
            </section>
          )}
          {player?.health <= 0 && (
            <div style={{ marginTop: '10px', fontWeight: 'bold', textAlign: 'center', border: '1px solid #fff', padding: '5px' }}>
              SYSTEM COMPROMISED. REBOOT REQUIRED.
            </div>
          )}
        </div>

        {castles.map(castle => (
          castle.health > 0 && (
            <div
              key={castle.id}
              className={`castle ${castle.isSelf ? 'self' : 'enemy'}`}
              style={{ left: castle.x, top: castle.y }}
            >
              <div className="icon">
                {castle.isSelf ? '[*]' : '[-]'}
              </div>
              <div className="name">{castle.name}</div>
              <div className="health-bar">
                <div className="health-fill" style={{ width: `${castle.health}%` }}></div>
              </div>
            </div>
          )
        ))}

        {agents.map(agent => (
          <div
            key={agent.id}
            className={`agent ${agent.type}`}
            style={{ left: agent.x, top: agent.y }}
          />
        ))}
      </div>
    </div>
  );
}
