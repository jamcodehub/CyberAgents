import React, { useState } from 'react';

export default function AlliancePanel({ isOpen, castles, myAlliance, onSetAlliance }) {
  const [name, setName] = useState('');

  const groups = {};
  castles.forEach(c => {
    if (c.alliance) (groups[c.alliance] = groups[c.alliance] || []).push(c);
  });
  const allianceNames = Object.keys(groups);

  const formAlliance = () => {
    const label = name.trim().toUpperCase().slice(0, 20);
    if (!label) return;
    onSetAlliance(label);
    setName('');
  };

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ marginBottom: '10px' }}>&gt;_ ALLIANCES</h2>

      <div className="config-section">
        <div className="alliance-box">
          <p>YOUR ALLIANCE: <strong>{myAlliance || 'NONE'}</strong></p>
          <p className="empty-roster">Bases in the same alliance never attack each other.</p>
          {myAlliance && (
            <button className="remove-team" onClick={() => onSetAlliance(null)}>Leave alliance</button>
          )}
        </div>

        <div className="alliance-box">
          <label htmlFor="alliance-name">FORM / JOIN ALLIANCE</label>
          <div className="alliance-form">
            <input
              id="alliance-name"
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') formAlliance(); }}
              placeholder="Alliance name"
              maxLength={20}
            />
            <button className="team-action" onClick={formAlliance}>Go</button>
          </div>
        </div>

        <div className="alliance-box">
          <h3>ACTIVE ALLIANCES</h3>
          {allianceNames.length === 0 && <p className="empty-roster">No alliances yet.</p>}
          {allianceNames.map(allianceName => (
            <div className="alliance-row" key={allianceName}>
              <div>
                <div>{allianceName}</div>
                <div className="alliance-members">
                  {groups[allianceName].map(c => (c.isSelf ? `${c.name} (you)` : c.name)).join(', ')}
                </div>
              </div>
              <button
                className="team-action"
                disabled={myAlliance === allianceName}
                onClick={() => onSetAlliance(allianceName)}
              >
                {myAlliance === allianceName ? 'Joined' : 'Join'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
