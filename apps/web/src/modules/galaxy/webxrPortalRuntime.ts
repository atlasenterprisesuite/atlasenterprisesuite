export type SpatialPortalMode = 'immersive-ar' | 'immersive-vr';
export type SpatialPortalCapability =
  | 'checking'
  | 'webxr-ar'
  | 'webxr-vr'
  | 'browser-3d';

export type SpatialPortalSupport = {
  capability: SpatialPortalCapability;
  secureContext: boolean;
  immersiveAr: boolean;
  immersiveVr: boolean;
  reason: string;
};

type XRSystemLike = {
  isSessionSupported(mode: SpatialPortalMode): Promise<boolean>;
  requestSession(mode: SpatialPortalMode, options?: Record<string, unknown>): Promise<XRSessionLike>;
};

type XRReferenceSpaceLike = object;

type XRViewLike = {
  projectionMatrix: Float32Array;
  transform: { inverse: { matrix: Float32Array } };
};

type XRViewerPoseLike = {
  views: XRViewLike[];
  transform: {
    position: { x: number; y: number; z: number };
  };
};

type XRFrameLike = {
  getViewerPose(space: XRReferenceSpaceLike): XRViewerPoseLike | null;
};

type XRWebGLLayerLike = {
  framebuffer: WebGLFramebuffer | null;
  getViewport(view: XRViewLike): { x: number; y: number; width: number; height: number } | null;
};

type XRSessionLike = EventTarget & {
  enabledFeatures?: readonly string[];
  environmentBlendMode?: string;
  renderState: { baseLayer?: XRWebGLLayerLike };
  requestReferenceSpace(type: string): Promise<XRReferenceSpaceLike>;
  requestAnimationFrame(callback: (time: number, frame: XRFrameLike) => void): number;
  updateRenderState(state: { baseLayer: XRWebGLLayerLike }): void;
  end(): Promise<void>;
};

type XRWebGLLayerConstructor = new (
  session: XRSessionLike,
  context: WebGLRenderingContext,
  options?: Record<string, unknown>
) => XRWebGLLayerLike;

type XRNavigator = Navigator & { xr?: XRSystemLike };

type XRGlobal = typeof globalThis & {
  XRWebGLLayer?: XRWebGLLayerConstructor;
};

export type SpatialPortalSession = {
  mode: SpatialPortalMode;
  referenceSpace: 'local-floor' | 'local';
  enabledFeatures: readonly string[];
  end: () => Promise<void>;
};

export function classifySpatialCapability(input: {
  secureContext: boolean;
  immersiveAr: boolean;
  immersiveVr: boolean;
}): SpatialPortalSupport {
  if (!input.secureContext) {
    return {
      capability: 'browser-3d',
      secureContext: false,
      immersiveAr: false,
      immersiveVr: false,
      reason: 'WebXR immersive sessions require a secure HTTPS context.'
    };
  }

  if (input.immersiveAr) {
    return {
      capability: 'webxr-ar',
      secureContext: true,
      immersiveAr: true,
      immersiveVr: input.immersiveVr,
      reason: 'Immersive AR is available on this browser and device.'
    };
  }

  if (input.immersiveVr) {
    return {
      capability: 'webxr-vr',
      secureContext: true,
      immersiveAr: false,
      immersiveVr: true,
      reason: 'Immersive WebXR is available, but passthrough AR is not exposed by this browser.'
    };
  }

  return {
    capability: 'browser-3d',
    secureContext: true,
    immersiveAr: false,
    immersiveVr: false,
    reason: 'This browser does not expose an immersive WebXR session mode.'
  };
}

export async function detectSpatialPortalSupport(): Promise<SpatialPortalSupport> {
  const secureContext = window.isSecureContext;
  const xr = (navigator as XRNavigator).xr;

  if (!secureContext || !xr) {
    return classifySpatialCapability({
      secureContext,
      immersiveAr: false,
      immersiveVr: false
    });
  }

  const [immersiveAr, immersiveVr] = await Promise.all([
    xr.isSessionSupported('immersive-ar').catch(() => false),
    xr.isSessionSupported('immersive-vr').catch(() => false)
  ]);

  return classifySpatialCapability({ secureContext, immersiveAr, immersiveVr });
}

function multiply4x4(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let value = 0;
      for (let i = 0; i < 4; i += 1) {
        value += a[i * 4 + row] * b[col * 4 + i];
      }
      out[col * 4 + row] = value;
    }
  }
  return out;
}

function translationMatrix(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ]);
}

