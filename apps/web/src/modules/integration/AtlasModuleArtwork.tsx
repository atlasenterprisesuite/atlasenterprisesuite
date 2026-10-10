import React from 'react';
import type { AtlasModuleDefinition } from '../registry';

type ArtworkModule = Pick<AtlasModuleDefinition, 'id' | 'area' | 'navLabel'>;
type Palette = { base: string; mid: string; light: string };

const THEMES: Record<string, Palette> = {
  Platform: { base: '#06132b', mid: '#2978c9', light: '#82ddff' },
  Intelligence: { base: '#120b36', mid: '#7058df', light: '#d0a7ff' },
  Business: { base: '#09252b', mid: '#198f99', light: '#6bffe0' },
  Finance: { base: '#102036', mid: '#2677b3', light: '#9af4d4' },
  Operations: { base: '#1a2333', mid: '#b57a3d', light: '#ffda91' },
  Communications: { base: '#0c173d', mid: '#4977d9', light: '#75e0ff' },
  People: { base: '#241535', mid: '#a05eac', light: '#ffc2e9' },
  Health: { base: '#062c31', mid: '#14979b', light: '#98ffe7' },
  Protection: { base: '#112838', mid: '#5b89a9', light: '#d5f2ff' },
  Creative: { base: '#1b123e', mid: '#8b47d7', light: '#fa9bea' },
  Entertainment: { base: '#2c122c', mid: '#b3549e', light: '#ffd595' },
  Hospitality: { base: '#172537', mid: '#a9775a', light: '#ffe5ae' },
  Mobility: { base: '#101e35', mid: '#2879b5', light: '#6ff7e8' },
  Spatial: { base: '#071b32', mid: '#436ba7', light: '#75dbff' }
};

function artworkSeed(id: string) {
  return Array.from(id).reduce((value, char) => (value * 31 + char.charCodeAt(0)) % 10007, 17);
}

