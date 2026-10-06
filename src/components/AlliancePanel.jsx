import React, { useState } from 'react';

export const ALLIANCE_COLORS = [
  '#ff5c5c', '#ffb347', '#ffe14d', '#5cff8a',
  '#4de1ff', '#5c8aff', '#c77dff', '#ff7ad9'
];

function Swatches({ selected, taken, onPick }) {
  return (
    <div className="color-swatches">
      {ALLIANCE_COLORS.map(color => (
        <button
          key={color}
          type="button"
          className={`swatch ${selected === color ? 'selected' : ''}`}
          style={{ background: color }}
          disabled={taken.has(color) && selected !== color}
          onClick={() => onPick(color)}
          aria-label={`Color ${color}`}
          title={taken.has(color) && selected !== color ? 'Used by another alliance' : color}
        />
      ))}
    </div>
  );
}

export default function AlliancePanel({
  isOpen,
  castles,
  myAlliance,
  myColor,
  onSetAlliance,
  onSetAllianceColor,
  spectator = false
}) {
  const [name, setName] = useState('');
  const [pickedColor, setPickedColor] = useState(null);

  const groups = {};
  castles.forEach(c => {
    if (c.alliance) (groups[c.alliance] = groups[c.alliance] || []).push(c);
  });
  const allianceNames = Object.keys(groups);
  const colorOf = (allianceName) => groups[allianceName].find(c => c.color)?.color || null;

  // Colors used by alliances other than mine
  const usedByOthers = new Set(
    allianceNames.filter(n => n !== myAlliance).map(colorOf).filter(Boolean)
  );
  const allUsed = new Set(allianceNames.map(colorOf).filter(Boolean));
  const firstFree = ALLIANCE_COLORS.find(c => !allUsed.has(c)) || ALLIANCE_COLORS[0];
  const newColor = pickedColor && !allUsed.has(pickedColor) ? pickedColor : firstFree;

  const formAlliance = () => {
    const label = name.trim().toUpperCase().slice(0, 20);
    if (!label) return;
    onSetAlliance(label, newColor);
    setName('');
    setPickedColor(null);
  };

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ marginBottom: '10px' }}>&gt;_ ALLIANCES</h2>

      <div className="config-section">
        {!spectator && (
          <>
            <div className="alliance-box">
              <p>YOUR ALLIANCE: <strong>{myAlliance || 'NONE'}</strong></p>
              <p className="empty-roster">Bases in the same alliance never attack each other.</p>
              {myAlliance && (
                <>
                  <label>ALLIANCE COLOR</label>
                  <Swatches selected={myColor} taken={usedByOthers} onPick={onSetAllianceColor} />
                  <button className="remove-team" onClick={() => onSetAlliance(null)}>Leave alliance</button>
                </>
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
              <label style={{ marginTop: '10px' }}>COLOR FOR A NEW ALLIANCE</label>
              <Swatches selected={newColor} taken={allUsed} onPick={setPickedColor} />
            </div>
          </>
        )}

        <div className="alliance-box">
          <h3>ACTIVE ALLIANCES</h3>
          {allianceNames.length === 0 && <p className="empty-roster">No alliances yet.</p>}
          {allianceNames.map(allianceName => (
            <div className="alliance-row" key={allianceName}>
              <div>
                <div>
                  <span className="alliance-dot" style={{ background: colorOf(allianceName) || '#fff' }} />
                  {allianceName}
                </div>
                <div className="alliance-members">
                  {groups[allianceName].map(c => (c.isSelf ? `${c.name} (you)` : c.name)).join(', ')}
                </div>
              </div>
              {!spectator && (
                <button
                  className="team-action"
                  disabled={myAlliance === allianceName}
                  onClick={() => onSetAlliance(allianceName)}
                >
                  {myAlliance === allianceName ? 'Joined' : 'Join'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
