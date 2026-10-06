import React from 'react';

const RING_SIZE = 12;

function Ring({ count, type, radius, label }) {
  if (!count) return null;
  return (
    <div className={`swarm-ring ${type}`}>
      {Array.from({ length: count }, (_, i) => {
        const ring = Math.floor(i / RING_SIZE);
        const inRing = Math.min(RING_SIZE, count - ring * RING_SIZE);
        const angle = ((i % RING_SIZE) / inRing) * 360 + ring * 15;
        return (
          <span
            key={i}
            className={`swarm-pixel ${type}`}
            title={label}
            style={{ transform: `rotate(${angle}deg) translateX(${radius + ring * 9}px)` }}
          >
            <i style={{ animationDelay: `${(i % 7) * -0.13}s` }} />
          </span>
        );
      })}
    </div>
  );
}

export default function AgentSwarm({ x, y, red = 0, blue = 0 }) {
  return (
    <div className="swarm" style={{ left: x, top: y }}>
      <Ring count={red} type="red" radius={50} label="Red team agent" />
      <Ring count={blue} type="blue" radius={36} label="Blue team agent" />
    </div>
  );
}