function createPortalGeometry(segments = 96): Float32Array {
  const vertices: number[] = [];
  const outerX = 0.82;
  const outerY = 1.22;
  const innerX = 0.70;
  const innerY = 1.08;

  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2;
    const a1 = ((index + 1) / segments) * Math.PI * 2;

    const o0 = [Math.cos(a0) * outerX, Math.sin(a0) * outerY, 0];
    const o1 = [Math.cos(a1) * outerX, Math.sin(a1) * outerY, 0];
    const i0 = [Math.cos(a0) * innerX, Math.sin(a0) * innerY, 0];
    const i1 = [Math.cos(a1) * innerX, Math.sin(a1) * innerY, 0];

    vertices.push(...o0, ...i0, ...o1, ...o1, ...i0, ...i1);
  }

  return new Float32Array(vertices);
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('portal_shader_allocation_failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'portal_shader_compile_failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createPortalProgram(gl: WebGLRenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, `
    attribute vec3 a_position;
    uniform mat4 u_mvp;
    void main() {
      gl_Position = u_mvp * vec4(a_position, 1.0);
    }
  `);

  const fragment = createShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform float u_time;
    uniform float u_alpha;
    void main() {
      float pulse = 0.72 + 0.28 * sin(u_time * 2.4);
      vec3 cyan = vec3(0.18, 0.88, 1.0);
      vec3 violet = vec3(0.38, 0.42, 1.0);
      vec3 color = mix(violet, cyan, pulse);
      gl_FragColor = vec4(color, u_alpha);
    }
  `);

  const program = gl.createProgram();
  if (!program) throw new Error('portal_program_allocation_failed');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'portal_program_link_failed';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  return {
    program,
    position: gl.getAttribLocation(program, 'a_position'),
    mvp: gl.getUniformLocation(program, 'u_mvp'),
    time: gl.getUniformLocation(program, 'u_time'),
    alpha: gl.getUniformLocation(program, 'u_alpha')
  };
}

async function resolveReferenceSpace(session: XRSessionLike) {
  try {
    return {
      space: await session.requestReferenceSpace('local-floor'),
      type: 'local-floor' as const,
      portalY: 1.25
    };
  } catch {
    return {
      space: await session.requestReferenceSpace('local'),
      type: 'local' as const,
      portalY: 0
    };
  }
}

export async function startSpatialPortalSession(input: {
  canvas: HTMLCanvasElement;
  mode: SpatialPortalMode;
  domOverlayRoot?: HTMLElement | null;
  onTraverse: () => void;
  onEnded?: () => void;
}): Promise<SpatialPortalSession> {
  const xr = (navigator as XRNavigator).xr;
  const Layer = (globalThis as XRGlobal).XRWebGLLayer;

  if (!window.isSecureContext || !xr || !Layer) {
    throw new Error('webxr_runtime_unavailable');
  }

  const options: Record<string, unknown> = {
    requiredFeatures: ['local'],
    optionalFeatures: ['local-floor', 'bounded-floor', 'hit-test', 'anchors', 'dom-overlay']
  };

  if (input.domOverlayRoot) {
    options.domOverlay = { root: input.domOverlayRoot };
  }

  const session = await xr.requestSession(input.mode, options);
  const gl = input.canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: false
  });

  if (!gl) {
    await session.end().catch(() => undefined);
    throw new Error('webgl_unavailable');
  }

  const xrGl = gl as WebGLRenderingContext & { makeXRCompatible?: () => Promise<void> };
  if (xrGl.makeXRCompatible) await xrGl.makeXRCompatible();

  const baseLayer = new Layer(session, gl, { alpha: true });
  session.updateRenderState({ baseLayer });

  const reference = await resolveReferenceSpace(session);
  const portalZ = -2.2;
  const portalModel = translationMatrix(0, reference.portalY, portalZ);
  const geometry = createPortalGeometry();
  const gpu = createPortalProgram(gl);
  const buffer = gl.createBuffer();

  if (!buffer) {
    await session.end().catch(() => undefined);
    throw new Error('portal_buffer_allocation_failed');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
  gl.useProgram(gpu.program);
  gl.enableVertexAttribArray(gpu.position);
  gl.vertexAttribPointer(gpu.position, 3, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.DEPTH_TEST);

  let previousSide: number | null = null;
  let traversing = false;
  let ended = false;

  const cleanup = () => {
    if (ended) return;
    ended = true;
    gl.deleteBuffer(buffer);
    gl.deleteProgram(gpu.program);
    input.onEnded?.();
  };

  session.addEventListener('end', cleanup, { once: true });

  const traverse = () => {
    if (traversing) return;
    traversing = true;
    session.end()
      .catch(() => undefined)
      .finally(() => input.onTraverse());
  };

  const drawFrame = (time: number, frame: XRFrameLike) => {
    if (ended || traversing) return;

    const pose = frame.getViewerPose(reference.space);
    const layer = session.renderState.baseLayer;
    if (!pose || !layer) {
      session.requestAnimationFrame(drawFrame);
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, input.mode === 'immersive-ar' ? 0 : 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(gpu.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(gpu.position);
    gl.vertexAttribPointer(gpu.position, 3, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gpu.time, time / 1000);
    gl.uniform1f(gpu.alpha, input.mode === 'immersive-ar' ? 0.92 : 1);

    for (const view of pose.views) {
      const viewport = layer.getViewport(view);
      if (!viewport) continue;
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

      const viewModel = multiply4x4(view.transform.inverse.matrix, portalModel);
      const mvp = multiply4x4(view.projectionMatrix, viewModel);
      gl.uniformMatrix4fv(gpu.mvp, false, mvp);
      gl.drawArrays(gl.TRIANGLES, 0, geometry.length / 3);
    }

    const viewer = pose.transform.position;
    const side = viewer.z - portalZ;
    const insideWidth = Math.abs(viewer.x) < 0.78;
    const insideHeight = Math.abs(viewer.y - reference.portalY) < 1.15;

    if (
      previousSide !== null
      && previousSide > 0.12
      && side <= 0.12
      && insideWidth
      && insideHeight
    ) {
      traverse();
      return;
    }

    previousSide = side;
    session.requestAnimationFrame(drawFrame);
  };

  session.requestAnimationFrame(drawFrame);

  return {
    mode: input.mode,
    referenceSpace: reference.type,
    enabledFeatures: session.enabledFeatures ?? [],
    end: async () => {
      await session.end().catch(() => undefined);
      cleanup();
    }
  };
}
