import React from 'react';

const RING_SIZE = 12;

function Ring({ count, type, radius, label }) {
  if (!count) return null;
  const visibleCount = Math.min(count, RING_SIZE);
  return (
    <div className={`swarm-ring ${type}`} title={`${count} ${label}${count === 1 ? '' : 's'}`}>
      {Array.from({ length: visibleCount }, (_, i) => {
        const ring = Math.floor(i / RING_SIZE);
        const inRing = Math.min(RING_SIZE, visibleCount - ring * RING_SIZE);
        const angle = ((i % RING_SIZE) / inRing) * 360 + ring * 15;
        return (
          <span
            key={i}
            className={`swarm-pixel ${type}`}
            title={label}
            style={{ transform: `rotate(${angle}deg) translateX(${radius + ring * 9}px)` }}
          >
            <i />
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
