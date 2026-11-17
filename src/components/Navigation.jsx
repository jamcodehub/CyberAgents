import React, { useState } from 'react';

const LABELS = {
  battlefield: 'Battlefield',
  config: 'Agent Config',
  intel: 'Threat Intel',
  logs: 'Activity Logs',
  alliances: 'Alliances'
};

const buttonStyle = (selected, dashed = false) => ({
  color: selected ? '#000' : '#fff',
  backgroundColor: selected ? '#fff' : 'transparent',
  textDecoration: 'none',
  padding: '10px',
  border: `1px ${dashed ? 'dashed' : 'solid'} #fff`,
  fontFamily: 'inherit',
  fontSize: '1.2rem',
  textTransform: 'uppercase',
  cursor: 'pointer',
  textAlign: 'left'
});

export default function Navigation({
  pin,
  agentId,
  openPanel,
  onTogglePanel,
  onLeave,
  isHost = false,
  panels = [null, 'config', 'intel', 'logs', 'alliances']
}) {
  const [showPin, setShowPin] = useState(false);
  const items = panels.map((panel, i) => ({
    panel,
    label: `[${i + 1}] ${LABELS[panel ?? 'battlefield']}`
  }));

  const handleLeave = () => {
    if (isHost && !window.confirm('Leaving ends the game for everyone. Continue?')) return;
    onLeave();
  };

  return (
    <>
      <div className="sidebar" style={{ width: '250px', zIndex: 100, position: 'relative' }}>
        <h1 className="title" style={{ fontSize: '1.8rem' }}>&gt;_ MENU</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => onTogglePanel(item.panel)}
              style={buttonStyle(openPanel === item.panel)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="menu-agent-id" title={`Your in-game identity: ${agentId}`}>
          AGENT ID: <strong>{agentId}</strong>
        </div>

        <button onClick={handleLeave} style={{ ...buttonStyle(false, true), marginTop: 'auto' }}>
          {isHost ? '<- End Game' : '<- Back to Lobby'}
        </button>

        <div style={{ marginTop: '20px', borderTop: '1px solid #fff', paddingTop: '20px', fontSize: '1rem', lineHeight: '1.5' }}>
          SYSTEM: ONLINE<br/>
          NETWORK PIN: <span 
            onClick={() => setShowPin(true)}
            style={{ cursor: 'pointer', borderBottom: '1px dashed #fff', fontWeight: 'bold' }}
            title="Click to enlarge"
          >{pin}</span><br/>
          ENCRYPTION: AES-256<br/>
          KEYS: 1-{panels.length} MENUS, ESC CLOSE<br/>
          V: 2.0.0
        </div>
      </div>

      {showPin && (
        <div 
          onClick={() => setShowPin(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <h2 style={{ fontSize: '3rem', marginBottom: '20px', color: '#fff' }}>&gt;_ INFILTRATE_NETWORK_PIN</h2>
          <div style={{ fontSize: '15rem', fontWeight: 'bold', color: '#fff', border: '5px solid #fff', padding: '0 40px', letterSpacing: '2rem' }}>
            {pin}
          </div>
          <p style={{ marginTop: '40px', fontSize: '1.5rem', color: '#888' }}>[ CLICK ANYWHERE TO CLOSE ]</p>
        </div>
      )}
    </>
  );
}
