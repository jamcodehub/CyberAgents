import React from 'react';

const formatHealthPercent = (health = 0) => `${Math.floor(health / 10)}%`;

// Room roster view: shows health, tokens, and alliance identity for each base.
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
          {castles.map(c => {
            const textColor = c.spectator ? '#777' : c.alliance && c.color ? c.color : undefined;
            const cellStyle = { borderBottom: '1px solid #333', padding: '10px', color: textColor };
            return (
              <tr key={c.id} style={{ opacity: c.health > 0 ? 1 : 0.5 }}>
              <td style={cellStyle}>
                {c.health > 0 ? '[ ONLINE ]' : '[ OFFLINE ]'}
              </td>
              <td style={cellStyle}>
                {c.name}
              </td>
              <td style={cellStyle}>
                {formatHealthPercent(c.health)}
              </td>
              <td style={cellStyle}>
                {c.spectator ? '—' : `${Math.floor((c.tokens ?? 0) / 1000).toLocaleString()}k`}
              </td>
              <td style={cellStyle}>
                {c.alliance || (spectator ? '-' : c.isSelf ? 'FRIENDLY' : 'HOSTILE')}
              </td>
              </tr>
            );
          })}
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
