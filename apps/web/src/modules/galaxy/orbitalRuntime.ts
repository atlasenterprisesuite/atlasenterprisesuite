export type OrbitalPoint = { x: number; y: number; z: number; radius: number };
export type ProjectedPoint = { x: number; y: number; radius: number; depth: number };

/** Deterministic application navigation geometry, not astronomical ephemerides. */
export function orbitalPositions(count: number, seconds: number): OrbitalPoint[] {
  if (!Number.isInteger(count) || count < 0 || count > 64 || !Number.isFinite(seconds)) {
    throw new RangeError('Invalid orbital input');
  }
  return Array.from({ length: count }, (_, i) => {
    if (!i) return { x: 0, y: 0, z: 0, radius: 1.15 };
    const orbit = 2 + i * 1.22;
    const angle = 0.12 + i * 0.065 + seconds * (0.22 / (1 + i * 0.3));
    return {
      x: orbit * Math.cos(angle), y: 0, z: orbit * Math.sin(angle),
      radius: [0.30, 0.42, 0.52, 0.64, 0.52, 0.38][(i - 1) % 6]
    };
  });
}

export function projectOrbitalPoint(point: OrbitalPoint, yaw: number, zoom: number, width: number, height: number): ProjectedPoint {
  if (![point.x, point.y, point.z, point.radius, yaw, zoom, width, height].every(Number.isFinite)
    || zoom <= 0 || width <= 0 || height <= 0 || point.radius < 0) {
    throw new RangeError('Invalid camera input');
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw), pitch = 0.29;
  const x = point.x * cy - point.z * sy;
  const z = point.x * sy + point.z * cy;
  const y = point.y * Math.cos(pitch) - z * Math.sin(pitch);
  const depth = Math.max(6, 28 - z * Math.cos(pitch) - point.y * Math.sin(pitch));
  const scale = Math.min(width / 26, height / 12) * zoom * 28 / depth;
  return { x: width * 0.5 + x * scale, y: height * 0.5 + y * scale, radius: point.radius * scale, depth };
}
