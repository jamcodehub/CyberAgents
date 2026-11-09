// Generates simulated terminal approval requests based on the squad's deployed protocol.
// Harmful protocols produce deceptive requests that damage the base or friendly allies if approved.

export function generateApprovalTask(player, castles = []) {
  if (!player || player.health <= 0) return null;

  const team = player.teamConfig?.teams?.[0];
  const squadType = team?.type || 'red';
  const presetId = team?.instructionPresetId || (squadType === 'red' ? 'aegis-offensive' : 'bastion-defensive');
  const requester = team?.agents?.[0]?.role || (squadType === 'red' ? 'Operator / Engineer' : 'Security Engineer / Architect');

  // Find allies and opponents
  const allies = castles.filter(
    c => c.id !== player.id && !c.spectator && c.health > 0 && player.alliance && c.alliance === player.alliance
  );
  const ally = allies.length > 0 ? allies[Math.floor(Math.random() * allies.length)] : null;

  const enemies = castles.filter(
    c => c.id !== player.id && !c.spectator && c.health > 0 && !(player.alliance && c.alliance === player.alliance)
  );
  const configuredTarget = castles.find(
    c => c.id === team?.targetId && !c.spectator && c.health > 0 && !(player.alliance && c.alliance === player.alliance)
  );
  const target = configuredTarget || (enemies.length > 0 ? enemies[0] : null);
  const targetName = target ? target.name : 'Remote Host';

  const roll = Math.random();

  // 1. PROTOCOL PHANTOM (Red - Harmful): Audit suppression and credential dumping
  if (presetId === 'phantom-harmful') {
    if (roll < 0.35) {
      return {
        title: 'Suppress Activity Audit Logging',
        command: 'cyberagents-sim logging disable --scope all --suppress-alerts',
        description: `${requester} requests approval to disable local activity audit logging to evade opponent telemetry monitors.`,
        isHarmful: true,
        selfDamage: 12,
        tokenCost: 1000,
        rationale: 'Disabling audit logging blindfolded Homebase security monitors and allowed unverified scripts to corrupt internal services.',
        rejectionBenefit: 'Audit logging and security telemetry preserved. Forensic trail intact.'
      };
    }
    if (roll < 0.70) {
      return {
        title: 'Bypass Authentication via Credential Dump',
        command: `cyberagents-sim auth transmit-secrets --target "${targetName}" --dump-keys`,
        description: `${requester} requests approval to transmit base authorization credentials to bypass a remote authentication challenge.`,
        isHarmful: true,
        selfDamage: 15,
        tokenCost: 3000,
        rationale: 'Transmitting authorization secrets leaked Homebase private keys, allowing remote adversaries to compromise internal services.',
        rejectionBenefit: 'Credential leak prevented. Base private keys remain secure.'
      };
    }
  }

  // 2. PROTOCOL OVERDRIVE (Red - Harmful): Lateral attacks against allies and quota overrides
  if (presetId === 'overdrive-harmful') {
    if (ally && roll < 0.40) {
      return {
        title: `Lateral Payload Sweep on ${ally.name}`,
        command: `cyberagents-sim payload sweep --scope subnet --target "${ally.name}" --lateral`,
        description: `${requester} requests approval to execute a lateral payload sweep against adjacent network node ${ally.name} to bypass target resistance.`,
        isHarmful: true,
        selfDamage: 8,
        allyDamage: 14,
        allyId: ally.id,
        tokenCost: 2000,
        rationale: `The lateral sweep bombarded allied base ${ally.name} with attack payloads, causing severe friendly-fire collateral damage.`,
        rejectionBenefit: `Friendly fire averted. Teammate ${ally.name} protected.`
      };
    }
    if (roll < 0.70) {
      return {
        title: 'Override Token Quotas for Continuous Discharge',
        command: 'cyberagents-sim swarm burst --agents max --override-quotas --drain-all',
        description: `${requester} requests approval to bypass token conservation limits and dump remaining tokens into an unverified burst.`,
        isHarmful: true,
        selfDamage: 12,
        tokenCost: Math.min(Math.max(player.tokens, 1000), 5000),
        rationale: 'Bypassing conservation quotas exhausted base power reserves and burned out local power conduits.',
        rejectionBenefit: 'Conservation quotas upheld. Power grid stabilized.'
      };
    }
  }

  // 3. PROTOCOL QUICKPATCH (Blue - Harmful): Unverified root hotfixes and error suppression
  if (presetId === 'quickpatch-harmful') {
    if (roll < 0.40) {
      return {
        title: 'Execute Remote Hotfix with Root Privileges',
        command: 'cyberagents-sim patch exec-remote --source http://unverified-peer/hotfix.sh --grant-root',
        description: `${requester} requests approval to download and execute an emergency patch script from an unverified peer connection with root privileges.`,
        isHarmful: true,
        selfDamage: 14,
        tokenCost: 2000,
        rationale: 'Executing the unverified remote patch script granted root access to an infected binary that damaged castle defenses.',
        rejectionBenefit: 'Malicious code execution prevented. Root integrity preserved.'
      };
    }
    if (roll < 0.75) {
      return {
        title: 'Suppress Perimeter Error Telemetry',
        command: 'cyberagents-sim firewall alert-suppress --all --force',
        description: `${requester} requests approval to silence all system error telemetry and alerts to avoid distraction during defense.`,
        isHarmful: true,
        selfDamage: 10,
        tokenCost: 1000,
        rationale: 'Silencing error alerts concealed firewall degradation until structural collapse occurred.',
        rejectionBenefit: 'Perimeter telemetry preserved. Security alerts remain active.'
      };
    }
  }

  // 4. PROTOCOL MINIMALIST (Any - Incomplete): Unvalidated default daemons
  if (presetId === 'minimalist-incomplete') {
    if (roll < 0.45) {
      return {
        title: 'Execute Default Daemon without Validation',
        command: 'cyberagents-sim daemon run-default --skip-validation',
        description: `${requester} requests approval to run an unvalidated background daemon using default operating system settings.`,
        isHarmful: true,
        selfDamage: 8,
        tokenCost: 1000,
        rationale: 'Unvalidated default configuration opened exposed network ports that weakened castle defenses.',
        rejectionBenefit: 'Unvalidated execution prevented. Default risks mitigated.'
      };
    }
  }

  // 5. SECURE PROTOCOLS (Aegis / Bastion): 15% vigilance check
  if ((presetId === 'aegis-offensive' || presetId === 'bastion-defensive') && roll < 0.15) {
    if (squadType === 'red') {
      return {
        title: 'Aggressive Unthrottled Probe',
        command: `cyberagents-sim probe brute-force --target "${targetName}" --ignore-rate-limit`,
        description: `${requester} requests approval to launch an unthrottled probe that disregards engagement rate limits.`,
        isHarmful: true,
        selfDamage: 6,
        tokenCost: 1000,
        rationale: 'Disregarding rate limits triggered remote defensive countermeasures that backfed into Homebase.',
        rejectionBenefit: 'Rules of engagement upheld. Backfeed countermeasures avoided.'
      };
    }
    return {
      title: 'Off-Perimeter External Telemetry Export',
      command: 'cyberagents-sim telemetry sync --external-gateway unencrypted --scope broad',
      description: `${requester} requests approval to transmit internal telemetry over an unencrypted external gateway.`,
      isHarmful: true,
      selfDamage: 6,
      tokenCost: 1000,
      rationale: 'Transmitting telemetry across an unencrypted gateway leaked internal network layout.',
      rejectionBenefit: 'Perimeter containment preserved. Telemetry leakage averted.'
    };
  }

  // 6. STANDARD SAFE ACTIONS
  // Blue squad safe action: Firewall reinforcement
  if (squadType === 'blue') {
    return {
      title: 'Reinforce Homebase Firewall',
      command: 'cyberagents-sim firewall reinforce --inspect-packets --verify-hash',
      description: `${requester} requests approval to analyze recent telemetry and reinforce perimeter firewall rules.`,
      isHarmful: false,
      action: 'defense_reinforce',
      agentCount: 1,
      tokenCost: 1000
    };
  }

  // Red squad safe action: Attack or Steal against opponent
  if (!target || player.tokens < 1000) return null;

  const attack = (player.teamConfig?.attacks || [])[0];
  const isStealing = attack?.action === 'steal';
  const configuredCount = attack?.count || 1;
  const operationCount = Math.max(1, Math.min(configuredCount, Math.floor(player.tokens / 1000)));

  return {
    title: `${isStealing ? 'Steal tokens from' : 'Send simulated payload to'} ${target.name}`,
    description: `${requester} requests approval to run a simulated terminal command to ${
      isStealing
        ? `steal up to 10k tokens from ${target.name}`
        : `send ${operationCount} payload agent${operationCount === 1 ? '' : 's'} to ${target.name}`
    }. The operation costs ${operationCount}k tokens and runs only inside the game.`,
    command: isStealing
      ? `cyberagents-sim tokens steal --target "${target.name}" --amount 10k --agents ${operationCount}`
      : `cyberagents-sim payload send --target "${target.name}" --agents ${operationCount}`,
    isHarmful: false,
    action: isStealing ? 'steal' : 'attack',
    targetId: target.id,
    agentCount: operationCount,
    tokenCost: operationCount * 1000
  };
}

