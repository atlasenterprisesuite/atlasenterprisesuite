const ALL_CAPABILITIES = [
  'review.read',
  'review.comment',
  'review.assign',
  'review.resolve',
  'review.archive',
  'audit.run',
  'audit.export'
];

const ROLE_CAPABILITIES = {
  owner: ALL_CAPABILITIES,
  admin: ALL_CAPABILITIES,
  developer: ['review.read', 'review.comment', 'review.assign', 'review.resolve', 'audit.run', 'audit.export'],
  designer: ['review.read', 'review.comment', 'review.resolve', 'audit.run'],
  reviewer: ['review.read', 'review.comment', 'review.resolve'],
  client: ['review.read', 'review.comment']
};

export function capabilitiesForRole(role) {
  return [...(ROLE_CAPABILITIES[role] ?? [])];
}

export function hasCapability(role, capability) {
  return capabilitiesForRole(role).includes(capability);
}
