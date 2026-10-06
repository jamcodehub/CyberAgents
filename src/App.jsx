import React, { useState, useEffect, useRef } from 'react';
import { Shield, Crosshair, Terminal, Activity, Server, Users } from 'lucide-react';
import './index.css';

// Initial "broken" configs for the user
const INITIAL_ATTACK_CONFIG = `{
  "target": "null", // Fix me! Set to "ALL" or specific enemy
  "agentCount": 0, // Fix me! Needs more than 0
  "payloadType": "DDoS",
  "stealthMode": false
}`;

const INITIAL_DEFEND_CONFIG = `{
  "firewallActive": false, // Fix me! Turn on firewall
  "patrolRadius": 10,
  "defendersCount": 0 // Fix me! Need defenders
}`;

// Mock player names
const PLAYER_NAMES = ["Neo", "Trinity", "Morpheus", "Cipher", "Ghost", "ZeroCool", "AcidBurn", "CrashOverride", "LordNikon", "PhantomFreak", "CerealKiller", "Plague", "Dade", "Kate", "Joey", "Paul", "Razer", "Blade", "Laser", "Blazer", "Taser", "Maser", "Phaser", "Gazer", "Crazer"];

export default function App() {
  const [attackConfig, setAttackConfig] = useState(INITIAL_ATTACK_CONFIG);
  const [defendConfig, setDefendConfig] = useState(INITIAL_DEFEND_CONFIG);
  
  const [configError, setConfigError] = useState("");
  const [active, setActive] = useState(false);
  
  const [castles, setCastles] = useState([]);
  const [agents, setAgents] = useState([]);
  
  const battlefieldRef = useRef(null);
  const requestRef = useRef(null);

  // Initialize castles
  useEffect(() => {
    const initCastles = () => {
      const newCastles = [];
      const padding = 100;
      const width = window.innerWidth - 400; // subtract sidebar
      const height = window.innerHeight;
      
      // Add player castle
      newCastles.push({
        id: 'player',
        name: 'YOUR CASTLE',
        x: width / 2,
        y: height / 2,
        health: 100,
        isSelf: true,
        attackConfig: null,
        defendConfig: null
      });

      // Add 25 bot castles
      for (let i = 0; i < 25; i++) {
        // avoid overlap with center roughly
        let cx, cy;
        do {
          cx = padding + Math.random() * (width - padding * 2);
          cy = padding + Math.random() * (height - padding * 2);
        } while (Math.abs(cx - width/2) < 150 && Math.abs(cy - height/2) < 150);

        newCastles.push({
          id: `bot-${i}`,
          name: PLAYER_NAMES[i],
          x: cx,
          y: cy,
          health: 100,
          isSelf: false,
          attackCooldown: Math.random() * 100,
          defendConfig: { firewallActive: true, patrolRadius: 40, defendersCount: 5 }
        });
      }
      setCastles(newCastles);
    };
    initCastles();
    
    // Handle resize
    const handleResize = () => initCastles();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDeploy = () => {
    try {
      const parsedAttack = JSON.parse(attackConfig);
      const parsedDefend = JSON.parse(defendConfig);
      
      if (parsedAttack.target === "null" || parsedAttack.agentCount === 0) {
        throw new Error("Attack config is ineffective. Change target and agentCount.");
      }
      if (!parsedDefend.firewallActive || parsedDefend.defendersCount === 0) {
        throw new Error("Defend config is vulnerable. Enable firewall and add defenders.");
      }

      setConfigError("");
      setActive(true);
      
      // Update player config
      setCastles(prev => prev.map(c => 
        c.isSelf ? { ...c, attackConfig: parsedAttack, defendConfig: parsedDefend } : c
      ));

    } catch (e) {
      setConfigError(e.message || "Invalid JSON syntax.");
      setActive(false);
    }
  };

  // Game Loop
  useEffect(() => {
    if (!active) return;

    let lastTime = performance.now();

    const update = (time) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      setCastles(prevCastles => {
        let newCastles = [...prevCastles];
        
        // Bots spawn attacks randomly
        newCastles.forEach(c => {
          if (!c.isSelf && c.health > 0) {
            c.attackCooldown -= dt * 10;
            if (c.attackCooldown <= 0) {
              c.attackCooldown = 50 + Math.random() * 100;
              // Target a random other castle, preferably the player sometimes
              const targets = newCastles.filter(tc => tc.id !== c.id && tc.health > 0);
              if (targets.length > 0) {
                let target = targets[Math.floor(Math.random() * targets.length)];
                if (Math.random() < 0.2) target = newCastles.find(tc => tc.isSelf) || target;
                
                // Spawn attackers
                spawnAgents(c.id, target.id, c.x, c.y, 3, 'attacker');
              }
            }
          }
        });

        // Player spawns attacks
        const player = newCastles.find(c => c.isSelf);
        if (player && player.health > 0 && player.attackConfig) {
          player.attackCooldown = (player.attackCooldown || 0) - dt * 10;
          if (player.attackCooldown <= 0) {
            player.attackCooldown = 40; // faster than bots
            const targets = newCastles.filter(tc => !tc.isSelf && tc.health > 0);
            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              spawnAgents(player.id, target.id, player.x, player.y, player.attackConfig.agentCount, 'attacker');
            }
          }
        }

        return newCastles;
      });

      setAgents(prevAgents => {
        let newAgents = [];
        
        setCastles(currentCastles => {
          let updatedCastles = [...currentCastles];
          
          prevAgents.forEach(agent => {
            const targetCastle = updatedCastles.find(c => c.id === agent.targetId);
            if (!targetCastle || targetCastle.health <= 0) return; // Agent dies if target is dead
            
            const dx = targetCastle.x - agent.x;
            const dy = targetCastle.y - agent.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < 10) {
              // Hit target!
              const castleIndex = updatedCastles.findIndex(c => c.id === targetCastle.id);
              if (castleIndex !== -1) {
                // Apply damage
                // If castle has defenders/firewall, damage is reduced
                let damage = 5;
                if (updatedCastles[castleIndex].defendConfig?.firewallActive) damage = 1;
                
                updatedCastles[castleIndex].health = Math.max(0, updatedCastles[castleIndex].health - damage);
              }
            } else {
              // Move agent
              const speed = 100;
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

      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [active]);

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

  const aliveBots = castles.filter(c => !c.isSelf && c.health > 0).length;
  const player = castles.find(c => c.isSelf);

  return (
    <div className="app-container">
      <div className="sidebar">
        <h1 className="title"><Terminal size={28} /> Cyber Agents</h1>
        <p style={{marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-muted)'}}>
          Configure your autonomous agents to defend your castle and hack the enemy network. The initial config is broken—fix it to deploy!
        </p>

        <div className="config-section">
          <div className="config-card attack">
            <h2><Crosshair size={20} /> Attack Config (attack.json)</h2>
            <textarea 
              className="code-editor" 
              value={attackConfig} 
              onChange={e => setAttackConfig(e.target.value)}
              spellCheck="false"
            />
          </div>

          <div className="config-card defend">
            <h2><Shield size={20} /> Defend Config (defend.json)</h2>
            <textarea 
              className="code-editor" 
              value={defendConfig} 
              onChange={e => setDefendConfig(e.target.value)}
              spellCheck="false"
            />
          </div>
        </div>

        {configError && <div className="error-msg">{configError}</div>}
        
        <button className="btn" onClick={handleDeploy}>
          {active ? "Update & Redeploy" : "Deploy Agents"}
        </button>
      </div>

      <div className="battlefield" ref={battlefieldRef}>
        <div className="status-panel">
          <h3><Activity size={18} style={{display:'inline', verticalAlign:'middle'}}/> Network Status</h3>
          <div className="status-item">
            <span>Your Castle Integrity:</span>
            <span style={{color: player?.health > 50 ? 'var(--neon-green)' : 'var(--neon-red)'}}>
              {Math.floor(player?.health || 0)}%
            </span>
          </div>
          <div className="status-item">
            <span>Active Enemy Nodes:</span>
            <span>{aliveBots} / 25</span>
          </div>
          <div className="status-item">
            <span>Agents In Transit:</span>
            <span>{agents.length}</span>
          </div>
          {player?.health <= 0 && (
            <div style={{color: 'var(--neon-red)', marginTop: '10px', fontWeight: 'bold', textAlign: 'center'}}>
              SYSTEM COMPROMISED. REBOOT REQUIRED.
            </div>
          )}
          {aliveBots === 0 && player?.health > 0 && (
            <div style={{color: 'var(--neon-green)', marginTop: '10px', fontWeight: 'bold', textAlign: 'center'}}>
              NETWORK DOMINATED. YOU WIN.
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
                {castle.isSelf ? <Server size={24} /> : <Users size={20} />}
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
