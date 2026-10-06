import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Lobby({ joinGame }) {
  const [pinInput, setPinInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleHost = () => {
    if (!nameInput) {
      setError("Please enter an agent name.");
      return;
    }
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    joinGame(nameInput, generatedPin);
    navigate('/battlefield');
  };

  const handleJoin = () => {
    if (!nameInput) {
      setError("Please enter an agent name.");
      return;
    }
    if (pinInput.length !== 4) {
      setError("PIN must be 4 digits.");
      return;
    }
    joinGame(nameInput, pinInput);
    navigate('/battlefield');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <div style={{ border: '2px solid #fff', padding: '40px', width: '400px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '20px' }}>&gt;_ NETWORK_ACCESS</h1>
        
        {error && <div className="error-msg" style={{ marginBottom: '20px' }}>{error}</div>}

        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>AGENT IDENTIFIER:</label>
          <input 
            type="text" 
            value={nameInput} 
            onChange={e => setNameInput(e.target.value)}
            style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #fff', fontFamily: 'inherit', fontSize: '1.2rem' }}
            placeholder="e.g. ZeroCool"
          />
        </div>

        <div style={{ borderTop: '1px dashed #fff', paddingTop: '20px', marginTop: '20px' }}>
          <button className="btn" onClick={handleHost}>[ HOST NEW NETWORK ]</button>
        </div>

        <div style={{ borderTop: '1px dashed #fff', paddingTop: '20px', marginTop: '20px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>NETWORK PIN:</label>
          <input 
            type="text" 
            maxLength="4"
            value={pinInput} 
            onChange={e => setPinInput(e.target.value)}
            style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #fff', fontFamily: 'inherit', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '10px' }}
            placeholder="0000"
          />
          <button className="btn" onClick={handleJoin}>[ INFILTRATE NETWORK ]</button>
        </div>
      </div>
    </div>
  );
}
