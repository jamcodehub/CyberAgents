import React from 'react';

export default function ActivityLog({ logs = [] }) {
  const isRedAlliance = (color) => {
    if (!color) return false;
    const lower = color.toLowerCase();
    return lower === '#ff5c5c' || lower === '#ff4d4d' || lower.startsWith('#ff5') || lower.startsWith('#f00');
  };

  return (
    <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
      <h1 style={{ borderBottom: '2px solid #fff', paddingBottom: '10px', marginBottom: '20px', textTransform: 'uppercase' }}>
        &gt;_ ACTIVITY_LOGS
      </h1>
      
      {logs.length === 0 ? (
        <p>No activity detected yet. Deploy agents to begin logging.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {logs.map((log, i) => {
            const isHarmfulApproval = /approved harmful command/i.test(log.msg);
            const redTeam = isRedAlliance(log.color);
            const textColor = isHarmfulApproval
              ? (redTeam ? '#ffffff' : '#ff4444')
              : (log.color || undefined);
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
