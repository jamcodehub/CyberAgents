import React from 'react';

export default function LogPanel({ isOpen, logs, castles }) {
  const allianceColors = new Map(
    castles.filter(castle => castle.alliance && castle.color)
      .map(castle => [castle.alliance, castle.color])
  );

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ borderBottom: '2px solid #fff', paddingBottom: '10px', marginBottom: '20px', textTransform: 'uppercase' }}>
        &gt;_ ACTIVITY_LOGS
      </h2>
      
      {logs.length === 0 ? (
        <p>No activity detected yet. Deploy agents to begin logging.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
          {logs.map((log, i) => (
            <div key={i} style={{ padding: '10px', border: '1px solid #333', background: '#111' }}>
              <span style={{ color: '#888', marginRight: '15px' }}>[{log.time}]</span>
              <span style={{ color: allianceColors.get(log.alliance) || log.color || undefined }}>
                {log.msg}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
