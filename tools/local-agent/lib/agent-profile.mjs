export const AGENT_PROFILE_STANDARD='standard';
export const AGENT_PROFILE_CERTIFICATE_TRUST='certificate-trust';

export function resolveAgentProfile(value) {
  const profile=String(value||AGENT_PROFILE_STANDARD).trim().toLowerCase();
  if (profile!==AGENT_PROFILE_STANDARD && profile!==AGENT_PROFILE_CERTIFICATE_TRUST) {
    throw new Error('unsupported_agent_profile');
  }
  return profile;
}

export function isCertificateTrustProfile(profile) {
  return resolveAgentProfile(profile)===AGENT_PROFILE_CERTIFICATE_TRUST;
}

export function capabilitiesForAgentProfile(profile,{deviceDnaEnabled=false}={}) {
  if (isCertificateTrustProfile(profile)) return ['heartbeat','command.realtime'];
  const capabilities=['heartbeat','device.inventory','command.poll','command.realtime','http-health','browser.cdp'];
  return deviceDnaEnabled?[...capabilities,'device.dna.read']:capabilities;
}

export function modulesForAgentProfile(profile) {
  return isCertificateTrustProfile(profile)
    ? ['device-os','security','certificate-lifecycle']
    : ['device-os','connect','hospitality','browser-operator'];
}
