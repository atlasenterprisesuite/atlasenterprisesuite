import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { actionAvailability, type FrontierActionId, type FrontierState } from './domain';
import {
  FRONTIER_RESOURCE_TARGETS,
  clampWorldPoint,
  distanceToTarget,
  moveWorldPoint,
  normalizeRotationY,
  screenToPlacement,
  toWorldPlacement,
  type FrontierStructure,
  type ResourceTarget,
  type WorldPlacement,
  type WorldPoint
} from './world3d';
import {
  FRONTIER_BIOME_REGIONS,
  frontierBiomeAt,
  isFrontierBiomeUnlocked,
  resolveFrontierBiomeMovement,
  type FrontierBiomeRegion
} from './biomes';

type Props = {
  state: FrontierState;
  structures: readonly FrontierStructure[];
  runtimeReady: boolean;
  initialPosition: WorldPoint;
  buildMode: boolean;
  onBuildModeChange: (enabled: boolean) => void;
  onAction: (action: FrontierActionId) => Promise<boolean>;
  onBuildHabitat: (placement: WorldPlacement) => Promise<boolean>;
  onBiomeTransition: (biome: FrontierBiomeRegion, position: WorldPoint) => Promise<boolean>;
  onMessage: (message: string) => void;
};

type EngineStatus = 'initializing' | 'ready' | 'fallback';

type GlRuntime = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  positionLocation: number;
  matrixLocation: WebGLUniformLocation;
  colorLocation: WebGLUniformLocation;
};

const CUBE_VERTICES = new Float32Array([
  -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5,  -0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
   0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,   0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,
  -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5,  -0.5,-0.5,-0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5,
   0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,   0.5,-0.5, 0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
  -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5,  -0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5,
  -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5,  -0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5
]);

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('frontier_shader_create_failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'frontier_shader_compile_failed';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createRuntime(canvas: HTMLCanvasElement): GlRuntime | null {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
    in vec3 a_position;
    uniform mat4 u_matrix;
    void main() { gl_Position = u_matrix * vec4(a_position, 1.0); }`);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    uniform vec4 u_color;
    out vec4 outColor;
    void main() { outColor = u_color; }`);
  const program = gl.createProgram();
  if (!program) throw new Error('frontier_program_create_failed');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'frontier_program_link_failed');

  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vao || !buffer) throw new Error('frontier_buffer_create_failed');
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTICES, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

  const matrixLocation = gl.getUniformLocation(program, 'u_matrix');
  const colorLocation = gl.getUniformLocation(program, 'u_color');
  if (!matrixLocation || !colorLocation) throw new Error('frontier_uniform_missing');

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return { gl, program, vao, positionLocation, matrixLocation, colorLocation };
}

function identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let value = 0;
      for (let i = 0; i < 4; i += 1) value += a[i * 4 + row] * b[col * 4 + i];
      out[col * 4 + row] = value;
    }
  }
  return out;
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect,0,0,0,
    0,f,0,0,
    0,0,(far + near) * nf,-1,
    0,0,(2 * far * near) * nf,0
  ]);
}

function normalize(v: readonly number[]) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length] as const;
}

function cross(a: readonly number[], b: readonly number[]) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ] as const;
}

function lookAt(eye: readonly number[], target: readonly number[], up: readonly number[]) {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0],y[0],z[0],0,
    x[1],y[1],z[1],0,
    x[2],y[2],z[2],0,
    -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
    -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
    -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),
    1
  ]);
}

function modelMatrix(x: number, y: number, z: number, sx: number, sy: number, sz: number, rotationY = 0) {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return new Float32Array([
    cosine * sx, 0, -sine * sx, 0,
    0, sy, 0, 0,
    sine * sz, 0, cosine * sz, 0,
    x, y, z, 1
  ]);
}

function projectPoint(point: readonly [number, number, number], matrix: Float32Array, width: number, height: number) {
  const [x,y,z] = point;
  const cx = matrix[0]*x + matrix[4]*y + matrix[8]*z + matrix[12];
  const cy = matrix[1]*x + matrix[5]*y + matrix[9]*z + matrix[13];
  const cw = matrix[3]*x + matrix[7]*y + matrix[11]*z + matrix[15];
  if (cw <= 0) return null;
  const nx = cx / cw;
  const ny = cy / cw;
  return { x: (nx * 0.5 + 0.5) * width, y: (1 - (ny * 0.5 + 0.5)) * height };
}

