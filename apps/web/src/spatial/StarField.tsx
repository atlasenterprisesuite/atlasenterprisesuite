import { useMemo } from 'react';

export function particleCountForViewport(width: number): number {
  return width <= 720 ? 420 : 1100;
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function StarField({ count }: { count: number }) {
  const safeCount = Math.min(1200, Math.max(1, Math.floor(count)));
  const positions = useMemo(() => {
    const data = new Float32Array(safeCount * 3);
    for (let index = 0; index < safeCount; index += 1) {
      const radius = 8 + seeded(index, 1) * 22;
      const theta = seeded(index, 2) * Math.PI * 2;
      const phi = Math.acos(2 * seeded(index, 3) - 1);
      data[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      data[index * 3 + 1] = radius * Math.cos(phi);
      data[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    return data;
  }, [safeCount]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} transparent opacity={0.62} depthWrite={false} />
    </points>
  );
}
