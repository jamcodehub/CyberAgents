import React from 'react';

// Shared event feed: color each entry using its actor's current alliance color.
export default function LogPanel({ isOpen, logs = [], castles = [] }) {
  const colorForLog = (log) => {
    const actor = castles.find(castle => castle.id === log.playerId);
    const alliance = actor?.alliance ?? log.alliance;
    const allianceMember = alliance
      ? castles.find(castle => castle.alliance === alliance && castle.color)
      : null;
    return allianceMember?.color || actor?.color || log.color || undefined;
  };

  const isRedAlliance = (color) => {
    if (!color) return false;
    const lower = color.toLowerCase();
    return lower === '#ff5c5c' || lower === '#ff4d4d' || lower.startsWith('#ff5') || lower.startsWith('#f00');
  };

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ borderBottom: '2px solid #fff', paddingBottom: '10px', marginBottom: '20px', textTransform: 'uppercase' }}>
        &gt;_ ACTIVITY_LOGS
      </h2>
      
      {logs.length === 0 ? (
        <p>No activity detected yet. Deploy agents to begin logging.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
          {logs.map((log, i) => {
            const isHarmfulApproval = /approved harmful command/i.test(log.msg);
            const actorColor = colorForLog(log);
            const redTeam = isRedAlliance(actorColor);

            // Bold red for mistake logs, or bold white if actor's alliance is red
            const textColor = isHarmfulApproval
              ? (redTeam ? '#ffffff' : '#ff4444')
              : actorColor;
            const fontWeight = isHarmfulApproval ? 'bold' : 'normal';

            return (
              <div
                key={i}
                style={{
                  padding: '10px',
                  border: isHarmfulApproval ? '1px solid #ff4444' : '1px solid #333',
                  background: isHarmfulApproval ? '#200808' : '#111',
                  boxShadow: isHarmfulApproval ? '0 0 6px rgba(255, 68, 68, 0.4)' : undefined
                }}
              >
                <span style={{ color: isHarmfulApproval ? '#ff8888' : '#888', marginRight: '15px' }}>
                  [{log.time}]
                </span>
                <span style={{ color: textColor, fontWeight }}>
                  {log.msg}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
