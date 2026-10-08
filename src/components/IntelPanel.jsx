import React from 'react';

export default function IntelPanel({ isOpen, castles, spectator = false }) {
  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ borderBottom: '2px solid #fff', paddingBottom: '10px', marginBottom: '20px', textTransform: 'uppercase' }}>
        &gt;_ THREAT_INTEL
      </h2>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #fff', padding: '10px' }}>STATUS</th>
            <th style={{ borderBottom: '1px solid #fff', padding: '10px' }}>NODE NAME</th>
            <th style={{ borderBottom: '1px solid #fff', padding: '10px' }}>INTEGRITY</th>
            <th style={{ borderBottom: '1px solid #fff', padding: '10px' }}>TOKENS</th>
            <th style={{ borderBottom: '1px solid #fff', padding: '10px' }}>{spectator ? 'ALLIANCE' : 'AFFILIATION'}</th>
          </tr>
        </thead>
        <tbody>
          {castles.map(c => (
            <tr key={c.id} style={{ opacity: c.health > 0 ? 1 : 0.5 }}>
              <td style={{ borderBottom: '1px solid #333', padding: '10px' }}>
                {c.health > 0 ? '[ ONLINE ]' : '[ OFFLINE ]'}
              </td>
              <td style={{ borderBottom: '1px solid #333', padding: '10px' }}>
                {c.name}
              </td>
              <td style={{ borderBottom: '1px solid #333', padding: '10px' }}>
                {Math.floor(c.health)}%
              </td>
              <td style={{ borderBottom: '1px solid #333', padding: '10px' }}>
                {c.spectator ? '—' : `${Math.floor((c.tokens ?? 0) / 1000).toLocaleString()}k`}
              </td>
              <td style={{ borderBottom: '1px solid #333', padding: '10px' }}>
                {spectator ? (c.alliance || '-') : (c.isSelf ? 'FRIENDLY' : 'HOSTILE')}
              </td>
            </tr>
          ))}
          {castles.length === 0 && (
            <tr>
              <td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>NO DATA AVAILABLE. CONNECT TO NETWORK.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
