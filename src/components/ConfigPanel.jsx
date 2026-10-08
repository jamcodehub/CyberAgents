import React, { useRef, useState } from 'react';

const TEAM_TYPES = {
  red: {
    label: 'Red Team (Attacker Agents)',
    roles: [
      'Red Team Lead/Manager',
      'Penetration Tester',
      'Operator / Engineer',
      'Social Engineer'
    ]
  },
  blue: {
    label: 'Blue Team (Defender Agents)',
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

export default function ConfigPanel({ isOpen, connectGame, active, players = [], myAlliance = null }) {
  const [configError, setConfigError] = useState("");
  const [accessMode, setAccessMode] = useState("fullAccess");
  const [teamTypeToAdd, setTeamTypeToAdd] = useState('red');
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const idCounter = useRef(0);

  const selectedTeam = teams.find(team => team.id === selectedTeamId) || teams[0];

  const addTeam = () => {
    const teamType = teamTypeToAdd;
    const teamNumber = teams.filter(team => team.type === teamType).length + 1;
    const id = `team-${idCounter.current++}`;
    const agent = {
      id: `agent-${idCounter.current++}`,
      role: TEAM_TYPES[teamType].roles[0]
    };
    setTeams(current => [...current, {
      id,
      type: teamType,
      name: `${TEAM_TYPES[teamType].label.split(' (')[0]} ${teamNumber}`,
      action: 'attack',
      instructions: '',
      targetId: '',
      agents: [agent]
    }]);
    setSelectedTeamId(id);
  };

  const updateTeam = (teamId, updates) => {
    setTeams(current => current.map(team => team.id === teamId ? { ...team, ...updates } : team));
  };

  const addAgent = () => {
    if (!selectedTeam) return;
    const agent = {
      id: `agent-${idCounter.current++}`,
      role: TEAM_TYPES[selectedTeam.type].roles[0]
    };
    updateTeam(selectedTeam.id, { agents: [...selectedTeam.agents, agent] });
  };

  const updateAgentRole = (agentId, role) => {
    updateTeam(selectedTeam.id, {
      agents: selectedTeam.agents.map(agent => agent.id === agentId ? { ...agent, role } : agent)
    });
  };

  const removeAgent = (agentId) => {
    updateTeam(selectedTeam.id, {
      agents: selectedTeam.agents.filter(agent => agent.id !== agentId)
    });
  };

  const removeTeam = () => {
    if (!selectedTeam) return;
    const remainingTeams = teams.filter(team => team.id !== selectedTeam.id);
    setTeams(remainingTeams);
    setSelectedTeamId(remainingTeams[0]?.id || null);
  };

  const handleDeploy = () => {
    try {
      const agentCount = teams.reduce((total, team) => total + team.agents.length, 0);
      if (teams.length === 0 || agentCount === 0) {
        throw new Error('Add at least one team and one agent before deploying.');
      }
      if (agentCount > 50) {
        throw new Error("Resource limit exceeded. Maximum team total is 50 agents.");
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
        .map(team => ({ teamId: team.id, targetId: team.targetId, count: team.agents.length, action: team.action || 'attack' }));
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

      setConfigError("");
      connectGame(parsedConfig);
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
            <option value="fullAccess">Grant full access</option>
            <option value="requireApproval">Ask me before every task</option>
          </select>
          <p>
            {accessMode === "requireApproval"
              ? "Attacker agents must show you a simulated terminal command to send each payload. Review it before approving."
              : "Agents send simulated payloads without asking and may destabilize Homebase."}
            {" "}Simulation only; no real system is accessed.
          </p>
        </div>

        <div className="team-builder">
          <h3>TEAM ROSTER</h3>
          <p className="token-rules">100k starting balance · 1k per agent action · steal up to 10k from a target</p>
          <div className="team-add-row">
            <select value={teamTypeToAdd} onChange={event => setTeamTypeToAdd(event.target.value)} aria-label="Team type to add">
              {Object.entries(TEAM_TYPES).map(([value, team]) => (
                <option key={value} value={value}>{team.label}</option>
              ))}
            </select>
            <button className="team-action" onClick={addTeam}>Add team</button>
          </div>

          {teams.length > 0 ? (
            <>
              <label className="team-select-label" htmlFor="configured-team">CONFIGURE TEAM</label>
              <select
                id="configured-team"
                value={selectedTeam?.id || ''}
                onChange={event => setSelectedTeamId(event.target.value)}
              >
                {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>

              {selectedTeam && (
                <div className="team-editor">
                  <label htmlFor="team-name">TEAM NAME</label>
                  <input
                    id="team-name"
                    value={selectedTeam.name}
                    onChange={event => updateTeam(selectedTeam.id, { name: event.target.value })}
                  />
                  {selectedTeam.type === 'red' && (
                    <>
                      <label htmlFor="team-action">RED TEAM ACTION</label>
                      <select
                        id="team-action"
                        value={selectedTeam.action || 'attack'}
                        onChange={event => updateTeam(selectedTeam.id, { action: event.target.value })}
                      >
                        <option value="attack">Send payload</option>
                        <option value="steal">Steal tokens</option>
                      </select>
                      <label htmlFor="team-target">TARGET (REQUIRED FOR AGENT ACTIONS)</label>
                      <select
                        id="team-target"
                        value={players.some(p => p.id === selectedTeam.targetId) ? selectedTeam.targetId : ''}
                        onChange={event => updateTeam(selectedTeam.id, { targetId: event.target.value })}
                      >
                        <option value="">No target</option>
                        {players.map(p => {
                          const ally = Boolean(myAlliance) && p.alliance === myAlliance;
                          return (
                            <option key={p.id} value={p.id} disabled={ally}>
                              {p.name}{ally ? ' (ally)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </>
                  )}

                  <div className="agent-list-heading">
                    <h4>{selectedTeam.agents.length} AGENT{selectedTeam.agents.length === 1 ? '' : 'S'}</h4>
                    <button className="team-action" onClick={addAgent}>Add agent</button>
                  </div>
                  <details className="team-advanced-settings">
                    <summary>Advanced team settings</summary>
                    <label htmlFor="team-instructions">TEAM INSTRUCTIONS</label>
                    <textarea
                      id="team-instructions"
                      value={selectedTeam.instructions}
                      onChange={event => updateTeam(selectedTeam.id, { instructions: event.target.value })}
                      placeholder="Describe this team's objectives and constraints."
                      rows={3}
                    />
                    <h4>AGENT ROLES</h4>
                    {selectedTeam.agents.length === 0 && <p className="empty-roster">Add an agent to configure its role.</p>}
                    {selectedTeam.agents.map((agent, index) => (
                      <div className="agent-row" key={agent.id}>
                        <span>Agent {index + 1}</span>
                        <select
                          value={agent.role}
                          onChange={event => updateAgentRole(agent.id, event.target.value)}
                          aria-label={`Role for ${selectedTeam.name} agent ${index + 1}`}
                        >
                          {TEAM_TYPES[selectedTeam.type].roles.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                        <button className="remove-agent" onClick={() => removeAgent(agent.id)} aria-label={`Remove agent ${index + 1}`} title="Remove agent">×</button>
                      </div>
                    ))}
                  </details>
                  <button className="remove-team" onClick={removeTeam}>Remove team</button>
                </div>
              )}
            </>
          ) : (
            <p className="empty-roster">Add a Red Team or Blue Team to begin configuring agents.</p>
          )}
        </div>
      </div>

      {configError && <div className="error-msg">{configError}</div>}

      <button className="btn" onClick={handleDeploy}>
        {active ? "Update & Redeploy" : "Deploy Agents"}
      </button>
    </div>
  );
}