function drawCube(
  runtime: GlRuntime,
  viewProjection: Float32Array,
  position: readonly [number,number,number],
  scale: readonly [number,number,number],
  color: readonly [number,number,number,number],
  rotationY = 0
) {
  const { gl } = runtime;
  const matrix = multiply(
    viewProjection,
    modelMatrix(position[0], position[1], position[2], scale[0], scale[1], scale[2], rotationY)
  );
  gl.uniformMatrix4fv(runtime.matrixLocation, false, matrix);
  gl.uniform4fv(runtime.colorLocation, new Float32Array(color));
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

export function FrontierWorld3D({
  state,
  structures,
  runtimeReady,
  initialPosition,
  buildMode,
  onBuildModeChange,
  onAction,
  onBuildHabitat,
  onBiomeTransition,
  onMessage
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<GlRuntime | null>(null);
  const viewProjectionRef = useRef<Float32Array>(identity());
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const keysRef = useRef(new Set<string>());
  const extractionTimerRef = useRef<number | null>(null);
  const holdTickerRef = useRef<number | null>(null);
  const transitionInFlightRef = useRef(false);
  const blockedBiomeRef = useRef<string | null>(null);
  const playerRef = useRef<WorldPoint>(clampWorldPoint(initialPosition));
  const activeBiomeRef = useRef<FrontierBiomeRegion>(frontierBiomeAt(playerRef.current));
  const placementRef = useRef<WorldPoint>({ x: -4.2, z: 2.6 });
  const [player, setPlayer] = useState<WorldPoint>(playerRef.current);
  const [activeBiome, setActiveBiome] = useState<FrontierBiomeRegion>(activeBiomeRef.current);
  const [placement, setPlacement] = useState<WorldPoint>(placementRef.current);
  const [rotationY, setRotationY] = useState(0);
  const [selectedTarget, setSelectedTarget] = useState<ResourceTarget | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('initializing');
  const [gpuCapable] = useState(() => typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu));

  const syncPlayer = useCallback((next: WorldPoint) => {
    const bounded = clampWorldPoint(next);
    playerRef.current = bounded;
    setPlayer(bounded);
  }, []);

  const attemptPlayerMove = useCallback((next: WorldPoint) => {
    const bounded = clampWorldPoint(next);
    const movement = resolveFrontierBiomeMovement(playerRef.current, bounded, state.campaignStage);

    if (movement.blockedBiome) {
      if (blockedBiomeRef.current !== movement.blockedBiome.id) {
        blockedBiomeRef.current = movement.blockedBiome.id;
        onMessage(`${movement.blockedBiome.label} is locked until campaign phase ${movement.blockedBiome.requiredStage}.`);
      }
      return;
    }

    blockedBiomeRef.current = null;

    if (!movement.changedBiome) {
      syncPlayer(movement.point);
      return;
    }

    if (transitionInFlightRef.current || !runtimeReady) return;
    transitionInFlightRef.current = true;
    const targetBiome = movement.biome;
    onMessage(`Crossing into ${targetBiome.label}. Biome Controller is validating the transition…`);

    void onBiomeTransition(targetBiome, movement.point)
      .then((ok) => {
        if (!ok) return;
        activeBiomeRef.current = targetBiome;
        setActiveBiome(targetBiome);
        syncPlayer(movement.point);
      })
      .finally(() => {
        transitionInFlightRef.current = false;
      });
  }, [onBiomeTransition, onMessage, runtimeReady, state.campaignStage, syncPlayer]);

  const stepPlayer = useCallback((dx: number, dz: number) => {
    attemptPlayerMove(moveWorldPoint(playerRef.current, dx, dz, 0.65));
  }, [attemptPlayerMove]);

  useEffect(() => {
    if (transitionInFlightRef.current) return;
    const bounded = clampWorldPoint(initialPosition);
    playerRef.current = bounded;
    setPlayer(bounded);
    const biome = frontierBiomeAt(bounded);
    activeBiomeRef.current = biome;
    setActiveBiome(biome);
  }, [initialPosition.x, initialPosition.z]);

  const cancelHold = useCallback(() => {
    if (extractionTimerRef.current != null) window.clearTimeout(extractionTimerRef.current);
    if (holdTickerRef.current != null) window.clearInterval(holdTickerRef.current);
    extractionTimerRef.current = null;
    holdTickerRef.current = null;
    setHoldProgress(0);
  }, []);

  const beginExtraction = useCallback((target: ResourceTarget) => {
    cancelHold();
    if (!runtimeReady) {
      onMessage('Flow Controller is not ready for extraction.');
      return;
    }
    if (distanceToTarget(playerRef.current, target) > 4.2) {
      setSelectedTarget(target);
      onMessage(`Move closer to ${target.label} before extracting.`);
      return;
    }
    setSelectedTarget(target);
    setHoldProgress(4);
    const started = performance.now();
    holdTickerRef.current = window.setInterval(() => {
      setHoldProgress(Math.min(96, Math.round(((performance.now() - started) / 900) * 100)));
    }, 45);
    extractionTimerRef.current = window.setTimeout(() => {
      cancelHold();
      void (async () => {
        const ok = await onAction(target.action);
        if (ok) onMessage(`${target.label} extraction committed by Flow Controller.`);
      })();
    }, 900);
  }, [cancelHold, onAction, onMessage, runtimeReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    try {
      const runtime = createRuntime(canvas);
      if (!runtime) {
        setEngineStatus('fallback');
        return;
      }
      runtimeRef.current = runtime;
      setEngineStatus('ready');

      const render = (time: number) => {
        if (disposed) return;
        const delta = Math.min(0.05, Math.max(0, (time - lastFrameRef.current) / 1000 || 0));
        lastFrameRef.current = time;
        const keys = keysRef.current;
        const horizontal = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
        const vertical = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
        if (horizontal || vertical) {
          const length = Math.hypot(horizontal, vertical) || 1;
          const next = moveWorldPoint(playerRef.current, horizontal / length, vertical / length, delta * 4.2);
          if (next.x !== playerRef.current.x || next.z !== playerRef.current.z) attemptPlayerMove(next);
        }

        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        const { gl } = runtime;
        gl.viewport(0, 0, width, height);
        gl.clearColor(0.018, 0.055, 0.09, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(runtime.program);
        gl.bindVertexArray(runtime.vao);

        const p = playerRef.current;
        const projection = perspective(Math.PI / 3.15, width / height, 0.1, 100);
        const view = lookAt([p.x + 8.2, 7.2, p.z + 10.5], [p.x, 0.5, p.z - 1.3], [0,1,0]);
        const viewProjection = multiply(projection, view);
        viewProjectionRef.current = viewProjection;

        drawCube(runtime, viewProjection, [0,-0.5,0], [19,0.75,19], [0.018,0.055,0.07,1]);
        FRONTIER_BIOME_REGIONS.forEach((biome, index) => {
          const unlocked = isFrontierBiomeUnlocked(biome, state.campaignStage);
          const color = unlocked ? biome.color : [0.025,0.035,0.055,1] as const;
          drawCube(
            runtime,
            viewProjection,
            [biome.center.x,-0.06,biome.center.z],
            [Math.max(0.25, biome.size.x - 0.08),0.18,Math.max(0.25, biome.size.z - 0.08)],
            color
          );
          const beaconHeight = unlocked ? 0.9 + (index % 3) * 0.25 : 0.32;
          drawCube(
            runtime,
            viewProjection,
            [biome.center.x,beaconHeight / 2,biome.center.z],
            [0.12,beaconHeight,0.12],
            unlocked ? [0.24,0.82,1,0.72] : [0.18,0.2,0.25,0.45]
          );
        });
        drawCube(runtime, viewProjection, [0,-0.02,-8.4], [18,0.12,0.45], [0.16,0.55,0.72,1]);
        drawCube(runtime, viewProjection, [0,0.1,8.3], [18,0.18,0.32], [0.12,0.34,0.31,1]);

        const towerColors: readonly [number,number,number,number][] = [[0.08,0.21,0.34,1],[0.1,0.3,0.45,1],[0.13,0.42,0.57,1]];
        [-5.4,-3.7,-2.1,2.8,4.4,5.8].forEach((x, index) => {
          const h = 1.6 + (index % 3) * 1.1;
          drawCube(runtime, viewProjection, [x,h/2 - 0.02,-6.1 + (index % 2) * 0.5], [0.9,h,0.9], towerColors[index % towerColors.length]);
        });

        FRONTIER_RESOURCE_TARGETS.forEach((target, index) => {
          const pulse = 1 + Math.sin(time / 420 + index) * 0.12;
          drawCube(runtime, viewProjection, [target.x,0.55,target.z], [0.85*pulse,1.1*pulse,0.85*pulse], target.color);
          drawCube(runtime, viewProjection, [target.x,1.35,target.z], [0.18,0.18,0.18], [0.82,0.96,1,1]);
        });

        structures.forEach((structure) => {
          if (structure.structureType !== 'habitat') return;
          const { x, y, z } = structure.position;
          drawCube(runtime, viewProjection, [x,y + 0.65,z], [2.4,1.15,1.8], [0.14,0.62,0.72,1], structure.rotationY);
          drawCube(runtime, viewProjection, [x,y + 1.42,z], [1.3,0.38,1.05], [0.33,0.88,0.96,1], structure.rotationY);
        });

        if (buildMode) {
          drawCube(runtime, viewProjection, [placement.x,0.65,placement.z], [2.4,1.15,1.8], [0.14,0.75,0.82,0.48], rotationY);
          drawCube(runtime, viewProjection, [placement.x,1.42,placement.z], [1.3,0.38,1.05], [0.45,0.95,1,0.58], rotationY);
        }

        drawCube(runtime, viewProjection, [p.x,0.72,p.z], [0.5,1.25,0.48], [0.08,0.55,0.76,1]);
        drawCube(runtime, viewProjection, [p.x,1.55,p.z], [0.42,0.42,0.42], [0.28,0.84,1,1]);

        const gridStrength = Math.max(0.08, state.skyGridIntegrity / 100);
        for (let i = -6; i <= 6; i += 3) drawCube(runtime, viewProjection, [i,4.5,-7.7], [2.5,0.03,0.03], [0.2,0.75,1,gridStrength]);

        animationRef.current = window.requestAnimationFrame(render);
      };
      animationRef.current = window.requestAnimationFrame(render);
    } catch (error) {
      console.error('[ATLAS FRONTIER] WebGL initialization failed', error);
      setEngineStatus('fallback');
    }

    return () => {
      disposed = true;
      cancelHold();
      if (animationRef.current != null) window.cancelAnimationFrame(animationRef.current);
      const runtime = runtimeRef.current;
      if (runtime) {
        runtime.gl.deleteVertexArray(runtime.vao);
        runtime.gl.deleteProgram(runtime.program);
      }
      runtimeRef.current = null;
    };
  }, [attemptPlayerMove, buildMode, cancelHold, placement, rotationY, state.campaignStage, state.skyGridIntegrity, structures]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const down = (event: KeyboardEvent) => {
      if (event.target !== canvas) return;
      const key = event.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
        keysRef.current.add(key);
        event.preventDefault();
      }
      if (key === 'e' && selectedTarget && extractionTimerRef.current == null) {
        event.preventDefault();
        beginExtraction(selectedTarget);
      }
      if (key === 'b') onBuildModeChange(!buildMode);
      if (buildMode && key === 'q') {
        event.preventDefault();
        setRotationY((current) => normalizeRotationY(current - Math.PI / 12));
      }
      if (buildMode && key === 'r') {
        event.preventDefault();
        setRotationY((current) => normalizeRotationY(current + Math.PI / 12));
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysRef.current.delete(key);
      if (key === 'e') cancelHold();
    };
    canvas.addEventListener('keydown', down);
    canvas.addEventListener('keyup', up);
    return () => {
      canvas.removeEventListener('keydown', down);
      canvas.removeEventListener('keyup', up);
    };
  }, [beginExtraction, buildMode, cancelHold, onBuildModeChange, selectedTarget]);

  const pickTarget = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let picked: ResourceTarget | null = null;
    let distance = 74;
    for (const target of FRONTIER_RESOURCE_TARGETS) {
      const projected = projectPoint([target.x,0.8,target.z], viewProjectionRef.current, rect.width, rect.height);
      if (!projected) continue;
      const next = Math.hypot(px - projected.x, py - projected.y);
      if (next < distance) {
        distance = next;
        picked = target;
      }
    }
    return picked;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.focus();
    if (buildMode) {
      const rect = canvas.getBoundingClientRect();
      const next = screenToPlacement(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
      placementRef.current = next;
      setPlacement(next);
      onMessage('Habitat placement selected. Confirm placement to send the governed build action.');
      return;
    }
    const target = pickTarget(event);
    if (target) {
      setSelectedTarget(target);
      beginExtraction(target);
    } else {
      setSelectedTarget(null);
      onMessage('Move with WASD or touch controls. Point at a resource node and hold to extract.');
    }
  }, [beginExtraction, buildMode, onMessage, pickTarget]);

  const confirmHabitat = async () => {
    const availability = actionAvailability(state, 'build_habitat');
    if (!availability.enabled) {
      onMessage(availability.reason || 'Habitat build unavailable.');
      return;
    }
    const spatialPlacement = toWorldPlacement(placement, rotationY);
    const placementBiome = frontierBiomeAt(spatialPlacement);
    if (!isFrontierBiomeUnlocked(placementBiome, state.campaignStage)) {
      onMessage(`${placementBiome.label} is locked until campaign phase ${placementBiome.requiredStage}; construction is blocked.`);
      return;
    }
    const ok = await onBuildHabitat(spatialPlacement);
    if (ok) {
      placementRef.current = placement;
      setRotationY(0);
      onBuildModeChange(false);
      onMessage('Habitat committed with persistent position and rotation.');
    }
  };

  const capabilityLabel = engineStatus === 'ready'
    ? gpuCapable ? 'WEBGL2 ACTIVE · WEBGPU CAPABLE' : 'WEBGL2 ACTIVE'
    : engineStatus === 'fallback' ? '3D RENDERER UNAVAILABLE' : 'INITIALIZING 3D';

  const integrityStyle = { '--frontier-integrity': `${state.skyGridIntegrity}%` } as CSSProperties;

  return (
    <div className="frontier-world3d" style={integrityStyle}>
      <canvas
        ref={canvasRef}
        className="frontier-world3d-canvas"
        tabIndex={0}
        aria-label="ATLAS FRONTIER interactive 3D world. Use WASD or arrow keys to move, point at resources and hold to extract."
        onPointerDown={onPointerDown}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
      />

      <div className="frontier-world3d-topbar">
        <span>{capabilityLabel}</span>
        <span>POSITION {player.x.toFixed(1)} · {player.z.toFixed(1)}</span>
        <span>STRUCTURES {structures.length}</span>
      </div>

      <div className="frontier-biome-card" data-biome={activeBiome.id}>
        <span>ACTIVE BIOME</span>
        <strong>{activeBiome.label}</strong>
        <small>Physical region · phase {activeBiome.requiredStage}+ · traversal persisted on boundary crossing</small>
      </div>

      <div className="frontier-integrity frontier-integrity-3d">
        <span>SKY GRID INTEGRITY</span>
        <strong>{state.skyGridIntegrity}%</strong>
        <div><i /></div>
      </div>

      <div className="frontier-crosshair" aria-hidden="true"><i /><i /></div>

      {selectedTarget ? (
        <div className="frontier-target-card" role="status">
          <span>TARGET</span>
          <strong>{selectedTarget.label}</strong>
          <small>{distanceToTarget(player, selectedTarget) <= 4.2 ? 'Hold pointer or E to extract' : 'Move closer to interact'}</small>
          {holdProgress > 0 ? <div className="frontier-hold-progress"><i style={{ width: `${holdProgress}%` }} /></div> : null}
        </div>
      ) : null}

      {buildMode ? (
        <div className="frontier-build-card">
          <span>BUILD MODE · HABITAT</span>
          <strong>Place at {placement.x.toFixed(1)} · {placement.z.toFixed(1)} · {Math.round(rotationY * 180 / Math.PI)}°</strong>
          <small>Tap the terrain to reposition. Rotate with Q/R or the controls below. Position, rotation and resource costs are validated by the server.</small>
          <div>
            <button type="button" onClick={() => setRotationY((current) => normalizeRotationY(current - Math.PI / 12))}>Rotate −15°</button>
            <button type="button" onClick={() => setRotationY((current) => normalizeRotationY(current + Math.PI / 12))}>Rotate +15°</button>
            <button type="button" onClick={() => void confirmHabitat()} disabled={!runtimeReady}>Confirm placement</button>
            <button type="button" onClick={() => { setRotationY(0); onBuildModeChange(false); }}>Cancel</button>
          </div>
        </div>
      ) : null}

      {engineStatus === 'fallback' ? (
        <div className="frontier-world3d-fallback" role="alert">
          <strong>3D renderer unavailable</strong>
          <span>This browser does not expose WebGL2. Governed sidebar actions remain available.</span>
        </div>
      ) : null}

      <div className="frontier-mobile-controls" aria-label="Movement controls">
        <button type="button" onPointerDown={() => stepPlayer(0,-1)} aria-label="Move forward">↑</button>
        <div>
          <button type="button" onPointerDown={() => stepPlayer(-1,0)} aria-label="Move left">←</button>
          <button type="button" onPointerDown={() => stepPlayer(0,1)} aria-label="Move backward">↓</button>
          <button type="button" onPointerDown={() => stepPlayer(1,0)} aria-label="Move right">→</button>
        </div>
      </div>
    </div>
  );
}
