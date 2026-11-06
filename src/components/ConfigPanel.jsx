import React, { useRef, useState } from 'react';
import {
  INSTRUCTION_PRESETS,
  DEFAULT_PRESET_BY_TYPE
} from '../data/instructionPresets';

const TEAM_TYPES = {
  red: {
    label: 'Red Team (Attacker / Offense)',
    badge: 'OFFENSE',
    color: '#ff5c5c',
    roles: [
      'Red Team Lead/Manager',
      'Penetration Tester',
      'Operator / Engineer',
      'Social Engineer'
    ]
  },
  blue: {
    label: 'Blue Team (Defender / Defense)',
    badge: 'DEFENSE',
    color: '#4de1ff',
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
  myAlliance = null,
  activeTab = 'create',
  onTabChange
}) {
  const [internalTab, setInternalTab] = useState('create');
  const currentTab = (activeTab === 'create' || activeTab === 'config') ? activeTab : internalTab;

  const [configError, setConfigError] = useState('');
  const [accessMode, setAccessMode] = useState('fullAccess');

  // Squad and agent rosters
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const idCounter = useRef(0);

  // Agent Create tab local state
  const [createSquadType, setCreateSquadType] = useState('red');
  const [createRole, setCreateRole] = useState(TEAM_TYPES.red.roles[0]);
  const [createSquadName, setCreateSquadName] = useState('Red Team 1');
  const [recruitTeamId, setRecruitTeamId] = useState('');
  const [recruitRole, setRecruitRole] = useState('');
  const [creationFeedback, setCreationFeedback] = useState('');

  // Agent Config tab local state
  const [presetFilter, setPresetFilter] = useState('all');

  const handleSquadTypeChange = (nextType) => {
    setCreateSquadType(nextType);
    setCreateRole(TEAM_TYPES[nextType].roles[0]);
    const nextNumber = teams.filter(t => t.type === nextType).length + 1;
    setCreateSquadName(`${nextType === 'red' ? 'Red' : 'Blue'} Team ${nextNumber}`);
  };

  const switchTab = (tab) => {
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const selectedTeam = teams.find(team => team.id === selectedTeamId) || teams[0] || null;

  const updateTeam = (teamId, updates) => {
    setTeams(current => current.map(team => team.id === teamId ? { ...team, ...updates } : team));
  };

  // Create a new team squad
  const handleCreateSquad = () => {
    const teamType = createSquadType;
    const teamNumber = teams.filter(team => team.type === teamType).length + 1;
    const defaultPresetId = DEFAULT_PRESET_BY_TYPE[teamType] || 'aegis-offensive';
    const defaultPreset = INSTRUCTION_PRESETS.find(p => p.id === defaultPresetId) || INSTRUCTION_PRESETS[0];
    const squadName = createSquadName.trim() || `${teamType === 'red' ? 'Red' : 'Blue'} Team ${teamNumber}`;
    const id = `team-${idCounter.current++}`;
    const agent = {
      id: `agent-${idCounter.current++}`,
      role: createRole || TEAM_TYPES[teamType].roles[0]
    };

    const newTeam = {
      id,
      type: teamType,
      name: squadName,
      action: 'attack',
      instructions: defaultPreset.text,
      instructionPresetId: defaultPreset.id,
      instructionStatus: defaultPreset.status,
      targetId: '',
      agents: [agent]
    };

    setTeams(current => [...current, newTeam]);
    setSelectedTeamId(id);
    setCreationFeedback(`Created "${squadName}" with 1 ${agent.role}.`);
    setConfigError('');
  };

  // Derive active recruit selections
  const activeRecruitTeamId = recruitTeamId && teams.some(t => t.id === recruitTeamId) ? recruitTeamId : (teams[0]?.id || '');
  const currentRecruitTeam = teams.find(t => t.id === activeRecruitTeamId);
  const activeRecruitRole = (recruitRole && currentRecruitTeam && TEAM_TYPES[currentRecruitTeam.type].roles.includes(recruitRole))
    ? recruitRole
    : (currentRecruitTeam ? TEAM_TYPES[currentRecruitTeam.type].roles[0] : '');

  // Recruit an additional agent to an existing squad
  const handleRecruitAgent = () => {
    if (!currentRecruitTeam) return;
    const agentRole = activeRecruitRole;
    const agent = {
      id: `agent-${idCounter.current++}`,
      role: agentRole
    };
    updateTeam(currentRecruitTeam.id, { agents: [...currentRecruitTeam.agents, agent] });
    setCreationFeedback(`Added ${agentRole} to "${currentRecruitTeam.name}". Squad now has ${currentRecruitTeam.agents.length + 1} agents.`);
  };

  // Add agent directly from Config tab
  const addAgentToSelectedTeam = () => {
    if (!selectedTeam) return;
    const agent = {
      id: `agent-${idCounter.current++}`,
      role: TEAM_TYPES[selectedTeam.type].roles[0]
    };
    updateTeam(selectedTeam.id, { agents: [...selectedTeam.agents, agent] });
  };

  const updateAgentRole = (agentId, role) => {
    if (!selectedTeam) return;
    updateTeam(selectedTeam.id, {
      agents: selectedTeam.agents.map(agent => agent.id === agentId ? { ...agent, role } : agent)
    });
  };

  const removeAgent = (agentId) => {
    if (!selectedTeam) return;
    updateTeam(selectedTeam.id, {
      agents: selectedTeam.agents.filter(agent => agent.id !== agentId)
    });
  };

  const removeTeam = (teamIdToRemove) => {
    const idToRemove = teamIdToRemove || selectedTeam?.id;
    if (!idToRemove) return;
    const remainingTeams = teams.filter(team => team.id !== idToRemove);
    setTeams(remainingTeams);
    setSelectedTeamId(remainingTeams[0]?.id || null);
    setCreationFeedback('');
  };

  // Apply a specific instruction preset to the selected team
  const applyInstructionPreset = (preset) => {
    if (!selectedTeam) return;
    updateTeam(selectedTeam.id, {
      instructions: preset.text,
      instructionPresetId: preset.id,
      instructionStatus: preset.status
    });
  };

  const handleDeploy = () => {
    try {
      const agentCount = teams.reduce((total, team) => total + team.agents.length, 0);
      if (teams.length === 0 || agentCount === 0) {
        throw new Error('Create at least one squad and agent before deploying.');
      }
      if (agentCount > 50) {
        throw new Error('Resource limit exceeded. Maximum total is 50 agents.');
      }

      const redAgents = teams.filter(team => team.type === 'red').flatMap(team => team.agents);
      const blueAgents = teams.filter(team => team.type === 'blue').flatMap(team => team.agents);
      const reconRoles = new Set([
        'Penetration Tester',
        'SOC Analyst',
        'Digital Forensics Analyst',
        'Malware Analyst',
        'Threat Intelligence Analyst',
        'Vulnerability Analyst'
      ]);

      const attacks = teams
        .filter(team => team.type === 'red' && team.targetId && team.agents.length > 0
          && players.some(p => p.id === team.targetId))
        .map(team => ({
          teamId: team.id,
          targetId: team.targetId,
          count: team.agents.length,
          action: team.action || 'attack',
          instructions: team.instructions || '',
          instructionStatus: team.instructionStatus || 'secure'
        }));

      const parsedConfig = {
        accessMode,
        teams,
        attacks,
        swarm: { red: redAgents.length, blue: blueAgents.length },
        roles: {
          recon: { count: teams.flatMap(team => team.agents).filter(agent => reconRoles.has(agent.role)).length },
          assault: { count: redAgents.length },
          defense: { count: blueAgents.length, firewall: blueAgents.length > 0 }
        }
      };

      setConfigError('');
      connectGame(parsedConfig);
    } catch (e) {
      setConfigError(e.message || 'Configuration error.');
    }
  };

  // Filtered instruction presets for the selector
  const availablePresets = INSTRUCTION_PRESETS.filter(preset => {
    if (presetFilter === 'all') return true;
    return preset.type === presetFilter || preset.type === 'any';
  });

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header-block">
        <h2 style={{ marginBottom: '8px' }}>&gt;_ AGENT_OPERATIONS</h2>
        {/* Navigation tabs between Create and Config */}
        <div className="panel-tab-bar" role="tablist" aria-label="Agent options tabs">
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'create'}
            className={`panel-tab-btn ${currentTab === 'create' ? 'active' : ''}`}
            onClick={() => switchTab('create')}
          >
            [+] AGENT CREATE
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'config'}
            className={`panel-tab-btn ${currentTab === 'config' ? 'active' : ''}`}
            onClick={() => switchTab('config')}
          >
            [CONFIG] AGENT CONFIG {teams.length > 0 ? `(${teams.length})` : ''}
          </button>
        </div>
      </div>

      <div className="config-section">
        {/* ======================================================== */}
        {/* TAB 1: AGENT CREATE                                      */}
        {/* ======================================================== */}
        {currentTab === 'create' && (
          <div className="tab-pane create-pane">
            {creationFeedback && (
              <div className="feedback-banner">
                <span>{creationFeedback}</span>
                <button
                  type="button"
                  className="feedback-dismiss"
                  onClick={() => setCreationFeedback('')}
                  aria-label="Dismiss feedback"
                >
                  ×
                </button>
              </div>
            )}

            <div className="builder-card">
              <h3>CREATE NEW SQUAD</h3>
              
              {/* Step 1: Alignment */}
              <label>STEP 1: SQUAD ALIGNMENT</label>
              <div className="squad-type-grid">
                <button
                  type="button"
                  className={`squad-type-btn ${createSquadType === 'red' ? 'selected-red' : ''}`}
                  onClick={() => handleSquadTypeChange('red')}
                >
                  <span className="squad-type-title" style={{ color: '#ff5c5c' }}>RED SQUAD (Offense)</span>
                </button>
                <button
                  type="button"
                  className={`squad-type-btn ${createSquadType === 'blue' ? 'selected-blue' : ''}`}
                  onClick={() => handleSquadTypeChange('blue')}
                >
                  <span className="squad-type-title" style={{ color: '#4de1ff' }}>BLUE SQUAD (Defense)</span>
                </button>
              </div>

              {/* Step 2: Role */}
              <label htmlFor="create-role-select">STEP 2: STARTING SPECIALIST ROLE</label>
              <select
                id="create-role-select"
                value={createRole}
                onChange={e => setCreateRole(e.target.value)}
              >
                {TEAM_TYPES[createSquadType].roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>

              {/* Step 3: Squad Name */}
              <label htmlFor="create-squad-name" style={{ marginTop: '10px' }}>STEP 3: SQUAD NAME</label>
              <input
                id="create-squad-name"
                value={createSquadName}
                onChange={e => setCreateSquadName(e.target.value)}
                placeholder="e.g. Red Team 1"
              />

              <button
                type="button"
                className="btn primary-action-btn"
                style={{ marginTop: '12px' }}
                onClick={handleCreateSquad}
              >
                + Create Squad
              </button>
            </div>

            {/* If squads exist, show quick recruit to existing squad */}
            {teams.length > 0 && (
              <div className="builder-card" style={{ marginTop: '14px' }}>
                <h3>RECRUIT AGENTS TO SQUAD</h3>
                <p className="token-rules">1k tokens per agent action · 50 total agent limit</p>
                
                <label htmlFor="recruit-target-team">SELECT SQUAD</label>
                <select
                  id="recruit-target-team"
                  value={activeRecruitTeamId}
                  onChange={e => {
                    const nextId = e.target.value;
                    setRecruitTeamId(nextId);
                    const t = teams.find(team => team.id === nextId);
                    if (t) setRecruitRole(TEAM_TYPES[t.type].roles[0]);
                  }}
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type === 'red' ? 'Offense' : 'Defense'} · {t.agents.length} Agent{t.agents.length === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>

                {currentRecruitTeam && (
                  <>
                    <label htmlFor="recruit-role-select" style={{ marginTop: '8px' }}>SPECIALIST ROLE</label>
                    <select
                      id="recruit-role-select"
                      value={activeRecruitRole}
                      onChange={e => setRecruitRole(e.target.value)}
                    >
                      {TEAM_TYPES[currentRecruitTeam.type].roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="team-action"
                      style={{ marginTop: '10px', width: '100%', padding: '8px' }}
                      onClick={handleRecruitAgent}
                    >
                      + Recruit Specialist Agent
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Overview of current squads */}
            {teams.length > 0 && (
              <div className="squad-overview-section" style={{ marginTop: '14px' }}>
                <h4>ACTIVE SQUADS ({teams.length})</h4>
                <div className="squad-cards-list">
                  {teams.map(team => (
                    <div key={team.id} className="squad-summary-row">
                      <div className="squad-meta">
                        <span className={`type-tag ${team.type}`}>{team.type === 'red' ? 'RED' : 'BLUE'}</span>
                        <strong className="squad-name">{team.name}</strong>
                        <span className="agent-count">({team.agents.length} agent{team.agents.length === 1 ? '' : 's'})</span>
                      </div>
                      <button
                        type="button"
                        className="quick-config-btn"
                        onClick={() => {
                          setSelectedTeamId(team.id);
                          switchTab('config');
                        }}
                      >
                        Configure &gt;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: AGENT CONFIG                                      */}
        {/* ======================================================== */}
        {currentTab === 'config' && (
          <div className="tab-pane config-pane">
            {teams.length === 0 ? (
              <div className="empty-config-state">
                <h3>NO SQUADS CREATED YET</h3>
                <p>You have not created any agent squads. Head to the Agent Create tab to form your first team.</p>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: '14px' }}
                  onClick={() => switchTab('create')}
                >
                  -&gt; Open Agent Create Tab
                </button>
              </div>
            ) : (
              <>
                {/* Squad Selector Carousel/Pills */}
                <label className="section-label">SELECT SQUAD TO CONFIGURE</label>
                <div className="squad-pills" role="tablist" aria-label="Configured squads">
                  {teams.map(team => (
                    <button
                      key={team.id}
                      type="button"
                      className={`squad-pill ${selectedTeam?.id === team.id ? 'active' : ''}`}
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      <span className={`pill-dot ${team.type}`} />
                      {team.name} ({team.agents.length})
                    </button>
                  ))}
                </div>

                {selectedTeam && (
                  <div className="team-config-card">
                    {/* Squad Name */}
                    <label htmlFor="team-rename">SQUAD NAME</label>
                    <input
                      id="team-rename"
                      value={selectedTeam.name}
                      onChange={e => updateTeam(selectedTeam.id, { name: e.target.value })}
                    />

                    {/* Red Team Objectives & Targeting */}
                    {selectedTeam.type === 'red' ? (
                      <div className="red-objectives-box">
                        <label htmlFor="team-action">RED TEAM OBJECTIVE</label>
                        <select
                          id="team-action"
                          value={selectedTeam.action || 'attack'}
                          onChange={e => updateTeam(selectedTeam.id, { action: e.target.value })}
                        >
                          <option value="attack">Send simulated payload (Damage base)</option>
                          <option value="steal">Steal tokens (Acquire up to 10k)</option>
                        </select>

                        <label htmlFor="team-target" style={{ marginTop: '8px' }}>
                          TARGET SYSTEM (REQUIRED FOR RED SQUAD)
                        </label>
                        <select
                          id="team-target"
                          value={players.some(p => p.id === selectedTeam.targetId) ? selectedTeam.targetId : ''}
                          onChange={e => updateTeam(selectedTeam.id, { targetId: e.target.value })}
                        >
                          <option value="">-- Choose Opponent Target --</option>
                          {players.map(p => {
                            const ally = Boolean(myAlliance) && p.alliance === myAlliance;
                            return (
                              <option key={p.id} value={p.id} disabled={ally}>
                                {p.name}{ally ? ' (ally - off limits)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : (
                      <div className="blue-defense-card">
                        <div className="blue-badge-title">CASTLE DEFENSE ACTIVE</div>
                        <p>Blue squads fortify Homebase firewalls and provide real-time telemetry to detect inbound adversary probes.</p>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* TEAM INSTRUCTIONS (PROMPT FILE)                          */}
                    {/* ======================================================== */}
                    <div className="instructions-section">
                      <div className="instruction-header">
                        <h4>TEAM INSTRUCTIONS</h4>
                      </div>
                      <p className="instruction-help-text">
                        Select an instruction prompt file for this squad. Review its rules, delegations, and security protocols before deploying.
                      </p>

                      {/* Filter by squad type */}
                      <div className="preset-filter-row">
                        <span>Show:</span>
                        <button
                          type="button"
                          className={`filter-btn ${presetFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setPresetFilter('all')}
                        >
                          All ({INSTRUCTION_PRESETS.length})
                        </button>
                        <button
                          type="button"
                          className={`filter-btn ${presetFilter === 'red' ? 'active' : ''}`}
                          onClick={() => setPresetFilter('red')}
                        >
                          Offense (Red)
                        </button>
                        <button
                          type="button"
                          className={`filter-btn ${presetFilter === 'blue' ? 'active' : ''}`}
                          onClick={() => setPresetFilter('blue')}
                        >
                          Defense (Blue)
                        </button>
                      </div>

                      {/* Instruction Preset Selector Dropdown */}
                      <label htmlFor="instruction-preset-select">INSTRUCTION PROMPT FILE</label>
                      <select
                        id="instruction-preset-select"
                        value={selectedTeam.instructionPresetId || ''}
                        onChange={e => {
                          const preset = INSTRUCTION_PRESETS.find(p => p.id === e.target.value);
                          if (preset) applyInstructionPreset(preset);
                        }}
                      >
                        {availablePresets.map(preset => (
                          <option key={preset.id} value={preset.id}>
                            {preset.title}
                          </option>
                        ))}
                      </select>

                      {/* Prompt Viewer Box */}
                      <div className="prompt-reader-box" aria-label="Instruction prompt text">
                        {selectedTeam.instructions || 'No instructions configured.'}
                      </div>
                    </div>

                    {/* Squad Agents Roster */}
                    <div className="agent-roster-section">
                      <div className="agent-list-heading">
                        <h4>{selectedTeam.agents.length} AGENT{selectedTeam.agents.length === 1 ? '' : 'S'} ASSIGNED</h4>
                        <button type="button" className="team-action" onClick={addAgentToSelectedTeam}>
                          + Add Agent
                        </button>
                      </div>

                      {selectedTeam.agents.map((agent, index) => (
                        <div className="agent-row" key={agent.id}>
                          <span>Agent {index + 1}</span>
                          <select
                            value={agent.role}
                            onChange={e => updateAgentRole(agent.id, e.target.value)}
                            aria-label={`Role for Agent ${index + 1}`}
                          >
                            {TEAM_TYPES[selectedTeam.type].roles.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="remove-agent"
                            onClick={() => removeAgent(agent.id)}
                            aria-label={`Remove agent ${index + 1}`}
                            title="Remove agent"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Homebase Access Policy */}
                    <div className="access-control" style={{ marginTop: '14px' }}>
                      <label htmlFor="homebase-access">HOMEBASE ACCESS POLICY</label>
                      <select
                        id="homebase-access"
                        value={accessMode}
                        onChange={e => setAccessMode(e.target.value)}
                      >
                        <option value="requireApproval">Require human approval (Human-in-the-Loop Safeguard)</option>
                        <option value="fullAccess">Grant full autonomous access</option>
                      </select>
                      <p className="access-note">
                        {accessMode === 'requireApproval'
                          ? 'SECURITY POLICY: Agents will present simulated commands for your approval before execution.'
                          : 'AUTONOMOUS MODE: Agents will dispatch simulated payloads without prompting.'}
                      </p>
                    </div>

                    {/* Remove Squad */}
                    <button
                      type="button"
                      className="remove-team"
                      style={{ marginTop: '14px' }}
                      onClick={() => removeTeam(selectedTeam.id)}
                    >
                      Delete Squad ({selectedTeam.name})
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {configError && <div className="error-msg">{configError}</div>}

      {/* Deployment Action */}
      <div className="panel-footer">
        <button type="button" className="btn deploy-btn" onClick={handleDeploy}>
          {active ? 'Update & Redeploy' : 'Deploy Agents to Match'}
        </button>
      </div>
    </div>
  );
}
