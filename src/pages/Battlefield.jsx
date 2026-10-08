import React, { useState, useRef } from 'react';

const INITIAL_ATTACK_CONFIG = `{
  "target": "null", // Fix me! Set to an enemy name
  "agentCount": 0, // Max 50
  "payloadType": "DDoS",
  "stealthMode": false
}`;

const INITIAL_DEFEND_CONFIG = `{
  "firewallActive": false, // Turn on to reduce damage
  "patrolRadius": 10,
  "defendersCount": 0
}`;

export default function Battlefield({ castles, agents, active, connectGame, myId }) {
  const [attackConfig, setAttackConfig] = useState(INITIAL_ATTACK_CONFIG);
  const [defendConfig, setDefendConfig] = useState(INITIAL_DEFEND_CONFIG);
  const [configError, setConfigError] = useState("");
  
  const battlefieldRef = useRef(null);

  const handleDeploy = () => {
    try {
      const parsedAttack = JSON.parse(attackConfig);
      const parsedDefend = JSON.parse(defendConfig);
      
      if (parsedAttack.target === "null" || parsedAttack.agentCount === 0) {
        throw new Error("Attack config is ineffective. Change target and agentCount.");
      }
      if (parsedAttack.agentCount > 50) {
        throw new Error("Resource limit exceeded. Maximum agentCount is 50.");
      }
      if (!parsedDefend.firewallActive || parsedDefend.defendersCount === 0) {
        throw new Error("Defend config is vulnerable. Enable firewall and add defenders.");
      }

      setConfigError("");
      connectGame(parsedAttack, parsedDefend);
    } catch (e) {
      setConfigError(e.message || "Invalid JSON syntax.");
    }
  };

  const aliveBots = castles.filter(c => !c.isSelf && c.health > 0).length;
  const player = castles.find(c => c.isSelf);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div className="sidebar" style={{ width: '400px', borderLeft: '2px solid #fff', borderRight: '2px solid #fff' }}>
        <h2 style={{ marginBottom: '10px' }}>&gt;_ CONFIGURATION</h2>
        
        <div className="config-section">
          <div className="config-card attack">
            <h2>[ATTACK_CFG] attack.json</h2>
            <textarea
              className="code-editor"
              value={attackConfig}
              onChange={e => setAttackConfig(e.target.value)}
              spellCheck="false"
            />
          </div>

          <div className="config-card defend">
            <h2>[DEFEND_CFG] defend.json</h2>
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
            <span>{agents.reduce((total, agent) => total + (agent.count || 1), 0)}</span>
          </div>
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
