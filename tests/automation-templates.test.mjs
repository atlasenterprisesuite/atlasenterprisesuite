import test from 'node:test';
import assert from 'node:assert/strict';
import { listAutomationTemplates, getAutomationTemplate } from '../src/modules/automations/templates.js';

test('exposes the eight approved templates in stable order', () => {
  assert.deepEqual(listAutomationTemplates().map(item => item.id), [
    'morning-business', 'start-work', 'payroll-friday', 'close-accounting-month',
    'driving-mode', 'atlas-security-check', 'network-diagnostic', 'smart-office'
  ]);
});

test('returns defensive copies so callers cannot mutate the library', () => {
  const first = listAutomationTemplates();
  first[0].name = 'Changed';
  first[0].actions[0].type = 'changed';
  assert.equal(listAutomationTemplates()[0].name, 'Morning Business');
  assert.notEqual(listAutomationTemplates()[0].actions[0].type, 'changed');
});

test('templates remain definitions and do not claim provider connectivity', () => {
  const network = getAutomationTemplate('network-diagnostic');
  assert.equal(network.enabled, false);
  assert.equal(network.actions[0].type, 'atlas.network.diagnostic');
  assert.equal('connected' in network, false);
  assert.equal(getAutomationTemplate('missing-template'), null);
});
