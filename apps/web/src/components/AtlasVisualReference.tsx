import { Link } from 'react-router-dom';
import './atlas-visual-reference.css';

export type AtlasVisualReferenceId = 'dashboard' | 'universe' | 'modules' | 'voice';

const REFERENCES: Record<AtlasVisualReferenceId, {
  src: string;
  eyebrow: string;
  title: string;
  description: string;
  alt: string;
  to: string;
}> = {
  dashboard: {
    src: '/atlas/design/atlas-main-dashboard.webp',
    eyebrow: 'Original ATLAS design',
    title: 'Intelligence Dashboard',
    description: 'Canonical command-center reference for the ATLAS home, shell, status, activity and assistant surfaces.',
    alt: 'Original ATLAS futuristic intelligence dashboard design reference',
    to: '/'
  },
  universe: {
    src: '/atlas/design/atlas-universe.webp',
    eyebrow: 'Original ATLAS design',
    title: 'ATLAS Universe',
    description: 'Canonical spatial system reference for module navigation, Galaxy and connected enterprise domains.',
    alt: 'Original ATLAS Universe enterprise dashboard design reference',
    to: '/galaxy'
  },
  modules: {
    src: '/atlas/design/atlas-module-gallery.webp',
    eyebrow: 'Original ATLAS design',
    title: 'Module Design Gallery',
    description: 'Approved module visual language for Finance, Health, Ride, Studio, mobile and operational experiences.',
    alt: 'Original ATLAS module UI concept gallery design reference',
    to: '/suite'
  },
  voice: {
    src: '/atlas/design/atlas-voice.webp',
    eyebrow: 'Original ATLAS design',
    title: 'ATLAS Voice',
    description: 'Approved Voice control reference for assistant, settings, accessibility and voice-governed execution.',
    alt: 'Original ATLAS Voice interface design reference',
    to: '/voice'
  }
};

export function AtlasVisualReference({
  reference,
  compact = false
}: {
  reference: AtlasVisualReferenceId;
  compact?: boolean;
}) {
  const item = REFERENCES[reference];
  return (
    <aside className={compact ? 'atlas-visual-reference is-compact' : 'atlas-visual-reference'} aria-label={item.title}>
      <Link to={item.to} className="atlas-visual-reference-link">
        <span className="atlas-visual-reference-media">
          <img src={item.src} alt={item.alt} loading="lazy" decoding="async" />
          <span className="atlas-visual-reference-scan" aria-hidden="true" />
        </span>
        <span className="atlas-visual-reference-copy">
          <small>{item.eyebrow}</small>
          <strong>{item.title}</strong>
          <span>{item.description}</span>
          <em>Open connected ATLAS surface <span aria-hidden="true">↗</span></em>
        </span>
      </Link>
    </aside>
  );
}
