import React, { useState } from 'react';
import { ALLIANCE_COLORS } from '../data/colors';

const PRESET_ALLIANCE_NAMES = [
  'CYBER VANGUARD',
  'IRON SYNDICATE',
  'SHADOW COALITION',
  'NULL SECTOR',
  'AEGIS GUARD',
  'PHANTOM ORDER',
  'CIPHER CORE',
  'DELTA SYNDICATE',
  'SPECTRE NET',
  'VECTOR PROTOCOL'
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
  onSetAlliance,
  spectator = false
}) {
  const [selectedPreset, setSelectedPreset] = useState('');
  const [pickedColor, setPickedColor] = useState(null);

  const groups = {};
  castles.forEach(c => {
    if (c.alliance) (groups[c.alliance] = groups[c.alliance] || []).push(c);
  });
  const allianceNames = Object.keys(groups);
  const colorOf = (allianceName) => groups[allianceName].find(c => c.color)?.color || null;

  const allUsed = new Set(allianceNames.map(colorOf).filter(Boolean));
  const firstFree = ALLIANCE_COLORS.find(c => !allUsed.has(c)) || ALLIANCE_COLORS[0];
  const newColor = pickedColor && !allUsed.has(pickedColor) ? pickedColor : firstFree;

  // Filter available preset names that are not already active
  const availablePresets = PRESET_ALLIANCE_NAMES.filter(n => !allianceNames.includes(n));
  const effectivePreset = selectedPreset && availablePresets.includes(selectedPreset)
    ? selectedPreset
    : (availablePresets[0] || 'GRID COALITION');

  const formAlliance = () => {
    if (!effectivePreset) return;
    onSetAlliance(effectivePreset, newColor);
    setSelectedPreset('');
    setPickedColor(null);
  };

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ marginBottom: '10px' }}>&gt;_ ALLIANCES</h2>

      <div className="config-section">
        {!spectator && (
          <div className="alliance-box">
            <label htmlFor="alliance-preset-select">FORM NEW ALLIANCE</label>
            <div className="alliance-form">
              <select
                id="alliance-preset-select"
                value={effectivePreset}
                onChange={event => setSelectedPreset(event.target.value)}
              >
                {availablePresets.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {availablePresets.length === 0 && (
                  <option value="GRID COALITION">GRID COALITION</option>
                )}
              </select>
              <button className="team-action" onClick={formAlliance}>Form</button>
            </div>
            <label style={{ marginTop: '10px' }}>ALLIANCE COLOR</label>
            <Swatches selected={newColor} taken={allUsed} onPick={setPickedColor} />
          </div>
        )}

        <div className="alliance-box">
          <h3>ACTIVE ALLIANCES</h3>
          {allianceNames.length === 0 && <p className="empty-roster">No alliances formed yet.</p>}
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

      {!spectator && myAlliance && (
        <div className="panel-footer">
          <button
            type="button"
            className="remove-team"
            onClick={() => onSetAlliance(null)}
          >
            Leave alliance ({myAlliance})
          </button>
        </div>
      )}
    </div>
  );
}
