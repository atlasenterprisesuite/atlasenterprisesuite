export type ForecastSnapshotRow = {
  id: string;
  org_id: string | null;
  entity_id: string | null;
  as_of_date: string;
  horizon_weeks: number;
  scenario: string;
  forecast: unknown;
  assumptions: unknown;
  created_by: string | null;
  created_at: string | null;
};

export type ForecastSnapshotRecord = {
  id: string;
  organizationId: string | null;
  entityId: string | null;
  asOfDate: string;
  horizonWeeks: number;
  scenario: string;
  forecast: unknown;
  assumptions: unknown;
  createdBy: string | null;
  createdAt: string | null;
};

export function mapForecastSnapshot(row: ForecastSnapshotRow): ForecastSnapshotRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    entityId: row.entity_id,
    asOfDate: row.as_of_date,
    horizonWeeks: Number(row.horizon_weeks),
    scenario: row.scenario,
    forecast: row.forecast,
    assumptions: row.assumptions,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
