import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { actionAvailability, type FrontierActionId, type FrontierState } from './domain';
import {
  FRONTIER_RESOURCE_TARGETS,
  clampWorldPoint,
  distanceToTarget,
  moveWorldPoint,
  screenToPlacement,
  type ResourceTarget,
  type WorldPoint
} from './world3d';

type Props = {
  state: FrontierState;
  runtimeReady: boolean;
  buildMode: boolean;
  onBuildModeChange: (enabled: boolean) => void;
  onAction: (action: FrontierActionId) => Promise<boolean>;
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

function modelMatrix(x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const out = identity();
  out[0] = sx; out[5] = sy; out[10] = sz;
  out[12] = x; out[13] = y; out[14] = z;
  return out;
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

function drawCube(runtime: GlRuntime, viewProjection: Float32Array, position: readonly [number,number,number], scale: readonly [number,number,number], color: readonly [number,number,number,number]) {
  const { gl } = runtime;
  const matrix = multiply(viewProjection, modelMatrix(position[0], position[1], position[2], scale[0], scale[1], scale[2]));
  gl.uniformMatrix4fv(runtime.matrixLocation, false, matrix);
  gl.uniform4fv(runtime.colorLocation, new Float32Array(color));
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

export function FrontierWorld3D({ state, runtimeReady, buildMode, onBuildModeChange, onAction, onMessage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<GlRuntime | null>(null);
  const viewProjectionRef = useRef<Float32Array>(identity());
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const keysRef = useRef(new Set<string>());
  const extractionTimerRef = useRef<number | null>(null);
  const holdTickerRef = useRef<number | null>(null);
  const playerRef = useRef<WorldPoint>({ x: 0, z: 2.8 });
  const placementRef = useRef<WorldPoint>({ x: -4.2, z: 2.6 });
  const [player, setPlayer] = useState<WorldPoint>(playerRef.current);
  const [placement, setPlacement] = useState<WorldPoint>(placementRef.current);
  const [selectedTarget, setSelectedTarget] = useState<ResourceTarget | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('initializing');
  const [gpuCapable] = useState(() => typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu));

  const syncPlayer = useCallback((next: WorldPoint) => {
    const bounded = clampWorldPoint(next);
    playerRef.current = bounded;
    setPlayer(bounded);
  }, []);

  const stepPlayer = useCallback((dx: number, dz: number) => {
    syncPlayer(moveWorldPoint(playerRef.current, dx, dz, 0.65));
  }, [syncPlayer]);

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
          if (next.x !== playerRef.current.x || next.z !== playerRef.current.z) syncPlayer(next);
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

        drawCube(runtime, viewProjection, [0,-0.45,0], [19,0.8,19], [0.035,0.14,0.15,1]);
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

        const habitatPoint = state.habitats > 0 ? placementRef.current : placement;
        if (state.habitats > 0 || buildMode) {
          const alpha = buildMode && state.habitats === 0 ? 0.55 : 1;
          drawCube(runtime, viewProjection, [habitatPoint.x,0.65,habitatPoint.z], [2.4,1.15,1.8], [0.14,0.62,0.72,alpha]);
          drawCube(runtime, viewProjection, [habitatPoint.x,1.42,habitatPoint.z], [1.3,0.38,1.05], [0.33,0.88,0.96,alpha]);
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
  }, [buildMode, cancelHold, placement, state.habitats, state.skyGridIntegrity, syncPlayer]);

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
    const ok = await onAction('build_habitat');
    if (ok) {
      placementRef.current = placement;
      onBuildModeChange(false);
      onMessage('Habitat committed. The server accepted the build and the structure is now active.');
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
          <strong>Place at {placement.x.toFixed(1)} · {placement.z.toFixed(1)}</strong>
          <small>Tap the terrain to reposition the hologram, then confirm. Resource costs remain server-authoritative.</small>
          <div>
            <button type="button" onClick={() => void confirmHabitat()} disabled={!runtimeReady}>Confirm placement</button>
            <button type="button" onClick={() => onBuildModeChange(false)}>Cancel</button>
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
