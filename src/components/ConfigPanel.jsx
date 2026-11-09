import React, { useRef, useState } from 'react';
import {
  INSTRUCTION_PRESETS,
  DEFAULT_PRESET_BY_TYPE
} from '../data/instructionPresets';

const TEAM_TYPES = {
  red: {
    label: 'Red Team',
    roles: [
      'Red Team Lead/Manager',
      'Penetration Tester',
      'Operator / Engineer',
      'Social Engineer'
    ]
  },
  blue: {
    label: 'Blue Team',
    roles: [
      'Blue Team Lead/Manager',
      'SOC Analyst',
      'Incident Responder',
      'Digital Forensics Analyst',
      'Malware Analyst',
      'Threat Intelligence Analyst',
      'Vulnerability Analyst',
      'Security Engineer / Architect'
    ]
  }
};

export default function ConfigPanel({
  isOpen,
  connectGame,
  active,
  players = [],
  myAlliance = null
}) {
  const [configError, setConfigError] = useState('');
  const [squadType, setSquadType] = useState('red');
  const [agentCount, setAgentCount] = useState(3);
  const [targetId, setTargetId] = useState('');
  const [action, setAction] = useState('attack');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_BY_TYPE.red);
  const [accessMode, setAccessMode] = useState('requireApproval');
  const [expandedProtocol, setExpandedProtocol] = useState(null);
  const idCounter = useRef(0);

  const currentPreset = INSTRUCTION_PRESETS.find(p => p.id === presetId) || INSTRUCTION_PRESETS[0];

  // When squad type flips, reset preset to the safe default for that type
  const handleTypeChange = (type) => {
    setSquadType(type);
    setPresetId(DEFAULT_PRESET_BY_TYPE[type]);
    setExpandedProtocol(null);
  };

  // Available protocols for the selected type
  const protocols = INSTRUCTION_PRESETS.filter(
    p => p.type === squadType || p.type === 'any'
  );

  const handleDeploy = () => {
    try {
      if (agentCount < 1) throw new Error('Add at least 1 agent.');
      if (agentCount > 50) throw new Error('Maximum 50 agents.');
      if (squadType === 'red' && !targetId) throw new Error('Red teams need a target.');

      // Build agents with distributed roles
      const roles = TEAM_TYPES[squadType].roles;
      const agents = Array.from({ length: agentCount }, (_, i) => ({
        id: `agent-${idCounter.current++}`,
        role: roles[i % roles.length]
      }));

      const teamId = `team-${idCounter.current++}`;
      const team = {
        id: teamId,
        type: squadType,
        name: `${TEAM_TYPES[squadType].label} 1`,
        action,
        instructions: currentPreset.text,
        instructionPresetId: currentPreset.id,
        instructionStatus: currentPreset.status,
        targetId: squadType === 'red' ? targetId : '',
        agents
      };

      const redAgents = squadType === 'red' ? agents : [];
      const blueAgents = squadType === 'blue' ? agents : [];

      const attacks = squadType === 'red' && targetId ? [{
        teamId,
        targetId,
        count: agents.length,
        action,
        instructions: currentPreset.text,
        instructionStatus: currentPreset.status
      }] : [];

      const reconRoles = new Set([
        'Penetration Tester', 'SOC Analyst', 'Digital Forensics Analyst',
        'Malware Analyst', 'Threat Intelligence Analyst', 'Vulnerability Analyst'
      ]);

      const parsedConfig = {
        accessMode,
        teams: [team],
        attacks,
        swarm: { red: redAgents.length, blue: blueAgents.length },
        roles: {
          recon: { count: agents.filter(a => reconRoles.has(a.role)).length },
          assault: { count: redAgents.length },
          defense: { count: blueAgents.length, firewall: blueAgents.length > 0 }
        }
      };

      setConfigError('');
      connectGame(parsedConfig);
    } catch (e) {
      setConfigError(e.message);
    }
  };

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ marginBottom: '14px' }}>&gt;_ AGENT_CONFIG</h2>

      <div className="config-section">
        {/* 1. Squad Type - two big buttons */}
        <div className="cfg-row">
          <span className="cfg-label">SQUAD TYPE</span>
          <div className="squad-type-grid">
            <button
              type="button"
              className={`squad-type-btn ${squadType === 'red' ? 'selected-red' : ''}`}
              onClick={() => handleTypeChange('red')}
            >
              RED (Offense)
            </button>
            <button
              type="button"
              className={`squad-type-btn ${squadType === 'blue' ? 'selected-blue' : ''}`}
              onClick={() => handleTypeChange('blue')}
            >
              BLUE (Defense)
            </button>
          </div>
        </div>

        {/* 2. Agent Count - simple +/- stepper */}
        <div className="cfg-row">
          <span className="cfg-label">AGENTS</span>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => setAgentCount(c => Math.max(1, c - 1))}
            >
              -
            </button>
            <span className="stepper-value">{agentCount}</span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => setAgentCount(c => Math.min(50, c + 1))}
            >
              +
            </button>
          </div>
        </div>

        {/* 3. Red team action + target */}
        {squadType === 'red' && (
          <>
            <div className="cfg-row">
              <span className="cfg-label">ACTION</span>
              <select value={action} onChange={e => setAction(e.target.value)}>
                <option value="attack">Send payload</option>
                <option value="steal">Steal tokens</option>
              </select>
            </div>

            <div className="cfg-row">
              <span className="cfg-label">TARGET</span>
              <select
                value={players.some(p => p.id === targetId) ? targetId : ''}
                onChange={e => setTargetId(e.target.value)}
              >
                <option value="">-- Select target --</option>
                {players.map(p => {
                  const ally = Boolean(myAlliance) && p.alliance === myAlliance;
                  return (
                    <option key={p.id} value={p.id} disabled={ally}>
                      {p.name}{ally ? ' (ally)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </>
        )}

        {/* 4. Protocol selection - the core educational trap */}
        <div className="cfg-row">
          <span className="cfg-label">TEAM INSTRUCTIONS</span>
          <div className="protocol-list">
            {protocols.map(p => (
              <div key={p.id} className="protocol-item">
                <button
                  type="button"
                  className={`protocol-btn ${presetId === p.id ? 'selected' : ''}`}
                  onClick={() => {
                    setPresetId(p.id);
                    setExpandedProtocol(expandedProtocol === p.id ? null : p.id);
                  }}
                >
                  <span className="protocol-name">{p.title}</span>
                  <span className="protocol-arrow">
                    {presetId === p.id ? '[ACTIVE]' : ''}
                  </span>
                </button>
                {expandedProtocol === p.id && (
                  <div className="protocol-preview">{p.text}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5. Access policy */}
        <div className="cfg-row">
          <span className="cfg-label">ACCESS POLICY</span>
          <select value={accessMode} onChange={e => setAccessMode(e.target.value)}>
            <option value="requireApproval">Require my approval</option>
            <option value="fullAccess">Full autonomous access</option>
          </select>
        </div>
      </div>

      {configError && <div className="error-msg">{configError}</div>}

      <div className="panel-footer">
        <button type="button" className="btn deploy-btn" onClick={handleDeploy}>
          {active ? 'Redeploy' : 'Deploy'}
        </button>
      </div>
    </div>
  );
}
