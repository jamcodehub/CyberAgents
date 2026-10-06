import React, { useState } from 'react';

const INITIAL_TEAM_CONFIG = `{
  "teamInstructions": "Infiltrate and extract data without detection.",
  "target": "EnemyNodeName",
  "autonomy": "requireApproval", // "autonomous" or "requireApproval"
  "roles": {
    "recon": { "count": 10, "stealth": true },
    "assault": { "count": 20, "payload": "DDoS" },
    "defense": { "count": 20, "firewall": true }
  }
}`;

export default function ConfigPanel({ isOpen, connectGame, active }) {
  const [teamConfig, setTeamConfig] = useState(INITIAL_TEAM_CONFIG);
  const [configError, setConfigError] = useState("");
  const [accessMode, setAccessMode] = useState("requireApproval");

  const handleDeploy = () => {
    try {
      // Strip out JS-style comments before parsing using a regex
      const cleanedConfig = teamConfig.replace(/\/\/.*$/gm, '');
      const parsedConfig = JSON.parse(cleanedConfig);

      if (!parsedConfig.target || parsedConfig.target === "EnemyNodeName") {
        throw new Error("Attack config is ineffective. Change target to a real enemy name.");
      }

      const totalCount = (parsedConfig.roles?.recon?.count || 0) +
        (parsedConfig.roles?.assault?.count || 0) +
        (parsedConfig.roles?.defense?.count || 0);

      if (totalCount > 50) {
        throw new Error("Resource limit exceeded. Maximum team total is 50 agents.");
      }

      if (totalCount === 0) {
        throw new Error("You must assign agents to roles.");
      }

      setConfigError("");
      connectGame({ ...parsedConfig, accessMode });
    } catch (e) {
      setConfigError(e.message || "Invalid JSON syntax.");
    }
  };

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ marginBottom: '10px' }}>&gt;_ AGENT_CONFIGURATION</h2>

      <div className="config-section">
        <div className="access-control">
          <label htmlFor="homebase-access">HOMEBASE ACCESS POLICY</label>
          <select
            id="homebase-access"
            value={accessMode}
            onChange={event => setAccessMode(event.target.value)}
          >
            <option value="requireApproval">Ask me before every task</option>
            <option value="fullAccess">Grant full access</option>
          </select>
          <p>
            {accessMode === "requireApproval"
              ? "You review each request. Read the proposed action before approving."
              : "Unrestricted access can make agents follow instructions literally and destabilize Homebase."}
            {" "}Simulation only; no real system is accessed.
          </p>
        </div>

        <div className="config-card attack" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h2>[TEAM_CFG] team_roles.json</h2>
          <textarea
            className="code-editor"
            value={teamConfig}
            onChange={e => setTeamConfig(e.target.value)}
            spellCheck="false"
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {configError && <div className="error-msg">{configError}</div>}

      <button className="btn" onClick={handleDeploy}>
        {active ? "Update & Redeploy" : "Deploy Agents"}
      </button>
    </div>
  );
}
