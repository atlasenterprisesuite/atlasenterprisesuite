/** Types for the Node/Deno reusable, untrusted BME688 frame parser. */
export interface Bme688Frame {
  readonly sensor_model: 'BME688';
  readonly observed_at: string;
  readonly sequence: number;
  readonly temperature_c: number;
  readonly humidity_percent: number;
  readonly pressure_hpa: number;
  readonly gas_resistance_ohm: number;
}
export interface Bme688ClockPolicy {
  now?: Date;
  maxAgeMs?: number;
  maxFutureMs?: number;
}
export function normalizeBme688Frame(frame: unknown, options?: Bme688ClockPolicy): Readonly<Bme688Frame>;
export function bme688UrbanTwinCandidates(
  normalizedFrame: Readonly<Bme688Frame>,
  identity?: { entityId?: string; bindingId?: string }
): Readonly<{
  status: 'requires_server_authentication';
  observations: Array<{
    entity_id: string;
    binding_id: string;
    observation_type: 'telemetry';
    metric_key: string;
    observed_at: string;
    value: { reading: number; unit: string; sensor_model: 'BME688'; sequence: number };
  }>;
}>;
