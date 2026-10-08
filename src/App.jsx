import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Navigation from './components/Navigation';
import ConfigPanel from './components/ConfigPanel';
import IntelPanel from './components/IntelPanel';
import LogPanel from './components/LogPanel';
import AlliancePanel, { ALLIANCE_COLORS } from './components/AlliancePanel';
import AgentSwarm from './components/AgentSwarm';
import Lobby from './pages/Lobby';
import WaitingLobby from './pages/WaitingLobby';
import './index.css';

const formatTokens = (tokens = 0) => `${Math.floor(tokens / 1000).toLocaleString()}k`;
const getTokenBalance = (player, previous) => (
  Number.isFinite(player.tokens)
    ? player.tokens
    : previous?.tokens ?? (player.spectator || player.isHost ? 0 : 100000)
);

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
  const [gameStarted, setGameStarted] = useState(false);
  const [lobbyStartError, setLobbyStartError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [showGameResult, setShowGameResult] = useState(false);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  
  const [openPanel, setOpenPanel] = useState(null); // 'config', 'intel', 'logs', null

  const battlefieldRef = useRef(null);
  const draggedPlayerRef = useRef(null);
  const panGestureRef = useRef(null);
  const socketRef = useRef(null);
  const nextApprovalAtRef = useRef(0);
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
    socketRef.current?.emit('activity_log', { msg });
  };

  const joinGame = (gamePin, isHost = false) => {
    setCameraOffset({ x: 0, y: 0 });
    setPin(gamePin);
    setIsHost(isHost);
    setGameStarted(false);
    setLobbyStartError('');
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
      if (socketRef.current === newSocket) socketRef.current = null;
      setSocket(null);
      setPin(null);
      setActive(false);
      setCameraOffset({ x: 0, y: 0 });
      setCastles([]);
      setAgents([]);
      setLogs([]);
      setStewardship(0);
      setPendingTask(null);
      setOpenPanel(null);
      setIsHost(false);
      setGameStarted(false);
      setIsPaused(false);
      setGameResult(null);
      setShowGameResult(false);
      setLobbyError(message);
    };

    newSocket.on('connect', () => {
      setMyId(newSocket.id);
      newSocket.emit('join_game', { pin: gamePin, isHost });
      appendLog(`Connected to network [${gamePin}]`);
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
        appendLog(isHost || me.spectator || me.isHost
          ? 'You are Host watchtower. Hosts cannot be targeted.'
          : `Assigned codename: ${me.name}`);
      }
      const previous = stateRef.current.castles;
      setCastles(list.map(p => {
        const prev = previous.find(c => c.id === p.id);
        const host = p.spectator || p.isHost || (isHost && p.id === newSocket.id);
        return {
          ...p,
          name: host ? 'Host watchtower' : p.name,
          isHost: Boolean(host),
          spectator: Boolean(host),
          tokens: host ? 0 : getTokenBalance(p, prev),
          isSelf: p.id === newSocket.id,
          teamConfig: prev?.teamConfig ?? null,
          alliance: p.alliance ?? null,
          color: p.color ?? null,
          swarm: p.swarm ?? null
        };
      }));
    });

    newSocket.on('world_state', ({ players, agents: worldAgents, paused, started }) => {
      const previous = stateRef.current.castles;
      setCastles(players.map(p => {
        const prev = previous.find(c => c.id === p.id);
        const host = p.spectator || p.isHost || (isHost && p.id === newSocket.id);
        return {
          ...p,
          name: host ? 'Host watchtower' : p.name,
          isHost: Boolean(host),
          spectator: Boolean(host),
          tokens: host ? 0 : getTokenBalance(p, prev),
          isSelf: p.id === newSocket.id,
          teamConfig: prev?.teamConfig ?? null
        };
      }));
      setAgents(worldAgents);
      setIsPaused(paused);
      if (started) setGameStarted(true);
    });

    newSocket.on('lobby_state', ({ players }) => {
      if (!Array.isArray(players)) return;
      const previous = stateRef.current.castles;
      setCastles(players.map(p => {
        const prev = previous.find(c => c.id === p.id);
        const host = p.spectator || p.isHost || (isHost && p.id === newSocket.id);
        return {
          ...p,
          name: host ? 'Host watchtower' : p.name,
          isHost: Boolean(host),
          spectator: Boolean(host),
          tokens: host ? 0 : getTokenBalance(p, prev),
          isSelf: p.id === newSocket.id,
          teamConfig: prev?.teamConfig ?? null,
          alliance: p.alliance ?? null,
          color: p.color ?? null,
          swarm: p.swarm ?? null
        };
      }));
    });
    newSocket.on('game_started', () => {
      setGameStarted(true);
      setIsPaused(false);
      setLobbyStartError('');
    });

    newSocket.on('activity_log', ({ msg }) => appendLog(msg));
    newSocket.on('game_paused', ({ paused }) => setIsPaused(paused));
    newSocket.on('game_over', result => {
      setGameResult(result);
      setShowGameResult(true);
      setIsPaused(true);
      setPendingTask(null);
    });

    newSocket.on('player_joined', (player) => {
      const host = player.spectator || player.isHost || (isHost && player.id === newSocket.id);
      setCastles(prev => [...prev.filter(c => c.id !== player.id), {
        ...player,
        name: host ? 'Host watchtower' : player.name,
        isHost: Boolean(host),
        spectator: Boolean(host),
        tokens: host ? 0 : getTokenBalance(player),
        isSelf: false
      }]);
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

    socketRef.current = newSocket;
    setSocket(newSocket);
  };

  // Shares alliance + agent-swarm info with the other players (needs the server relay).
  const broadcastSelf = (overrides = {}, acknowledge) => {
    const activeSocket = socketRef.current;
    if (!activeSocket?.connected) {
      acknowledge?.({ accepted: false, reason: 'Not connected to the game server.' });
      return;
    }
    const me = stateRef.current.castles.find(c => c.isSelf);
    activeSocket.emit('player_update', {
      alliance: me?.alliance ?? null,
      swarm: me?.swarm ?? null,
      color: me?.color ?? null,
      firewall: me?.firewall ?? false,
      accessMode: me?.teamConfig?.accessMode ?? me?.accessMode ?? null,
      actions: me?.teamConfig?.attacks ?? [],
      ...overrides
    }, acknowledge);
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
    socketRef.current = null;
    setSocket(null);
    setActive(false);
    setCameraOffset({ x: 0, y: 0 });
    setPin(null);
    setMyId(null);
    setIsHost(false);
    setGameStarted(false);
    setLobbyStartError('');
    setIsPaused(false);
    setGameResult(null);
    setShowGameResult(false);
    setCastles([]);
    setAgents([]);
    setLogs([]);
    setStewardship(0);
    setPendingTask(null);
    setOpenPanel(null);
  };

  const connectGame = (parsedConfig) => {
    if (socketRef.current?.connected) {
      nextApprovalAtRef.current = 0;
      setCastles(prev => prev.map(c => 
        c.isSelf ? { ...c, teamConfig: parsedConfig, swarm: parsedConfig.swarm } : c
      ));
      let deploymentAcknowledged = false;
      const deploymentTimer = setTimeout(() => {
        if (deploymentAcknowledged) return;
        setPendingTask(null);
        addLog('No server confirmation received for team deployment. Deploy the latest backend to Render, reconnect, and try again.');
      }, 4000);
      broadcastSelf({
        swarm: parsedConfig.swarm,
        firewall: parsedConfig.roles?.defense?.firewall ?? false,
        accessMode: parsedConfig.accessMode,
        actions: parsedConfig.attacks
      }, result => {
        deploymentAcknowledged = true;
        clearTimeout(deploymentTimer);
        if (!result?.accepted) {
          setPendingTask(null);
          addLog(`The server did not deploy this team: ${result?.reason || 'no confirmation received'}`);
          return;
        }

        addLog(`Team configuration deployed and confirmed by the server (${result.actionCount} target action${result.actionCount === 1 ? '' : 's'} active).`);
        if (parsedConfig.accessMode === 'requireApproval') {
          const action = parsedConfig.attacks[0];
          const target = action && stateRef.current.castles.find(castle => castle.id === action.targetId);
          const deployedAction = action && result.actions?.find(item =>
            item.action === action.action && item.targetId === action.targetId
          );
          if (action && target && deployedAction) {
            const localPlayer = stateRef.current.castles.find(castle => castle.isSelf);
            const team = parsedConfig.teams.find(item => item.id === action.teamId);
            const requester = team?.agents[0]?.role || 'Attacker Agent';
            const isStealing = action.action === 'steal';
            const operationCount = Math.min(deployedAction.count, Math.floor((localPlayer?.tokens ?? 0) / 1000));
            if (operationCount <= 0) {
              setPendingTask(null);
              addLog('Team deployed, but the action cannot run because no tokens are available.');
              return;
            }
            const command = isStealing
              ? `cyberagents-sim tokens steal --target "${target.name}" --amount 10k --agents ${operationCount}`
              : `cyberagents-sim payload send --target "${target.name}" --agents ${operationCount}`;
            setPendingTask({
              title: `${isStealing ? 'Steal tokens from' : 'Send simulated payload to'} ${target.name}`,
              description: `${requester} requests approval to run a simulated terminal command to ${isStealing ? `steal up to 10k tokens from ${target.name}` : `send ${operationCount} payload agent${operationCount === 1 ? '' : 's'} to ${target.name}`}. The operation costs ${operationCount}k tokens and runs only inside the game.`,
              command,
              action: action.action || 'attack',
              targetId: action.targetId,
              agentCount: operationCount
            });
          } else {
            setPendingTask(null);
            addLog('Team deployed, but the server confirmed no valid Red Team target action. Select an available target and redeploy.');
          }
        } else {
          setPendingTask(null);
          addLog('FULL ACCESS ENABLED: agents may execute instructions literally. Homebase incidents are simulated.');
        }
      });
    } else {
      setPendingTask(null);
      addLog('Team deployment failed: you are not connected to the game server. Rejoin and try again.');
    }
  };

  const startGame = () => {
    setLobbyStartError('');
    let acknowledged = false;
    const timer = setTimeout(() => {
      if (!acknowledged) {
        setLobbyStartError('No response from the game server. Deploy the latest backend to Render and reconnect.');
      }
    }, 4000);
    socketRef.current?.emit('start_game', result => {
      acknowledged = true;
      clearTimeout(timer);
      if (!result?.accepted) {
        setLobbyStartError(result?.reason || 'The server did not start the game.');
      }
    });
  };

  const decideTask = (approved) => {
    if (!pendingTask || isPaused) return;
    nextApprovalAtRef.current = Date.now() + 12000;

    if (approved) {
      let acknowledged = false;
      const acknowledgementTimer = setTimeout(() => {
        if (!acknowledged) {
          addLog('No server confirmation received for the approved action. Check that the latest backend is deployed and reconnect.');
        }
      }, 4000);
      socketRef.current?.emit('agent_action', {
        action: pendingTask.action,
        targetId: pendingTask.targetId,
        agentCount: pendingTask.agentCount
      }, result => {
        acknowledged = true;
        clearTimeout(acknowledgementTimer);
        if (!result?.accepted) {
          addLog(`Server rejected the approved action: ${result?.reason || 'the backend did not accept the request'}`);
          return;
        }
        setStewardship(score => score + 20);
        addLog(result.action === 'attack'
          ? `Server launched ${result.agentCount} payload agent${result.agentCount === 1 ? '' : 's'} toward ${result.targetName}.`
          : `Server completed the token theft from ${result.targetName}.`);
      });
      addLog(`Approval submitted for ${pendingTask.title}; waiting for the game server.`);
    } else {
      setStewardship(score => score + 15);
      addLog(`Rejected simulated ${pendingTask.action === 'steal' ? 'token theft' : 'payload'} request: ${pendingTask.title}. Stewardship +15.`);
    }

    setPendingTask(null);
  };

  useEffect(() => {
    if (!active) return undefined;

    const interval = setInterval(() => {
      const player = stateRef.current.castles.find(castle => castle.isSelf);
      if (isPaused || player?.teamConfig?.accessMode !== 'fullAccess' || player.health <= 0
        || player.tokens < 1000) return;

      socket?.emit('homebase_incident');
    }, 7000);

    return () => clearInterval(interval);
  }, [active, socket, isPaused]);

  useEffect(() => {
    if (!active) return undefined;

    const interval = setInterval(() => {
      const player = stateRef.current.castles.find(castle => castle.isSelf);
      if (isPaused || player?.teamConfig?.accessMode !== 'requireApproval' || player.health <= 0) return;
      if (Date.now() < nextApprovalAtRef.current) return;
      const attack = (player.teamConfig.attacks || []).find(({ targetId, count, action }) => {
        const target = stateRef.current.castles.find(castle => castle.id === targetId);
        return count > 0 && target && !target.spectator && target.health > 0
          && (action !== 'steal' || target.tokens > 0) && player.tokens >= 1000
          && !(player.alliance && player.alliance === target.alliance);
      });
      if (!attack) return;

      const target = stateRef.current.castles.find(castle => castle.id === attack.targetId);
      const team = player.teamConfig.teams.find(item => item.id === attack.teamId);
      const requester = team?.agents[0]?.role || 'Attacker Agent';
      const isStealing = attack.action === 'steal';
      const configuredCount = player.teamConfig.attacks
        .filter(item => item.action === attack.action && item.targetId === attack.targetId)
        .reduce((total, item) => total + item.count, 0);
      const operationCount = Math.min(configuredCount, Math.floor(player.tokens / 1000));
      const operationCost = operationCount * 1000;
      setPendingTask(current => current || {
        title: `${isStealing ? 'Steal tokens from' : 'Send simulated payload to'} ${target.name}`,
        description: `${requester} requests approval to run a simulated terminal command to ${isStealing ? `steal up to 10k tokens from ${target.name}` : `send ${operationCount} payload agent${operationCount === 1 ? '' : 's'} to ${target.name}`}. The operation costs ${operationCost / 1000}k tokens and runs only inside the game.`,
        command: isStealing
          ? `cyberagents-sim tokens steal --target "${target.name}" --amount 10k --agents ${operationCount}`
          : `cyberagents-sim payload send --target "${target.name}" --agents ${operationCount}`,
        action: attack.action || 'attack',
        targetId: attack.targetId,
        agentCount: operationCount
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [active, isPaused]);

  useEffect(() => {
    if (!active || !socket) return undefined;
    const interval = setInterval(() => {
      const castles = stateRef.current.castles;
      const me = castles.find(castle => castle.isSelf);
      if (isPaused || !me || me.health <= 0 || me.teamConfig?.accessMode !== 'fullAccess') return;
      let availableTokens = me.tokens;
      const actionGroups = new Map();
      (me.teamConfig.attacks || []).forEach(({ targetId, count, action }) => {
        const target = castles.find(castle => castle.id === targetId);
        if (!target || target.spectator || target.health <= 0 || (action === 'steal' && target.tokens <= 0)) return;
        if (me.alliance && me.alliance === target.alliance) return;
        const actionType = action || 'attack';
        const key = `${actionType}:${targetId}`;
        const group = actionGroups.get(key) || { action: actionType, targetId, count: 0 };
        group.count += count;
        actionGroups.set(key, group);
      });
      actionGroups.forEach(({ action, targetId, count }) => {
        const target = castles.find(castle => castle.id === targetId);
        if (!target || (action === 'steal' && target.tokens <= 0)) return;
        const affordableCount = Math.min(count, Math.floor(availableTokens / 1000));
        if (affordableCount > 0) {
          socket.emit('agent_action', { action, targetId: target.id, agentCount: affordableCount });
          availableTokens -= affordableCount * 1000;
        }
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
    if (!active || !selfDestroyed || gameResult) return undefined;
    const timer = setTimeout(() => {
      leaveGame();
      setLobbyError('Your base was destroyed. Join again as a new agent.');
    }, 3000);
    return () => clearTimeout(timer);
  }, [active, gameResult, selfDestroyed]);

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

  if (!gameStarted) {
    return (
      <WaitingLobby
        pin={pin}
        players={castles}
        isHost={isHost}
        error={lobbyStartError}
        onStart={startGame}
        onLeave={leaveGame}
      />
    );
  }

  const togglePanel = (panelName) => {
    setOpenPanel(prev => prev === panelName ? null : panelName);
  };

  const aliveBots = castles.filter(c => !c.isSelf && !c.spectator && c.health > 0).length;
  const player = castles.find(c => c.isSelf);
  const agentsHalted = player && player.tokens < 1000;
  const togglePause = () => socketRef.current?.emit('set_game_paused', { paused: !isPaused });

  const startMapDrag = (event) => {
    if (!battlefieldRef.current || event.target.closest('button, .status-panel')) return;
    const castleElement = isHost ? event.target.closest('[data-player-id]') : null;
    event.preventDefault();
    if (castleElement) {
      draggedPlayerRef.current = castleElement.dataset.playerId;
    } else {
      panGestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        cameraX: cameraOffset.x,
        cameraY: cameraOffset.y
      };
      setIsPanning(true);
    }
    battlefieldRef.current.setPointerCapture(event.pointerId);
    if (draggedPlayerRef.current) updateMapDrag(event);
  };

  const updateMapDrag = (event) => {
    const map = battlefieldRef.current;
    if (!map) return;
    if (isHost && draggedPlayerRef.current) {
      const bounds = map.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = ((event.clientX - bounds.left - cameraOffset.x) / bounds.width) * 1000;
      const y = ((event.clientY - bounds.top - cameraOffset.y) / bounds.height) * 700;
      socketRef.current?.emit('move_player', {
        playerId: draggedPlayerRef.current,
        x: Math.min(1000, Math.max(0, x)),
        y: Math.min(700, Math.max(0, y))
      });
      return;
    }

    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const bounds = map.getBoundingClientRect();
    const maxX = Math.min(300, bounds.width * 0.35);
    const maxY = Math.min(210, bounds.height * 0.35);
    setCameraOffset({
      x: Math.min(maxX, Math.max(-maxX, gesture.cameraX + event.clientX - gesture.startX)),
      y: Math.min(maxY, Math.max(-maxY, gesture.cameraY + event.clientY - gesture.startY))
    });
  };

  const endMapDrag = (event) => {
    if (battlefieldRef.current?.hasPointerCapture(event.pointerId)) {
      battlefieldRef.current.releasePointerCapture(event.pointerId);
    }
    draggedPlayerRef.current = null;
    panGestureRef.current = null;
    setIsPanning(false);
  };

  return (
    <div className="app-container">
      <Navigation
        pin={pin}
        agentId={isHost ? 'Host watchtower' : player?.name || 'Assigning...'}
        openPanel={openPanel}
        onTogglePanel={togglePanel}
        onLeave={leaveGame}
        panels={panelOrder}
        isHost={isHost}
      />
      
      {/* Sliding Panels */}
      {!isHost && (
        <ConfigPanel
          isOpen={openPanel === 'config'}
          connectGame={connectGame}
          active={active}
          players={castles.filter(c => !c.isSelf && !c.spectator && !c.isHost)}
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
      <div
        ref={battlefieldRef}
        className={`battlefield${isHost ? ' host-map' : ''}${isPanning ? ' panning' : ''}`}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          zIndex: 1,
          backgroundPosition: `${cameraOffset.x}px ${cameraOffset.y}px`
        }}
        onPointerDown={startMapDrag}
        onPointerMove={updateMapDrag}
        onPointerUp={endMapDrag}
        onPointerCancel={endMapDrag}
      >
        <button
          type="button"
          className="recenter-map-button"
          onClick={() => setCameraOffset({ x: 0, y: 0 })}
          aria-label="Recenter battlefield map"
          title="Recenter map"
        >
          Recenter map
        </button>
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
          {!isHost && (
            <div className="status-item">
              <span>Tokens:</span>
              <span>{player ? formatTokens(player.tokens) : 'SYNCING'}</span>
            </div>
          )}
          {!isHost && agentsHalted && (
            <div className="access-status" role="status">
              {player.tokens === 0 ? 'OUT OF TOKENS' : 'INSUFFICIENT TOKENS'}: AGENTS HALTED
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
          {!isPaused && !pendingTask && player?.teamConfig?.accessMode === 'requireApproval'
            && (player.teamConfig.attacks || []).length === 0 && (
              <div className="access-status" role="status">
                NO APPROVAL REQUEST YET: add a Red Team target in Agent Config.
              </div>
            )}
          {!isPaused && !pendingTask && player?.teamConfig?.accessMode === 'requireApproval'
            && (player.teamConfig.attacks || []).length > 0 && player.tokens < 1000 && (
              <div className="access-status" role="status">
                NO TOKENS AVAILABLE: agents need at least 1k tokens to act.
              </div>
            )}
          {player?.health <= 0 && (
            <div style={{ marginTop: '10px', fontWeight: 'bold', textAlign: 'center', border: '1px solid #fff', padding: '5px' }}>
              BASE DESTROYED. RETURNING TO LOBBY...
            </div>
          )}
        </div>

        <div
          className="battlefield-world"
          style={{ transform: `translate3d(${cameraOffset.x}px, ${cameraOffset.y}px, 0)` }}
        >
          {castles.map(castle => (
            castle.health > 0 && (
              <div
                key={castle.id}
                className={`castle ${castle.spectator ? 'host-watchtower' : castle.isSelf ? 'self' : 'enemy'} ${castle.color ? 'allied' : ''}`}
                data-player-id={castle.id}
                style={{ left: `${castle.x / 10}%`, top: `${castle.y / 7}%`, '--base-color': castle.color || undefined }}
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
                x={`${castle.x / 10}%`}
                y={`${castle.y / 7}%`}
                red={castle.swarm.red}
                blue={castle.swarm.blue}
              />
            )
          ))}

          {agents.map(agent => (
            <div
              key={agent.id}
              className={`agent ${agent.type}`}
              style={{ left: `${agent.x / 10}%`, top: `${agent.y / 7}%` }}
            />
          ))}
        </div>
      </div>

      {gameResult && showGameResult && (
        <div className="victory-overlay" role="dialog" aria-modal="true" aria-labelledby="ladder-title">
          <section className="victory-card">
            <p className="task-kicker">NETWORK COMPLETE</p>
            <h2 id="ladder-title">LADDER RESULTS</h2>
            {gameResult.winnerAlliance ? (
              <p className="victory-heading">LAST ALLIANCE STANDING: {gameResult.winnerAlliance}</p>
            ) : gameResult.winners.length > 0 ? (
              <p className="victory-heading">
                {gameResult.winners.includes(player?.id) ? 'VICTORY' : 'LAST AGENT STANDING'}: {gameResult.standings.find(item => gameResult.winners.includes(item.id))?.name}
              </p>
            ) : (
              <p className="victory-heading">DRAW: NO AGENTS REMAINED</p>
            )}
            <ol className="ladder-list">
              {gameResult.standings.map(entry => (
                <li key={entry.id} className={gameResult.winners.includes(entry.id) ? 'ladder-winner' : ''}>
                  <span className="ladder-rank">#{entry.rank}</span>
                  <span className="ladder-player">
                    {entry.name}{entry.alliance ? ` · ${entry.alliance}` : ''}
                  </span>
                  <span>{Math.floor(entry.health)}% · {formatTokens(entry.tokens)}</span>
                </li>
              ))}
            </ol>
            <button className="task-button" onClick={() => setShowGameResult(false)}>Continue watching</button>
          </section>
        </div>
      )}
    </div>
  );
}
