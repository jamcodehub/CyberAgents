import React, { useState } from 'react';

export default function Navigation({ pin, openPanel, onTogglePanel }) {
  const [showPin, setShowPin] = useState(false);

  return (
    <>
      <div className="sidebar" style={{ width: '250px', zIndex: 100, position: 'relative' }}>
        <h1 className="title" style={{ fontSize: '1.8rem' }}>&gt;_ MENU</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          
          <button 
            onClick={() => onTogglePanel(null)}
            style={{
              color: openPanel === null ? '#000' : '#fff',
              backgroundColor: openPanel === null ? '#fff' : 'transparent',
              textDecoration: 'none',
              padding: '10px',
              border: '1px solid #fff',
              fontFamily: 'inherit',
              fontSize: '1.2rem',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            [1] Battlefield
          </button>

          <button 
            onClick={() => onTogglePanel('config')}
            style={{
              color: openPanel === 'config' ? '#000' : '#fff',
              backgroundColor: openPanel === 'config' ? '#fff' : 'transparent',
              textDecoration: 'none',
              padding: '10px',
              border: '1px solid #fff',
              fontFamily: 'inherit',
              fontSize: '1.2rem',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            [2] Agent Config
          </button>

          <button 
            onClick={() => onTogglePanel('intel')}
            style={{
              color: openPanel === 'intel' ? '#000' : '#fff',
              backgroundColor: openPanel === 'intel' ? '#fff' : 'transparent',
              textDecoration: 'none',
              padding: '10px',
              border: '1px solid #fff',
              fontFamily: 'inherit',
              fontSize: '1.2rem',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            [3] Threat Intel
          </button>

          <button 
            onClick={() => onTogglePanel('logs')}
            style={{
              color: openPanel === 'logs' ? '#000' : '#fff',
              backgroundColor: openPanel === 'logs' ? '#fff' : 'transparent',
              textDecoration: 'none',
              padding: '10px',
              border: '1px solid #fff',
              fontFamily: 'inherit',
              fontSize: '1.2rem',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            [4] Activity Logs
          </button>

        </div>
        <div style={{ marginTop: 'auto', borderTop: '1px solid #fff', paddingTop: '20px', fontSize: '1rem', lineHeight: '1.5' }}>
          SYSTEM: ONLINE<br/>
          NETWORK PIN: <span 
            onClick={() => setShowPin(true)}
            style={{ cursor: 'pointer', borderBottom: '1px dashed #fff', fontWeight: 'bold' }}
            title="Click to enlarge"
          >{pin}</span><br/>
          ENCRYPTION: AES-256<br/>
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
