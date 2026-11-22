import { describe, it, expect } from 'vitest';
import { modules, searchTopics, progress, evidence, tasks } from '../../apps/web/src/modules/chronos/catalog';
describe('CHRONOS research catalog', () => {
 it('preserves all 75 stable goals', () => {
  const ids = modules.flatMap(m => m.topics.map(t => t.id));
  expect(modules).toHaveLength(10);
  expect(ids).toHaveLength(75);
  expect(new Set(ids).size).toBe(75);
 });
 it('searches accent-insensitively and by identifier', () => {
  expect(searchTopics('radiacion').some(t => t.id === '01.001')).toBe(true);
  expect(searchTopics('01.001')[0]?.id).toBe('01.001');
  expect(searchTopics('no-such-topic-xyz')).toEqual([]);
 });
 it('never treats preliminary tasks as certification', () => {
  expect(progress()).toEqual({total:75,certified:0});
 });
 it('never reports undocumented research work as completed', () => {
  expect(tasks).toHaveLength(8);
  expect(tasks.every(task => task.done === false)).toBe(true);
 });
 it('uses HTTPS source references', () => {
  expect(evidence.length).toBeGreaterThan(0);
  expect(evidence.every(e => new URL(e.url).protocol === 'https:')).toBe(true);
 });
});
