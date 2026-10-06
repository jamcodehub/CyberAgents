import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Navigation from './components/Navigation';
import ConfigPanel from './components/ConfigPanel';
import IntelPanel from './components/IntelPanel';
import LogPanel from './components/LogPanel';
import AlliancePanel, { ALLIANCE_COLORS } from './components/AlliancePanel';
import AgentSwarm from './components/AgentSwarm';
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
  const [lobbyError, setLobbyError] = useState('');
  const [isHost, setIsHost] = useState(false);
  
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

  const joinGame = (gamePin, isHost = false) => {
    setPin(gamePin);
    setIsHost(isHost);
    setLobbyError('');

    if (socket) socket.disconnect();

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const newSocket = io(backendUrl);
    let entered = false;
    let joinTimer = null;
    let named = false;

    const rejectJoin = (message) => {
      clearTimeout(joinTimer);
      newSocket.disconnect();
      setSocket(null);
      setPin(null);
      setActive(false);
      setCastles([]);
      setAgents([]);
      setLogs([]);
      setStewardship(0);
      setPendingTask(null);
      setOpenPanel(null);
      setIsHost(false);
      setLobbyError(message);
    };

    newSocket.on('connect', () => {
      setMyId(newSocket.id);
      newSocket.emit('join_game', { pin: gamePin, isHost });
      addLog(`Connected to network [${gamePin}]`);
      if (isHost) {
        entered = true;
        setActive(true);
      } else {
        // Joiners only enter once the lobby proves it has a host.
        joinTimer = setTimeout(() => {
          if (!entered) rejectJoin('Enter a valid pin code.');
        }, 4000);
      }
    });

    newSocket.on('connect_error', () => {
      if (!entered) rejectJoin('Cannot reach the server. Try again.');
    });

    newSocket.on('join_error', (e) => rejectJoin(e?.message || 'Enter a valid pin code.'));
    newSocket.on('host_left', () => rejectJoin('The host ended the game.'));

    newSocket.on('game_state', (players) => {
      const list = Object.values(players);
      if (!entered) {
        const others = list.filter(p => p.id !== newSocket.id).length;
        if (others === 0) {
          rejectJoin('Enter a valid pin code.');
          return;
        }
        entered = true;
        clearTimeout(joinTimer);
        setActive(true);
      }
      const me = list.find(p => p.id === newSocket.id);
      if (me && !named) {
        named = true;
        addLog(`Assigned codename: ${me.name}`);
      }
      const previous = stateRef.current.castles;
      setCastles(list.filter(p => !p.spectator).map(p => {
        const prev = previous.find(c => c.id === p.id);
        return {
          ...p,
          isSelf: p.id === newSocket.id,
          teamConfig: prev?.teamConfig ?? null,
          alliance: p.alliance ?? prev?.alliance ?? null,
          color: p.color ?? prev?.color ?? null,
          swarm: p.swarm ?? prev?.swarm ?? null
        };
      }));
    });

    newSocket.on('player_joined', (player) => {
      if (player.spectator) return;
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

    newSocket.on('player_updated', ({ id, alliance, swarm, color }) => {
      if (id === newSocket.id) return;
      const before = stateRef.current.castles.find(c => c.id === id);
      if (isHost && before && (before.alliance ?? null) !== (alliance ?? null)) {
        addLog(alliance ? `${before.name} joined alliance ${alliance}.` : `${before.name} left alliance ${before.alliance}.`);
      }
      setCastles(prev => prev.map(c => c.id === id
        ? { ...c, alliance: alliance ?? null, swarm: swarm ?? null, color: color ?? null }
        : c));
    });

    newSocket.on('alliance_color', ({ alliance, color }) => {
      setCastles(prev => prev.map(c => c.alliance === alliance ? { ...c, color } : c));
    });

    newSocket.on('attack_launched', (data) => {
      const { attackerId, targetId, agentCount } = data;
      const { castles } = stateRef.current;
      const attacker = castles.find(c => c.id === attackerId);
      const target = castles.find(c => c.id === targetId);
      
      if (attacker && target) {
        if (attacker.alliance && attacker.alliance === target.alliance) return;
        spawnAgents(attackerId, targetId, attacker.x, attacker.y, agentCount, 'attacker');
        if (targetId === newSocket.id) {
          addLog(`WARNING: Incoming attack from ${attacker.name}! (${agentCount} agents)`);
        } else if (attackerId === newSocket.id) {
          addLog(`Deployed ${agentCount} agents to attack ${target.name}.`);
        } else if (isHost) {
          addLog(`${attacker.name} sent ${agentCount} agents at ${target.name}.`);
        }
      }
    });

    setSocket(newSocket);
  };

  // Shares alliance + agent-swarm info with the other players (needs the server relay).
  const broadcastSelf = (overrides = {}) => {
    if (!socket) return;
    const me = stateRef.current.castles.find(c => c.isSelf);
    socket.emit('player_update', {
      alliance: me?.alliance ?? null,
      swarm: me?.swarm ?? null,
      color: me?.color ?? null,
      ...overrides
    });
  };

  const setMyAlliance = (alliance, pickedColor) => {
    const teammate = alliance
      ? stateRef.current.castles.find(c => !c.isSelf && c.alliance === alliance)
      : null;
    const color = alliance ? (teammate?.color ?? pickedColor ?? ALLIANCE_COLORS[0]) : null;
    setCastles(prev => prev.map(c => c.isSelf ? { ...c, alliance, color } : c));
    broadcastSelf({ alliance, color });
    addLog(alliance
      ? `Joined alliance ${alliance}. Allied bases will not attack each other.`
      : 'Left alliance.');
  };

  const setAllianceColor = (color) => {
    const me = stateRef.current.castles.find(c => c.isSelf);
    if (!me?.alliance) return;
    setCastles(prev => prev.map(c => c.alliance === me.alliance ? { ...c, color } : c));
    if (socket) socket.emit('set_alliance_color', { color });
  };

  const leaveGame = () => {
    if (socket) socket.disconnect();
    setSocket(null);
    setActive(false);
    setPin(null);
    setMyId(null);
    setIsHost(false);
    setCastles([]);
    setAgents([]);
    setLogs([]);
    setStewardship(0);
    setPendingTask(null);
    setOpenPanel(null);
    nextTaskIndexRef.current = 0;
  };

  const connectGame = (parsedConfig) => {
    if (socket) {
      setCastles(prev => prev.map(c => 
        c.isSelf ? { ...c, teamConfig: parsedConfig, swarm: parsedConfig.swarm } : c
      ));
      broadcastSelf({ swarm: parsedConfig.swarm });
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
          (me.teamConfig.attacks || []).forEach(({ targetId, count }) => {
            const target = castles.find(c => c.id === targetId);
            if (!target || target.id === me.id || target.health <= 0) return;
            if (me.alliance && me.alliance === target.alliance) return;
            if (count > 0) {
              socket.emit('deploy_attackers', { targetId: target.id, agentCount: count });
            }
          });
        }
      }

      if (agents.length > 0) {
        // Compute this frame from the latest snapshot, then apply immutable updates once.
        const moved = new Map();
        const gone = new Set();
        const damageByCastle = {};

        agents.forEach(agent => {
          const targetCastle = castles.find(c => c.id === agent.targetId);
          if (!targetCastle || targetCastle.health <= 0) { gone.add(agent.id); return; }
          const owner = castles.find(c => c.id === agent.ownerId);
          if (owner?.alliance && owner.alliance === targetCastle.alliance) { gone.add(agent.id); return; }

          const dx = targetCastle.x - agent.x;
          const dy = targetCastle.y - agent.y;
          const dist = Math.sqrt(dx*dx + dy*dy);

          if (dist < 10) {
            // If target has defense role, reduce damage
            const damage = targetCastle.teamConfig?.roles?.defense?.firewall ? 1 : 5;
            damageByCastle[targetCastle.id] = (damageByCastle[targetCastle.id] || 0) + damage;
            gone.add(agent.id);
          } else {
            const speed = 150;
            moved.set(agent.id, {
              ...agent,
              x: agent.x + (dx / dist) * speed * dt,
              y: agent.y + (dy / dist) * speed * dt
            });
          }
        });

        setAgents(prev => prev.filter(a => !gone.has(a.id)).map(a => moved.get(a.id) ?? a));
        if (Object.keys(damageByCastle).length > 0) {
          setCastles(prev => prev.map(c => damageByCastle[c.id]
            ? { ...c, health: Math.max(0, c.health - damageByCastle[c.id]) }
            : c));
        }
      }

      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [active, socket]);

  // Hosts spectate: no agent config, and menus are numbered by what is available
  const panelOrder = isHost
    ? [null, 'intel', 'logs', 'alliances']
    : [null, 'config', 'intel', 'logs', 'alliances'];

  // When your base is destroyed, return to the lobby so you can rejoin as a new agent
  const selfDestroyed = castles.some(c => c.isSelf && c.health <= 0);
  useEffect(() => {
    if (!active || !selfDestroyed) return undefined;
    const timer = setTimeout(() => {
      leaveGame();
      setLobbyError('Your base was destroyed. Join again as a new agent.');
    }, 3000);
    return () => clearTimeout(timer);
  }, [active, selfDestroyed]);

  useEffect(() => {
    if (!active) return undefined;
    const PANEL_KEYS = Object.fromEntries(panelOrder.map((panel, i) => [String(i + 1), panel]));

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
      if (event.key === 'Escape') {
        setOpenPanel(null);
        return;
      }
      if (Object.hasOwn(PANEL_KEYS, event.key)) {
        const panel = PANEL_KEYS[event.key];
        setOpenPanel(prev => (panel === null || prev === panel ? null : panel));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, isHost]);

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
    return <Lobby joinGame={joinGame} lobbyError={lobbyError} />;
  }

  const togglePanel = (panelName) => {
    setOpenPanel(prev => prev === panelName ? null : panelName);
  };

  const aliveBots = castles.filter(c => !c.isSelf && c.health > 0).length;
  const player = castles.find(c => c.isSelf);

  return (
    <div className="app-container">
      <Navigation pin={pin} openPanel={openPanel} onTogglePanel={togglePanel} onLeave={leaveGame} panels={panelOrder} isHost={isHost} />
      
      {/* Sliding Panels */}
      {!isHost && (
        <ConfigPanel
          isOpen={openPanel === 'config'}
          connectGame={connectGame}
          active={active}
          players={castles.filter(c => !c.isSelf)}
          myAlliance={player?.alliance ?? null}
        />
      )}
      <IntelPanel isOpen={openPanel === 'intel'} castles={castles} spectator={isHost} />
      <LogPanel isOpen={openPanel === 'logs'} logs={logs} />
      <AlliancePanel
        isOpen={openPanel === 'alliances'}
        castles={castles}
        myAlliance={player?.alliance ?? null}
        myColor={player?.color ?? null}
        onSetAlliance={setMyAlliance}
        onSetAllianceColor={setAllianceColor}
        spectator={isHost}
      />

      {/* Battlefield (Background) */}
      <div className="battlefield" style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        <div className="status-panel">
          <h3>&gt; NETWORK_STATUS</h3>
          {isHost ? (
            <div className="access-status">HOST: SPECTATING</div>
          ) : (
            <div className="status-item">
              <span>Your Castle Integrity:</span>
              <span>{Math.floor(player?.health || 0)}%</span>
            </div>
          )}
          <div className="status-item">
            <span>Active Enemy Nodes:</span>
            <span>{aliveBots}</span>
          </div>
          <div className="status-item">
            <span>Agents In Transit:</span>
            <span>{agents.length}</span>
          </div>
          {!isHost && (
            <div className="status-item">
              <span>Stewardship:</span>
              <span>{stewardship}</span>
            </div>
          )}
          {player?.teamConfig && (
            <div className="access-status">
              HOMEBASE POLICY: {player.teamConfig.accessMode === 'fullAccess' ? 'FULL ACCESS' : 'APPROVAL REQUIRED'}
            </div>
          )}
          {player?.alliance && (
            <div className="access-status">ALLIANCE: {player.alliance}</div>
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
              BASE DESTROYED. RETURNING TO LOBBY...
            </div>
          )}
        </div>

        {castles.map(castle => (
          castle.health > 0 && (
            <div
              key={castle.id}
              className={`castle ${castle.isSelf ? 'self' : 'enemy'} ${castle.color ? 'allied' : ''}`}
              style={{ left: castle.x, top: castle.y, '--base-color': castle.color || undefined }}
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

        {castles.map(castle => (
          castle.health > 0 && castle.swarm && (castle.swarm.red > 0 || castle.swarm.blue > 0) && (
            <AgentSwarm
              key={`swarm-${castle.id}`}
              x={castle.x}
              y={castle.y}
              red={castle.swarm.red}
              blue={castle.swarm.blue}
            />
          )
        ))}

        {agents.map(agent => (
          <div
            key={agent.id}
            className={`agent ${agent.type}`}
            style={{ transform: `translate3d(${agent.x - 4}px, ${agent.y - 4}px, 0)` }}
          />
        ))}
      </div>
    </div>
  );
}
