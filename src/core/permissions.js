const SITE_REVIEW_CAPABILITIES = [
  'review.read',
  'review.comment',
  'review.assign',
  'review.resolve',
  'review.archive',
  'audit.run',
  'audit.export'
];

const AUTOMATION_CAPABILITIES = [
  'automation.read',
  'automation.create',
  'automation.update',
  'automation.delete',
  'automation.execute',
  'automation.manage',
  'automation.audit'
];

const ALL_CAPABILITIES = [...SITE_REVIEW_CAPABILITIES, ...AUTOMATION_CAPABILITIES];

const ROLE_CAPABILITIES = {
  owner: ALL_CAPABILITIES,
  admin: ALL_CAPABILITIES,
  developer: [
    'review.read', 'review.comment', 'review.assign', 'review.resolve', 'audit.run', 'audit.export',
    'automation.read', 'automation.create', 'automation.update', 'automation.execute', 'automation.audit'
  ],
  designer: ['review.read', 'review.comment', 'review.resolve', 'audit.run', 'automation.read'],
  reviewer: ['review.read', 'review.comment', 'review.resolve', 'automation.read'],
  client: ['review.read', 'review.comment', 'automation.read']
};

export function capabilitiesForRole(role) {
  return [...(ROLE_CAPABILITIES[role] ?? [])];
}

export function hasCapability(role, capability) {
  return capabilitiesForRole(role).includes(capability);
}
