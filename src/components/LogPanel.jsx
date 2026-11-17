import React from 'react';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCastleAllianceColor(castle, allCastles) {
  if (!castle) return '#ffffff';
  if (castle.color) return castle.color;
  if (castle.alliance) {
    const ally = allCastles.find(c => c.alliance === castle.alliance && c.color);
    if (ally?.color) return ally.color;
  }
  return '#ffffff';
}

// Renders log text with targets and actors color-coded to their alliance color (or white if unaffiliated)
function renderFormattedMessage(msg, castles, isSelfHit, baseTextColor) {
  if (!msg) return null;

  const matchedCastles = castles.filter(c => !c.spectator && !c.isHost && c.name && msg.includes(c.name));
  if (matchedCastles.length === 0) {
    return <span style={{ color: baseTextColor }}>{msg}</span>;
  }

  // Match longest names first to prevent partial substring collision
  matchedCastles.sort((a, b) => b.name.length - a.name.length);

  const pattern = new RegExp(`(${matchedCastles.map(c => escapeRegex(c.name)).join('|')})`, 'g');
  const tokens = msg.split(pattern);

  return (
    <span style={{ color: baseTextColor }}>
      {tokens.map((token, index) => {
        const castle = matchedCastles.find(c => c.name === token);
        if (!castle) {
          return token;
        }

        // When self integrity is damaged or threatened, keep entire text in the high-contrast alert color
        if (isSelfHit) {
          return <strong key={index} style={{ color: baseTextColor }}>{token}</strong>;
        }

        // Color-code target by its alliance color; if none, bold white
        const hasAlliance = Boolean(castle.alliance);
        const allianceColor = hasAlliance ? getCastleAllianceColor(castle, castles) : '#ffffff';
        return (
          <strong
            key={index}
            style={{
              color: allianceColor,
              textDecoration: hasAlliance ? 'underline' : 'none',
              textUnderlineOffset: '2px'
            }}
            title={hasAlliance ? `Alliance: ${castle.alliance}` : 'Unaffiliated'}
          >
            {token}
          </strong>
        );
      })}
    </span>
  );
}

export default function LogPanel({ isOpen, logs = [], castles = [] }) {
  const selfCastle = castles.find(c => c.isSelf);

  const isRedAlliance = (color) => {
    if (!color) return false;
    const lower = color.toLowerCase();
    return lower === '#ff5c5c' || lower === '#ff4d4d' || lower === '#ff4444'
      || lower.startsWith('#ff5') || lower.startsWith('#f00') || lower.startsWith('#e53');
  };

  const checkSelfIntegrityEvent = (log) => {
    if (!log?.msg) return false;
    const msg = log.msg;

    // 1. Local client approval of harmful command: always self
    if (/approved harmful command/i.test(msg) && (!log.playerId || (selfCastle && log.playerId === selfCastle.id) || !msg.includes(':'))) {
      return true;
    }

    // 2. Server broadcast of harmful command by self
    if (/approved harmful command/i.test(msg)) {
      if (selfCastle?.name && msg.includes(selfCastle.name)) return true;
      if (selfCastle?.id && log.playerId === selfCastle.id) return true;
      if (!selfCastle) return true;
    }

    // 3. Security breach on self
    if (/security breach/i.test(msg)) {
      if (selfCastle?.name && msg.includes(selfCastle.name)) return true;
      if (selfCastle?.id && log.playerId === selfCastle.id) return true;
      if (!log.playerId && !/:/.test(msg.slice(0, 30))) return true;
    }

    // 4. Any attack launched AT self castle
    if (selfCastle?.name) {
      const attackOnSelfRegex = new RegExp(`(?:at|toward|against)\\s+${escapeRegex(selfCastle.name)}\\b`, 'i');
      if (attackOnSelfRegex.test(msg)) {
        return true;
      }
    }

    // 5. Explicit integrity drop affecting self castle
    const mentionsIntegrity = /integrity/i.test(msg);
    if (mentionsIntegrity) {
      if (selfCastle?.name) {
        const selfIntegrityRegex = new RegExp(`(?:base\\s+${escapeRegex(selfCastle.name)}|${escapeRegex(selfCastle.name)}'s|${escapeRegex(selfCastle.name)})[^\n.]*-\\d+%\\s*integrity`, 'i');
        if (selfIntegrityRegex.test(msg)) return true;

        const disruptedSelfRegex = new RegExp(`(?:disrupted|damaged)[^\n.]*${escapeRegex(selfCastle.name)}`, 'i');
        if (disruptedSelfRegex.test(msg)) return true;
      }

      if (selfCastle?.id && log.playerId === selfCastle.id && /-\d+%\s*integrity/i.test(msg)) {
        return true;
      }
    }

    return false;
  };

  return (
    <div className={`slide-panel ${isOpen ? 'open' : ''}`}>
      <h2 style={{ borderBottom: '2px solid #fff', paddingBottom: '10px', marginBottom: '20px', textTransform: 'uppercase' }}>
        &gt;_ ACTIVITY_LOGS
      </h2>
      
      {logs.length === 0 ? (
        <p>No activity detected yet. Deploy agents to begin logging.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
          {logs.map((log, i) => {
            const isSelfHit = checkSelfIntegrityEvent(log);
            const selfIsRed = isRedAlliance(selfCastle?.color);

            // Bold red when self loses integrity; bold white if player's alliance is already red
            const textColor = isSelfHit
              ? (selfIsRed ? '#ffffff' : '#ff4444')
              : '#cccccc';
            const fontWeight = isSelfHit ? 'bold' : 'normal';

            return (
              <div
                key={i}
                style={{
                  padding: '10px',
                  border: isSelfHit ? '1px solid #ff4444' : '1px solid #333',
                  background: isSelfHit ? '#200808' : '#111',
                  boxShadow: isSelfHit ? '0 0 6px rgba(255, 68, 68, 0.4)' : undefined
                }}
              >
                <span style={{ color: isSelfHit ? '#ff8888' : '#888', marginRight: '15px' }}>
                  [{log.time}]
                </span>
                <span style={{ fontWeight }}>
                  {renderFormattedMessage(log.msg, castles, isSelfHit, textColor)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
