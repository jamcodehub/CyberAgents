// 5-letter pronounceable operative callsigns for squad agents.
export const PRESET_CALLSIGNS = [
  'VEXON', 'KORUX', 'TALON', 'AXION', 'PRISM',
  'CYPHE', 'RAVEN', 'VIPER', 'BLAZE', 'STORM',
  'HYDRA', 'OMEGA', 'AEGIS', 'DELTA', 'SHARD',
  'LOGIC', 'SPIKE', 'PULSE', 'DRIFT', 'ORBIT',
  'FLINT', 'QUARK', 'VALOR', 'SONAR', 'TITAN',
  'ROOKS', 'CIPHR', 'ZENIT', 'SPARK', 'RADAR',
  'NEXIS', 'PHANT', 'GHOST', 'TRACE', 'SWARM',
  'BYTES', 'PROXY', 'FLASH', 'SHOCK', 'LASER',
  'CLOAK', 'SPECS', 'CHAOS', 'TURBO', 'FROST',
  'SHADE', 'BLITZ', 'COBRA', 'SURGE', 'VERTX'
];

const CONSONANTS = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'X', 'Z'];
const VOWELS = ['A', 'E', 'I', 'O', 'U', 'Y'];

export function generateCallsign(index = 0) {
  if (index >= 0 && index < PRESET_CALLSIGNS.length) {
    return PRESET_CALLSIGNS[index];
  }
  const c1 = CONSONANTS[index % CONSONANTS.length];
  const v1 = VOWELS[Math.floor(index / CONSONANTS.length) % VOWELS.length];
  const c2 = CONSONANTS[(index + 3) % CONSONANTS.length];
  const v2 = VOWELS[(index + 2) % VOWELS.length];
  const c3 = CONSONANTS[(index + 7) % CONSONANTS.length];
  return `${c1}${v1}${c2}${v2}${c3}`;
}

export function getFactionColor(squadType = 'red', allianceColor = null) {
  if (allianceColor) return allianceColor;
  return squadType === 'blue' ? '#4de1ff' : '#ff5c5c';
}

