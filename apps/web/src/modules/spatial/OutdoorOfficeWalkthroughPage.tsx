import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './outdoor-office.css';

type Camera = {
  x: number;
  y: number;
  zoom: number;
  label: string;
};

const START_CAMERA: Camera = { x: 50, y: 52, zoom: 1.02, label: 'Entrance' };

const PRESETS: Camera[] = [
  { x: 50, y: 52, zoom: 1.02, label: 'Entrance' },
  { x: 37, y: 55, zoom: 1.34, label: 'Team workstations' },
  { x: 57, y: 56, zoom: 1.46, label: 'Meeting table' },
  { x: 73, y: 53, zoom: 1.5, label: 'Bar workspace' },
  { x: 62, y: 42, zoom: 1.56, label: 'Presentation zone' }
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function OutdoorOfficeWalkthroughPage() {
  const [camera, setCamera] = useState<Camera>(START_CAMERA);

  const backgroundSize = useMemo(() => `${Math.round(camera.zoom * 118)}% auto`, [camera.zoom]);

  function updateCamera(patch: Partial<Camera>) {
    setCamera(current => ({
      x: clamp(patch.x ?? current.x, 24, 78),
      y: clamp(patch.y ?? current.y, 34, 68),
      zoom: clamp(patch.zoom ?? current.zoom, 1, 1.82),
      label: patch.label ?? 'Free navigation'
    }));
  }

  function move(direction: 'forward' | 'back' | 'left' | 'right') {
    setCamera(current => {
      if (direction === 'forward') {
        return { ...current, zoom: clamp(current.zoom + 0.12, 1, 1.82), y: clamp(current.y - 1.5, 34, 68), label: 'Moving forward' };
      }
      if (direction === 'back') {
        return { ...current, zoom: clamp(current.zoom - 0.12, 1, 1.82), y: clamp(current.y + 1.5, 34, 68), label: 'Moving back' };
      }
      if (direction === 'left') {
        return { ...current, x: clamp(current.x - 6, 24, 78), label: 'Looking left' };
      }
      return { ...current, x: clamp(current.x + 6, 24, 78), label: 'Looking right' };
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
      event.preventDefault();
      move('forward');
    } else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
      event.preventDefault();
      move('back');
    } else if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
      event.preventDefault();
      move('left');
    } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
      event.preventDefault();
      move('right');
    }
  }

  return (
    <section className="atlas-spatial-office">
      <nav className="spatial-breadcrumb" aria-label="Breadcrumb">
        <Link to="/studio">ATLAS Studio</Link><span>/</span><span>Spatial</span><span>/</span><span>Outdoor Office</span>
      </nav>

      <header className="spatial-header">
        <div>
          <p className="eyebrow">ATLAS Spatial Studio</p>
          <h1>Outdoor Office Walkthrough</h1>
          <p>Move through the approved outdoor-office concept with the on-screen arrows or your keyboard. The current release is a navigable design render; a true 360° capture can replace the scene later without changing the control model.</p>
        </div>
        <button type="button" className="spatial-reset" onClick={() => setCamera(START_CAMERA)}>Reset view</button>
      </header>

      <div
        className="spatial-viewport"
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="Navigable outdoor office concept. Use arrow keys or W A S D."
      >
        <div
          className="spatial-scene"
          style={{
            backgroundImage: "url('/atlas/spatial/outdoor-office-concept.svg')",
            backgroundPosition: `${camera.x}% ${camera.y}%`,
            backgroundSize
          }}
          role="img"
          aria-label="ATLAS outdoor office concept render"
        />
        <div className="spatial-vignette" aria-hidden="true" />
        <div className="spatial-hud">
          <span className="spatial-status" aria-live="polite">{camera.label}</span>
          <span>{Math.round(camera.zoom * 100)}% · X {Math.round(camera.x)} · Y {Math.round(camera.y)}</span>
        </div>

        <div className="spatial-pad" aria-label="Movement controls">
          <button type="button" className="up" onClick={() => move('forward')} aria-label="Move forward">↑</button>
          <button type="button" className="left" onClick={() => move('left')} aria-label="Move left">←</button>
          <button type="button" className="down" onClick={() => move('back')} aria-label="Move back">↓</button>
          <button type="button" className="right" onClick={() => move('right')} aria-label="Move right">→</button>
        </div>
      </div>

      <div className="spatial-presets" aria-label="Camera presets">
        {PRESETS.map(preset => (
          <button
            type="button"
            key={preset.label}
            className={camera.label === preset.label ? 'active' : ''}
            onClick={() => updateCamera(preset)}
          >
            <strong>{preset.label}</strong>
            <span>{Math.round(preset.zoom * 100)}%</span>
          </button>
        ))}
      </div>

      <aside className="spatial-truth">
        <strong>Visual-navigation boundary</strong>
        <span>This interaction moves the camera across the approved design render. It does not claim geometric depth, LiDAR measurements or a stitched equirectangular panorama that has not been captured.</span>
      </aside>
    </section>
  );
}
