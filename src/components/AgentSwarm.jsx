import React from 'react';
import { generateCallsign, getFactionColor } from '../data/callsigns';

const RING_SIZE = 12;

function Ring({ count, type, radius, label, agents = [], allianceColor = null }) {
  if (!count) return null;
  const visibleCount = Math.min(count, RING_SIZE);
  const color = getFactionColor(type, allianceColor);

  return (
    <div className={`swarm-ring ${type}`} title={`${count} ${label}${count === 1 ? '' : 's'}`}>
      {Array.from({ length: visibleCount }, (_, i) => {
        const ring = Math.floor(i / RING_SIZE);
        const inRing = Math.min(RING_SIZE, visibleCount - ring * RING_SIZE);
        const angle = ((i % RING_SIZE) / inRing) * 360 + ring * 15;
        const agent = agents[i];
        const callsign = agent?.callsign || generateCallsign(i);
        const role = agent?.role || (type === 'red' ? 'Operator' : 'Security Analyst');
        const tooltip = `Agent ${callsign} [${role}] · IN ACTION`;

        return (
          <span
            key={i}
            className={`swarm-pixel ${type}`}
            title={tooltip}
            style={{
              transform: `rotate(${angle}deg) translateX(${radius + ring * 9}px)`
            }}
          >
            <i style={{ background: color, borderColor: color }} />
          </span>
        );
      })}
    </div>
  );
}

export default function AgentSwarm({
  x,
  y,
  red = 0,
  blue = 0,
  agents = [],
  squadType = 'red',
  allianceColor = null
}) {
  const redAgents = squadType === 'red' ? agents : [];
  const blueAgents = squadType === 'blue' ? agents : [];

  return (
    <div className="swarm" style={{ left: x, top: y }}>
      <Ring
        count={red}
        type="red"
        radius={50}
        label="Red squad agent"
        agents={redAgents}
        allianceColor={allianceColor}
      />
      <Ring
        count={blue}
        type="blue"
        radius={36}
        label="Blue squad agent"
        agents={blueAgents}
        allianceColor={allianceColor}
      />
    </div>
  );
}
