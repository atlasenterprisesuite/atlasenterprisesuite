import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loadAccessibilityProfile, resolveAccessibilityUserId, syncAccessibilityProfileRemote } from '../../services/accessibilityProfile';

export type Capability = 'available' | 'unsupported' | 'requires-action' | 'offline';
export function iosCapabilities(env: { online: boolean; secure: boolean; standalone: boolean; notification: boolean; camera: boolean; speech: boolean }): Record<string, Capability> {
  return {
    identity: env.online && env.secure ? 'available' : 'offline',
    preferences: env.online ? 'requires-action' : 'offline',
    voice: !env.online ? 'offline' : env.speech ? 'requires-action' : 'unsupported',
    notifications: !env.secure || !env.notification ? 'unsupported' : !env.standalone ? 'requires-action' : 'requires-action',
    camera: !env.secure || !env.camera ? 'unsupported' : 'requires-action',
    offline: 'unsupported'
  };
}
export function IosDeviceSetupPage() {
  const [sync, setSync] = useState('Not requested');
  const [notification, setNotification] = useState('Not requested');
  const [camera, setCamera] = useState('Not requested');
  const secure = window.isSecureContext;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as Navigator & {standalone?: boolean}).standalone === true);
  const status = iosCapabilities({online:navigator.onLine,secure,standalone,notification:'Notification' in window,camera:Boolean(navigator.mediaDevices?.getUserMedia),speech:Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)});
  async function synchronize() {
    if (!navigator.onLine) { setSync('Offline: remote sync blocked'); return; }
    const id = resolveAccessibilityUserId();
    if (id === 'local-user') { setSync('Identity unavailable: sync blocked'); return; }
    try { setSync(await syncAccessibilityProfileRemote(loadAccessibilityProfile(id))); }
    catch { setSync('Sync failed'); }
  }
  async function requestNotification() {
    if (!secure || !standalone || !('Notification' in window)) { setNotification('Unavailable: install to Home Screen first'); return; }
    try { setNotification(await Notification.requestPermission()); } catch { setNotification('Permission request failed'); }
  }
  async function requestCamera() {
    if (!secure || !navigator.mediaDevices?.getUserMedia) { setCamera('Camera unavailable'); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({video:true,audio:false}); stream.getTracks().forEach(track=>track.stop()); setCamera('Permission verified; camera stopped'); }
    catch { setCamera('Camera permission denied or unavailable'); }
  }
  return <section className="page-stack" aria-labelledby="ios-setup-title">
    <header className="page-header"><p className="eyebrow">ATLAS Device OS · iOS</p><h1 id="ios-setup-title">iPhone / iPad setup</h1><p>Capability diagnostics only. No device enrollment or background access is implied.</p></header>
    <div className="notice">Install from Safari → Share → Add to Home Screen. This does not prove offline readiness or push delivery.</div>
    <div className="module-grid">
      {Object.entries(status).map(([name,value])=><article className="module-card" key={name}><strong>{name}</strong><p role="status">{value}</p></article>)}
    </div>
    <div className="filter-row">
      <button type="button" onClick={()=>void synchronize()}>Sync accessibility preferences</button>
      <button type="button" onClick={()=>void requestNotification()}>Request notification permission</button>
      <button type="button" onClick={()=>void requestCamera()}>Test camera permission</button>
    </div>
    <p role="status">Preferences: {sync}. Notifications: {notification}. Camera: {camera}.</p>
    <p><Link to="/settings/accessibility/communication">Accessibility preferences</Link> · <Link to="/studio/voice">ATLAS Voice</Link></p>
    <div className="notice">Offline execution, push subscription, camera scanning and device enrollment remain blocked pending separate implementation and verification.</div>
  </section>;
}
