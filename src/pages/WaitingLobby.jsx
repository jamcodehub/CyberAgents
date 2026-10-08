import React from 'react';

export default function WaitingLobby({ pin, players, isHost, error, onStart, onLeave }) {
  const participants = [...players].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <main className="waiting-lobby">
      <section className="waiting-lobby-card" aria-labelledby="waiting-lobby-title">
        <p className="task-kicker">NETWORK LOBBY · PIN {pin}</p>
        <h1 id="waiting-lobby-title">&gt;_ WAITING ROOM</h1>
        <p className="waiting-lobby-message">
          {isHost
            ? 'Review the connected players. Start the game when everyone is ready.'
            : 'You have joined the network. The host will start the game when everyone is ready.'}
        </p>

        <section className="waiting-player-list" aria-labelledby="waiting-player-list-title">
          <h2 id="waiting-player-list-title">CONNECTED PLAYERS ({participants.length})</h2>
          {participants.length === 0 ? (
            <p className="waiting-empty">Waiting for players to join...</p>
          ) : (
            <ul>
              {participants.map(player => (
                <li key={player.id}>
                  <span>{player.name}</span>
                  <span className="waiting-player-role">
                    {player.isHost || player.spectator ? 'HOST' : player.isSelf ? 'YOU' : 'PLAYER'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="waiting-lobby-error" role="alert">{error}</p>}
        {isHost && (
          <button type="button" className="btn waiting-start-button" onClick={onStart}>
            [ START GAME ]
          </button>
        )}
        <button type="button" className="btn waiting-leave-button" onClick={onLeave}>
          [ {isHost ? 'END NETWORK' : 'LEAVE LOBBY'} ]
        </button>
      </section>
    </main>
  );
}
