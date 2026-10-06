import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Lobby({ joinGame, lobbyError }) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (lobbyError) {
      setError(lobbyError);
      navigate('/', { replace: true });
    }
  }, [lobbyError, navigate]);

  const handleHost = () => {
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    setError('');
    joinGame(generatedPin, true);
    navigate('/battlefield');
  };

  const handleJoin = () => {
    if (pinInput.length !== 4) {
      setError("PIN must be 4 digits.");
      return;
    }
    setError('');
    joinGame(pinInput, false);
    navigate('/battlefield');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <div style={{ border: '2px solid #fff', padding: '40px', width: '400px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '20px' }}>&gt;_ NETWORK_ACCESS</h1>
        
        {error && <div className="error-msg" style={{ marginBottom: '20px' }}>{error}</div>}

        <p>Players get a random agent codename. The host spectates and manages the game.</p>

        <div style={{ borderTop: '1px dashed #fff', paddingTop: '20px', marginTop: '20px' }}>
          <button className="btn" onClick={handleHost}>[ HOST NEW NETWORK ]</button>
        </div>

        <div style={{ borderTop: '1px dashed #fff', paddingTop: '20px', marginTop: '20px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>NETWORK PIN:</label>
          <input 
            type="text" 
            maxLength="4"
            value={pinInput} 
            onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
            style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #fff', fontFamily: 'inherit', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '10px' }}
            placeholder="0000"
          />
          <button className="btn" onClick={handleJoin}>[ INFILTRATE NETWORK ]</button>
        </div>
      </div>
    </div>
  );
}
