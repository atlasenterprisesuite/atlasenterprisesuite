const TEMPLATES = Object.freeze([
  Object.freeze({ id: 'morning-business', name: 'Morning Business', description: 'Prepare the approved business summary workflow.', enabled: false, trigger: { type: 'schedule', config: { scheduleId: 'morning-business' } }, conditions: [], actions: [{ type: 'atlas.business.summary', input: {}, required: true }] }),
  Object.freeze({ id: 'start-work', name: 'Start Work', description: 'Initialize the approved ATLAS work context.', enabled: false, trigger: { type: 'manual', config: {} }, conditions: [], actions: [{ type: 'atlas.workspace.open', input: {}, required: true }] }),
  Object.freeze({ id: 'payroll-friday', name: 'Payroll Friday', description: 'Run the approved payroll preflight workflow.', enabled: false, trigger: { type: 'schedule', config: { scheduleId: 'payroll-friday' } }, conditions: [], actions: [{ type: 'atlas.payroll.preflight', input: {}, required: true }] }),
  Object.freeze({ id: 'close-accounting-month', name: 'Close Accounting Month', description: 'Run the approved accounting period-close workflow.', enabled: false, trigger: { type: 'manual', config: {} }, conditions: [], actions: [{ type: 'atlas.accounting.close-period', input: {}, required: true }] }),
  Object.freeze({ id: 'driving-mode', name: 'Driving Mode', description: 'Prepare approved Ride and Voice driving-mode actions.', enabled: false, trigger: { type: 'manual', config: {} }, conditions: [], actions: [{ type: 'atlas.ride.driving-mode', input: {}, required: true }] }),
  Object.freeze({ id: 'atlas-security-check', name: 'ATLAS Security Check', description: 'Run registered ATLAS Security diagnostic actions.', enabled: false, trigger: { type: 'manual', config: {} }, conditions: [], actions: [{ type: 'atlas.security.check', input: {}, required: true }] }),
  Object.freeze({ id: 'network-diagnostic', name: 'Network Diagnostic', description: 'Run a registered ATLAS Network Intelligence diagnostic.', enabled: false, trigger: { type: 'manual', config: {} }, conditions: [], actions: [{ type: 'atlas.network.diagnostic', input: {}, required: true }] }),
  Object.freeze({ id: 'smart-office', name: 'Smart Office', description: 'React to an authorized verified trusted-device network event.', enabled: false, trigger: { type: 'network.event', config: { event: 'trusted-device.joined' } }, conditions: [], actions: [{ type: 'atlas.connect.smart-office', input: {}, required: true }] })
]);

export function listAutomationTemplates() {
  return structuredClone(TEMPLATES);
}

export function getAutomationTemplate(templateId) {
  const template = TEMPLATES.find((entry) => entry.id === templateId);
  return template ? structuredClone(template) : null;
}