function CoreMotif({ area }: { area: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (area) {
    case 'Finance':
      return <g {...common}><path d="M-83 60V-25h38v85M-22 60v-100h38V60M39 60v-147h38V60" /><path d="m-85-69 55 24 38-44 61-43" strokeWidth="5" /></g>;
    case 'Business':
      return <g {...common}><path d="M-90 70V-80h61V70M-9 70V-132h74V70M82 70V-43h32V70" /><path d="M-72-52h22m-22 38h22m-22 38h22m78-116h30M8-47h30M8-2h30" strokeWidth="5" /></g>;
    case 'Operations':
      return <g {...common}><path d="m-112-42 112-69 112 69v121h-224zM-66 78V-18H66v96M-66 7H66M-66 39H66" /></g>;
    case 'Intelligence':
      return <g {...common}><path d="m-75-38 81-88 75 55-28 109-107 40-21-116M-75-38 53 38M6-126l-60 204M81-71-54 78" strokeWidth="6"/>{[[-75,-38],[6,-126],[81,-71],[53,38],[-54,78]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="12" fill="currentColor" stroke="none" />)}</g>;
    case 'Communications':
      return <g {...common}><path d="M0 76V-26M-35 75h70M-26-26 0-68l26 42M-67-65a96 96 0 0 1 134 0M-95-93a134 134 0 0 1 190 0M-41-38a58 58 0 0 1 82 0" /></g>;
    case 'People':
      return <g {...common}><circle cx="0" cy="-79" r="35"/><path d="M-75 72V37A75 75 0 0 1 75 37v35M-98-59a24 24 0 1 0-12 45M98-59a24 24 0 1 1 12 45M-113 70v-20m226 20v-20" /></g>;
    case 'Health':
      return <g {...common}><path d="M-28-115h56v80h80v56H28v80h-56V21h-80v-56h80z" /><path d="M-110 102h48l28-18 27 35 34-56 22 39h62" strokeWidth="5" /></g>;
    case 'Protection':
      return <g {...common}><path d="M0-126 98-84V-7c0 57-37 104-98 136C-61 97-98 50-98-7v-77zM-42-2l30 30 59-65" /></g>;
    case 'Creative':
      return <g {...common}>{[-100,-75,-50,-25,0,25,50,75,100].map((x,i)=><path key={x} d={'M'+x+' '+(-[25,55,80,43,110,56,92,60,28][i])+'v'+[50,110,160,86,220,112,184,120,56][i]} strokeWidth="10" />)}</g>;
    case 'Entertainment':
      return <g {...common}><path d="m0-120 37 77 85 12-62 61 15 85L0 75l-75 40 15-85-62-61 85-12zM-129 91l-28 27m286-27 28 27" /></g>;
    case 'Hospitality':
      return <g {...common}><path d="M-100 91v-190h200V91M-44 91V28h88v63M-66-67h28m40 0h28m40 0h-4M-66-24h28m40 0h28m40 0h-4M-128 92h256" /></g>;
    case 'Mobility':
      return <g {...common}><path d="M-111 99-42-125h84l69 224M-32 99l14-46m36 0 14 46M-3-115v35M0-51V-6" /><path d="M-100 100h200" strokeWidth="6" /></g>;
    case 'Spatial':
      return <g {...common}><path d="m0-123 109 61v124L0 123-109 62V-62zM0-123v246M-109-62 0 0l109-62M-109 62 0 0l109 62" strokeWidth="5" /><circle cx="0" cy="0" r="29"/></g>;
    default:
      return <g {...common}><circle r="90"/><ellipse rx="133" ry="43" transform="rotate(-27)"/><ellipse rx="133" ry="43" transform="rotate(42)"/><circle r="17" fill="currentColor" stroke="none"/></g>;
  }
}

/** Decorative vectors derived from the canonical registry. Never implies provider or production readiness. */
export function AtlasModuleArtwork({ module }: { module: ArtworkModule }) {
  const theme = THEMES[module.area] ?? THEMES.Platform;
  const seed = artworkSeed(module.id);
  const uid = 'atlas-cover-' + module.id.replace(/[^a-z0-9-]/gi, '');
  const title = module.navLabel.length > 18 ? module.navLabel.slice(0, 18) : module.navLabel;
  const hue = seed % 4;
  const xShift = seed % 65;
  const star = Array.from({ length: 12 }, (_, i) => ({
    x: 35 + (i * 97 + seed * 3) % 566,
    y: 30 + (i * 47 + seed) % 275,
    r: 1 + (i + seed) % 2
  }));

  return (
    <svg
      data-testid="atlas-module-artwork"
      data-module-id={module.id}
      className="suite-module-artwork"
      viewBox="0 0 640 360"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={uid + '-background'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.base} />
          <stop offset=".62" stopColor={theme.mid} stopOpacity=".48" />
          <stop offset="1" stopColor="#020818" />
        </linearGradient>
        <radialGradient id={uid + '-glow'}>
          <stop offset="0" stopColor={theme.light} stopOpacity=".39" />
          <stop offset=".48" stopColor={theme.mid} stopOpacity=".19" />
          <stop offset="1" stopColor={theme.base} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={uid + '-panel'} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffffff" stopOpacity=".16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".02" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill={'url(#' + uid + '-background)'} />
      <circle cx={460 + xShift / 2} cy="155" r={190 + hue * 10} fill={'url(#' + uid + '-glow)'} />
      <g stroke={theme.light} strokeOpacity=".09" strokeWidth="1">
        {Array.from({ length: 14 }, (_, i) => <path key={'vertical-' + i} d={'M' + (i * 55) + ' 0v360'} />)}
        {Array.from({ length: 8 }, (_, i) => <path key={'horizontal-' + i} d={'M0 ' + (i * 50) + 'h640'} />)}
      </g>
      <g fill={theme.light} opacity=".58">
        {star.map((point,i) => <circle key={i} cx={point.x} cy={point.y} r={point.r} />)}
      </g>
      <rect x="23" y="27" width="594" height="306" rx="22" fill="none" stroke={theme.light} strokeOpacity=".22" />
      <path d="M45 74h215M45 284h545" stroke={theme.light} strokeOpacity=".27" strokeWidth="1.6" />
      <g transform="translate(465 164)" color={theme.light} opacity=".9">
        <circle r={125 + hue * 3} fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="2" />
        <circle r={106 + hue * 3} fill={'url(#' + uid + '-panel)'} stroke="currentColor" strokeOpacity=".45" strokeWidth="1.8" />
        <circle r="132" fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth="2" strokeDasharray={(25 + seed % 30) + ' 18'} transform={'rotate(' + (seed % 140) + ')'} />
        <g transform={'rotate(' + ((seed % 7) - 3) * 4 + ') scale(.66)'}><CoreMotif area={module.area} /></g>
      </g>
      <text x="46" y="56" fill="#e8f5ff" fontSize="18" fontWeight="800" letterSpacing="4" fontFamily="Arial, sans-serif">ATLAS</text>
      <text x="48" y="110" fill={theme.light} fontSize="12" fontWeight="700" letterSpacing="2.8" fontFamily="Arial, sans-serif">{module.area.toUpperCase()}</text>
      <text x="46" y="220" fill="#f5faff" fontSize="35" fontWeight="700" fontFamily="Arial, sans-serif">{title}</text>
      <text x="48" y="255" fill={theme.light} fontSize="12" fontWeight="700" letterSpacing="1.4" fontFamily="Arial, sans-serif">ONE CORE · EVERY MODULE</text>
      <g transform="translate(48 304)" fill={theme.light}>
        {Array.from({length:6},(_,i)=><rect key={i} x={i*18} y={-(i*5 + seed%12)} width="8" height={i*5+seed%12+7} rx="3" opacity={.33 + i*.1}/>)}
      </g>
      <text x="584" y="310" fill={theme.light} fontSize="11" textAnchor="end" fontFamily="monospace" opacity=".8">{String(seed).padStart(4,'0')}</text>
    </svg>
  );
}