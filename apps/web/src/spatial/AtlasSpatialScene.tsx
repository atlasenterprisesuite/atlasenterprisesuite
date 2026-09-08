import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { AtlasGlobe } from './AtlasGlobe';
import { particleCountForViewport, StarField } from './StarField';

function SceneRig({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const { size, pointer } = useThree();

  useFrame(() => {
    if (!group.current || reducedMotion) return;
    const targetX = pointer.y * 0.08;
    const targetY = pointer.x * 0.12;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.035;
    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.035;
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.42} />
      <directionalLight position={[4, 5, 6]} intensity={1.35} color="#bde8ff" />
      <pointLight position={[-5, -2, 4]} intensity={10} color="#087cff" distance={18} />
      <AtlasGlobe reducedMotion={reducedMotion} />
      <StarField count={particleCountForViewport(size.width)} />
    </group>
  );
}

export function AtlasSpatialScene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.25, 7.4], fov: 48 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <SceneRig reducedMotion={reducedMotion} />
    </Canvas>
  );
}
