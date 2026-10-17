export const MH01_STATIONS = ['incoming_qc','frame','pcb','electronics','optics','firmware','final_qa','packaging'] as const;
export type ManufacturingStation = typeof MH01_STATIONS[number];
export type ManufacturingState = 'draft'|'approved'|'kitted'|'in_process'|'qa'|'released'|'blocked';
export type QualityGate = 'battery_safety'|'optical_alignment'|'electrical_test'|'firmware_signature'|'calibration'|'traceability';
export const MH01_P0_GATES: readonly QualityGate[] = ['battery_safety','optical_alignment','electrical_test','firmware_signature','calibration','traceability'];
export type GateEvidence = { passed: boolean; evidenceId: string; verifiedAt: string };
export type ManufacturingUnit = {
  orgId: string;
  serial: string;
  state: ManufacturingState;
  gates: Partial<Record<QualityGate, GateEvidence>>;
};
const TRANSITIONS: Readonly<Record<ManufacturingState,readonly ManufacturingState[]>> = {
  draft:['approved','blocked'], approved:['kitted','blocked'], kitted:['in_process','blocked'],
  in_process:['qa','blocked'], qa:['released','blocked','in_process'], released:[], blocked:['in_process']
};
export function validateManufacturingTransition(unit: ManufacturingUnit, next: ManufacturingState, actorOrgId: string): void {
  if (!actorOrgId || !unit.orgId || unit.orgId !== actorOrgId) throw new Error('TENANT_ACCESS_DENIED');
  if (!unit.serial.trim()) throw new Error('MISSING_SERIAL');
  if (!TRANSITIONS[unit.state].includes(next)) throw new Error('INVALID_STATE_TRANSITION');
  if (next === 'released') {
    for (const gate of MH01_P0_GATES) {
      const result = unit.gates[gate];
      if (!result?.passed || !result.evidenceId.trim() || !result.verifiedAt || !Number.isFinite(Date.parse(result.verifiedAt)))
        throw new Error('P0_GATE_BLOCKED:' + gate);
    }
  }
}
