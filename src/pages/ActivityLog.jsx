import React from 'react';

export default function ActivityLog({ logs }) {
  return (
    <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
      <h1 style={{ borderBottom: '2px solid #fff', paddingBottom: '10px', marginBottom: '20px', textTransform: 'uppercase' }}>
        &gt;_ ACTIVITY_LOGS
      </h1>
      
      {logs.length === 0 ? (
        <p>No activity detected yet. Deploy agents to begin logging.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {logs.map((log, i) => (
            <div key={i} style={{ padding: '10px', border: '1px solid #333', background: '#111' }}>
              <span style={{ color: '#888', marginRight: '15px' }}>[{log.time}]</span>
              <span>{log.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
