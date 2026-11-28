import { useEffect, useRef, useState } from 'react';
import type { GalaxyNodeView } from './galaxyModel';
import { orbitalPositions, projectOrbitalPoint, type ProjectedPoint } from './orbitalRuntime';
import { materialAt, materialForNode, type PlanetMaterial } from './planetarySurface';
import './nexusOrbitalRuntime.css';

type Hit = ProjectedPoint & { id: string };

function paintSphere(ctx: CanvasRenderingContext2D, p: ProjectedPoint, core: ProjectedPoint, kind: PlanetMaterial, surface: HTMLCanvasElement, seconds: number) {
  const radius = Math.max(2, p.radius);
  const n = Math.min(144, Math.max(24, Math.ceil(radius * 2)));
  surface.width = n;
  surface.height = n;
  const brush = surface.getContext('2d');
  if (!brush) throw new Error('No surface context');
  const pixels = brush.createImageData(n, n);
  const spin = seconds * 0.035;
  const cs = Math.cos(spin), sn = Math.sin(spin);
  const dx = core.x - p.x, dy = core.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (2 * i + 1) / n - 1, y = (2 * j + 1) / n - 1;
    const rr = x * x + y * y;
    if (rr >= 1) continue;
    const z = Math.sqrt(1 - rr);
    const base = materialAt(kind, x * cs + z * sn, y, z * cs - x * sn);
    const illumination = kind === 'star' ? 1.1 + 0.3 * z : 0.06 + 0.94 * Math.max(0, x * dx / len * 0.94 + y * dy / len * 0.94 + z * 0.34);
    const rim = Math.pow(1 - z, 3) * 18;
    const k = (j * n + i) * 4;
    for (let c = 0; c < 3; c++) pixels.data[k + c] = Math.min(255, base[c] * illumination + rim * (c === 2 ? 1 : 0.4));
    pixels.data[k + 3] = Math.min(255, (1 - Math.sqrt(rr)) * n * 255);
  }
  brush.putImageData(pixels, 0, 0);
  if (kind === 'star') {
    const glow = ctx.createRadialGradient(p.x, p.y, radius * 0.6, p.x, p.y, radius * 2.6);
    glow.addColorStop(0, 'rgba(255,186,68,.7)');
    glow.addColorStop(1, 'rgba(255,110,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - radius * 2.6, p.y - radius * 2.6, radius * 5.2, radius * 5.2);
  }
  ctx.drawImage(surface, p.x - radius, p.y - radius, radius * 2, radius * 2);
}

