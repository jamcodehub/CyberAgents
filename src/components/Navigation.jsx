import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navigation({ pin }) {
  return (
    <div className="sidebar" style={{ width: '250px' }}>
      <h1 className="title" style={{ fontSize: '1.8rem' }}>&gt;_ MENU</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
        <NavLink 
          to="/battlefield" 
          style={({isActive}) => ({
            color: isActive ? '#000' : '#fff',
            backgroundColor: isActive ? '#fff' : 'transparent',
            textDecoration: 'none',
            padding: '10px',
            border: '1px solid #fff',
            fontFamily: 'inherit',
            fontSize: '1.2rem',
            textTransform: 'uppercase'
          })}
        >
          [1] Battlefield
        </NavLink>
        <NavLink 
          to="/intel" 
          style={({isActive}) => ({
            color: isActive ? '#000' : '#fff',
            backgroundColor: isActive ? '#fff' : 'transparent',
            textDecoration: 'none',
            padding: '10px',
            border: '1px solid #fff',
            fontFamily: 'inherit',
            fontSize: '1.2rem',
            textTransform: 'uppercase'
          })}
        >
          [2] Threat Intel
        </NavLink>
        <NavLink 
          to="/logs" 
          style={({isActive}) => ({
            color: isActive ? '#000' : '#fff',
            backgroundColor: isActive ? '#fff' : 'transparent',
            textDecoration: 'none',
            padding: '10px',
            border: '1px solid #fff',
            fontFamily: 'inherit',
            fontSize: '1.2rem',
            textTransform: 'uppercase'
          })}
        >
          [3] Activity Logs
        </NavLink>
      </div>
      <div style={{ marginTop: 'auto', borderTop: '1px solid #fff', paddingTop: '20px', fontSize: '1rem' }}>
        SYSTEM: ONLINE<br/>
        NETWORK PIN: {pin}<br/>
        ENCRYPTION: AES-256<br/>
        V: 1.0.4
      </div>
    </div>
  );
}
