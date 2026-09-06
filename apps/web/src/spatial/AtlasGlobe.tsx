import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export function AtlasGlobe({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!reducedMotion && group.current) group.current.rotation.y += delta * 0.08;
  });

  return (
    <group ref={group} rotation={[0.18, -0.25, 0]}>
      <mesh>
        <sphereGeometry args={[2.05, 48, 48]} />
        <meshStandardMaterial color="#071b35" emissive="#082a4f" emissiveIntensity={0.55} metalness={0.82} roughness={0.28} wireframe />
      </mesh>
      <mesh rotation={[Math.PI / 2.45, 0, 0]}>
        <torusGeometry args={[2.7, 0.012, 8, 160]} />
        <meshBasicMaterial color="#68c9ff" transparent opacity={0.72} />
      </mesh>
      <mesh rotation={[Math.PI / 3.2, Math.PI / 5, Math.PI / 8]}>
        <torusGeometry args={[2.45, 0.008, 8, 160]} />
        <meshBasicMaterial color="#d9f3ff" transparent opacity={0.45} />
      </mesh>
      {[-1.3, 0.2, 1.45].map((x, index) => (
        <mesh key={x} position={[x, index === 1 ? 1.18 : -0.7 + index * 0.45, 1.3 - index * 0.75]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshBasicMaterial color="#8bdcff" />
        </mesh>
      ))}
    </group>
  );
}