export function NexusOrbitalRuntime({ nodes, onOpen }: { nodes: GalaxyNodeView[]; onOpen: (node: GalaxyNodeView) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hits = useRef<Hit[]>([]);
  const clock = useRef(0);
  const [selected, setSelected] = useState('core');
  const [yaw, setYaw] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const choice = nodes.find(node => node.id === selected);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = element.getContext('2d'); } catch { /* accessible navigation remains available */ }
    if (!ctx) { setUnavailable(true); return; }
    const context = ctx;
    const surface = document.createElement('canvas');
    let frame = 0, last = 0, disposed = false;
    const render = (now: number) => {
      if (disposed) return;
      if (playing && last) clock.current += Math.min((now - last) / 1000, 0.1);
      last = now;
      const width = Math.max(1, Math.min(1200, Math.round(element.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5))));
      const height = Math.max(1, Math.round(width * 0.56));
      if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
      try {
        context.fillStyle = '#030610'; context.fillRect(0, 0, width, height);
        for (let i = 0; i < 140; i++) {
          context.fillStyle = i % 7 === 0 ? 'rgba(200,220,255,.8)' : 'rgba(170,190,215,.28)';
          context.fillRect(((i * 137.507) % 100) / 100 * width, ((i * 73.913) % 100) / 100 * height, i % 7 === 0 ? 1.6 : 0.7, i % 7 === 0 ? 1.6 : 0.7);
        }
        const points = orbitalPositions(nodes.length, clock.current);
        const projected = points.map(p => projectOrbitalPoint(p, yaw, zoom, width, height));
        const core = projected[0];
        if (core) {
          for (let i = 1; i < points.length; i++) {
            const orbit = Math.hypot(points[i].x, points[i].z);
            context.beginPath();
            for (let j = 0; j <= 120; j++) {
              const angle = j * Math.PI / 60;
              const p = projectOrbitalPoint({ x: orbit * Math.cos(angle), y: 0, z: orbit * Math.sin(angle), radius: 0 }, yaw, zoom, width, height);
              if (j === 0) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y);
            }
            context.strokeStyle = 'rgba(126,160,215,.23)'; context.lineWidth = 0.8; context.stroke();
          }
          const order = projected.map((p, index) => ({ p, index })).sort((a, b) => b.p.depth - a.p.depth);
          hits.current = order.map(({ p, index }) => ({ ...p, id: nodes[index].id }));
          for (const { p, index } of order) {
            paintSphere(context, p, core, materialForNode(nodes[index].id), surface, clock.current);
            if (nodes[index].id === selected) {
              context.beginPath(); context.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
              context.strokeStyle = '#2edbff'; context.lineWidth = 1.5; context.stroke();
            }
          }
        }
      } catch {
        setUnavailable(true); return;
      }
      if (playing) frame = window.requestAnimationFrame(render);
    };
    const resize = () => { if (!playing) render(performance.now()); };
    window.addEventListener('resize', resize);
    render(performance.now());
    return () => { disposed = true; window.cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [nodes, selected, yaw, zoom, playing]);

  return (
    <section className="nexus-orbital-runtime" aria-label="ATLAS NEXUS interactive orbital runtime">
      <div className="nexus-orbital-header"><div><p className="eyebrow">NEXUS 777</p><h2>Orbital workspace</h2></div><p>Procedural 3D geometry · illustrative, not live astronomical data</p></div>
      <canvas ref={canvas} className="nexus-orbital-canvas" hidden={unavailable} aria-hidden="true" onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const x = (event.clientX - bounds.left) * event.currentTarget.width / bounds.width;
        const y = (event.clientY - bounds.top) * event.currentTarget.height / bounds.height;
        const hit = [...hits.current].reverse().find(p => Math.hypot(p.x - x, p.y - y) <= p.radius);
        if (hit) setSelected(hit.id);
      }} />
      {unavailable && <p role="status">Orbital rendering unavailable. The module navigation below is still available.</p>}
      <div className="nexus-orbital-controls">
        <button type="button" disabled={unavailable} onClick={() => setPlaying(v => !v)}>{playing ? 'Pause orbit' : 'Play orbit'}</button>
        <button type="button" disabled={unavailable} onClick={() => setYaw(v => v - 0.18)}>Rotate left</button>
        <button type="button" disabled={unavailable} onClick={() => setYaw(v => v + 0.18)}>Rotate right</button>
        <button type="button" disabled={unavailable} onClick={() => setZoom(v => Math.min(2, v + 0.15))}>Zoom in</button>
        <button type="button" disabled={unavailable} onClick={() => setZoom(v => Math.max(0.5, v - 0.15))}>Zoom out</button>
        <button type="button" disabled={unavailable} onClick={() => { clock.current = 0; setPlaying(false); setYaw(0); setZoom(1); }}>Reset camera</button>
      </div>
      <div className="nexus-orbital-controls" aria-label="Orbital destinations">{nodes.map(node =>
        <button type="button" key={node.id} aria-label={'Select orbit ' + node.id} aria-pressed={selected === node.id} onClick={() => setSelected(node.id)}>{node.label}</button>
      )}</div>
      {choice && <div className="nexus-orbital-selection"><div aria-live="polite"><strong>{choice.label}</strong><p>{choice.statusLabel}</p></div><button type="button" disabled={!choice.navigable || !choice.route} onClick={() => { if (choice.navigable && choice.route) onOpen(choice); }}>Open selected module</button></div>}
    </section>
  );
}
