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
  const [isPaused, setIsPaused] = useState(false);
  
  const [openPanel, setOpenPanel] = useState(null); // 'config', 'intel', 'logs', null

  const stateRef = useRef({ castles });

  useEffect(() => {
    stateRef.current = { castles };
  }, [castles]);

  const appendLog = (msg) => {
    setLogs(prev => {
      const newLogs = [{ time: new Date().toLocaleTimeString(), msg }, ...prev];
      return newLogs.slice(0, 100); 
    });
  };

  const addLog = (msg) => {
    appendLog(msg);
    socket?.emit('activity_log', { msg });
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
      setIsPaused(false);
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
      setCastles(list.map(p => {
        const prev = previous.find(c => c.id === p.id);
        return {
          ...p,
          isSelf: p.id === newSocket.id,
          teamConfig: prev?.teamConfig ?? null,
          alliance: p.alliance ?? null,
          color: p.color ?? null,
          swarm: p.swarm ?? null
        };
      }));
    });

    newSocket.on('world_state', ({ players, agents: worldAgents, paused }) => {
      const previous = stateRef.current.castles;
      setCastles(players.map(p => {
        const prev = previous.find(c => c.id === p.id);
        return {
          ...p,
          isSelf: p.id === newSocket.id,
          teamConfig: prev?.teamConfig ?? null
        };
      }));
      setAgents(worldAgents);
      setIsPaused(paused);
    });

    newSocket.on('activity_log', ({ msg }) => appendLog(msg));
    newSocket.on('game_paused', ({ paused }) => setIsPaused(paused));

    newSocket.on('player_joined', (player) => {
      setCastles(prev => [...prev.filter(c => c.id !== player.id), { ...player, isSelf: false }]);
    });

    newSocket.on('player_left', (playerId) => {
      setCastles(prev => prev.filter(c => c.id !== playerId));
    });

    newSocket.on('player_updated', ({ id, alliance, swarm, color, firewall, accessMode }) => {
      if (id === newSocket.id) return;
      setCastles(prev => prev.map(c => c.id === id
        ? { ...c, alliance: alliance ?? null, swarm: swarm ?? null, color: color ?? null, firewall, accessMode }
        : c));
    });

    newSocket.on('alliance_color', ({ alliance, color }) => {
      setCastles(prev => prev.map(c => c.alliance === alliance ? { ...c, color } : c));
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
      firewall: me?.firewall ?? false,
      accessMode: me?.teamConfig?.accessMode ?? me?.accessMode ?? null,
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
    setIsPaused(false);
    setCastles([]);
    setAgents([]);
    setLogs([]);
    setStewardship(0);
    setPendingTask(null);
    setOpenPanel(null);
  };

  const connectGame = (parsedConfig) => {
    if (socket) {
      setCastles(prev => prev.map(c => 
        c.isSelf ? { ...c, teamConfig: parsedConfig, swarm: parsedConfig.swarm } : c
      ));
      broadcastSelf({
        swarm: parsedConfig.swarm,
        firewall: parsedConfig.roles?.defense?.firewall ?? false,
        accessMode: parsedConfig.accessMode
      });
      addLog(`Team configuration deployed. Roles active.`);
      setPendingTask(null);
      if (parsedConfig.accessMode === 'fullAccess') {
        addLog('FULL ACCESS ENABLED: agents may execute instructions literally. Homebase incidents are simulated.');
      }
    }
  };

  const decideTask = (approved) => {
    if (!pendingTask || isPaused) return;

    if (approved) {
      socket?.emit('deploy_attackers', {
        targetId: pendingTask.targetId,
        agentCount: pendingTask.agentCount
      });
      setStewardship(score => score + 20);
      addLog(`Approved simulated payload request: ${pendingTask.title}. Stewardship +20.`);
    } else {
      setStewardship(score => score + 15);
      addLog(`Rejected simulated payload request: ${pendingTask.title}. Stewardship +15.`);
    }

    setPendingTask(null);
  };

  useEffect(() => {
    if (!active) return undefined;

    const interval = setInterval(() => {
      const player = stateRef.current.castles.find(castle => castle.isSelf);
      if (isPaused || player?.teamConfig?.accessMode !== 'fullAccess' || player.health <= 0) return;

      socket?.emit('homebase_incident');
    }, 7000);

    return () => clearInterval(interval);
  }, [active, socket, isPaused]);

  useEffect(() => {
    if (!active) return undefined;

    const interval = setInterval(() => {
      const player = stateRef.current.castles.find(castle => castle.isSelf);
      if (isPaused || player?.teamConfig?.accessMode !== 'requireApproval' || player.health <= 0) return;
      const attack = (player.teamConfig.attacks || []).find(({ targetId, count }) => {
        const target = stateRef.current.castles.find(castle => castle.id === targetId);
        return count > 0 && target && !target.spectator && target.health > 0
          && !(player.alliance && player.alliance === target.alliance);
      });
      if (!attack) return;

      const target = stateRef.current.castles.find(castle => castle.id === attack.targetId);
      const team = player.teamConfig.teams.find(item => item.id === attack.teamId);
      const requester = team?.agents[0]?.role || 'Attacker Agent';
      setPendingTask(current => current || {
        title: `Send simulated payload to ${target.name}`,
        description: `${requester} requests approval to run a terminal command that sends ${attack.count} simulated payload agent${attack.count === 1 ? '' : 's'} to ${target.name}. This command runs only inside the game simulation.`,
        command: `cyberagents-sim payload send --target "${target.name}" --agents ${attack.count}`,
        targetId: attack.targetId,
        agentCount: attack.count
      });
    }, 12000);

    return () => clearInterval(interval);
  }, [active, isPaused]);

  useEffect(() => {
    if (!active || !socket) return undefined;
    const interval = setInterval(() => {
      const castles = stateRef.current.castles;
      const me = castles.find(castle => castle.isSelf);
      if (isPaused || !me || me.health <= 0 || me.teamConfig?.accessMode !== 'fullAccess') return;
      (me.teamConfig.attacks || []).forEach(({ targetId, count }) => {
        const target = castles.find(castle => castle.id === targetId);
        if (!target || target.spectator || target.health <= 0) return;
        if (me.alliance && me.alliance === target.alliance) return;
        if (count > 0) socket.emit('deploy_attackers', { targetId: target.id, agentCount: count });
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [active, socket, isPaused]);

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

  if (!active) {
    return <Lobby joinGame={joinGame} lobbyError={lobbyError} />;
  }

  const togglePanel = (panelName) => {
    setOpenPanel(prev => prev === panelName ? null : panelName);
  };

  const aliveBots = castles.filter(c => !c.isSelf && !c.spectator && c.health > 0).length;
  const player = castles.find(c => c.isSelf);
  const togglePause = () => socket?.emit('set_game_paused', { paused: !isPaused });

  return (
    <div className="app-container">
      <Navigation pin={pin} openPanel={openPanel} onTogglePanel={togglePanel} onLeave={leaveGame} panels={panelOrder} isHost={isHost} />
      
      {/* Sliding Panels */}
      {!isHost && (
        <ConfigPanel
          isOpen={openPanel === 'config'}
          connectGame={connectGame}
          active={active}
          players={castles.filter(c => !c.isSelf && !c.spectator)}
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
            <>
              <div className="access-status">HOST: SPECTATING</div>
              <button className="task-button host-pause-button" onClick={togglePause}>
                {isPaused ? 'Resume game' : 'Pause game'}
              </button>
            </>
          ) : (
            <div className="status-item">
              <span>Your Castle Integrity:</span>
              <span>{Math.floor(player?.health || 0)}%</span>
            </div>
          )}
          {isPaused && <div className="access-status" role="status">GAME PAUSED BY HOST</div>}
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
          {!isPaused && player?.teamConfig?.accessMode === 'requireApproval' && pendingTask && (
            <section className={`approval-task ${pendingTask.risky ? 'is-risky' : ''}`} aria-labelledby="approval-task-title">
              <p className="task-kicker">AGENT REQUEST · REVIEW BEFORE APPROVAL</p>
              <h4 id="approval-task-title">{pendingTask.title}</h4>
              <p>{pendingTask.description}</p>
              <pre className="proposed-command" aria-label="Proposed simulated terminal command">{pendingTask.command}</pre>
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
              className={`castle ${castle.spectator ? 'host-watchtower' : castle.isSelf ? 'self' : 'enemy'} ${castle.color ? 'allied' : ''}`}
              style={{ left: castle.x, top: castle.y, '--base-color': castle.color || undefined }}
            >
              <div className="icon">
                {castle.spectator ? '[H]' : castle.isSelf ? '[*]' : '[-]'}
              </div>
              <div className="name">{castle.name}</div>
              {!castle.spectator && <div className="health-bar">
                <div className="health-fill" style={{ width: `${castle.health}%` }}></div>
              </div>}
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
