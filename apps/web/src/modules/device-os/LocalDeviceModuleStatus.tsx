import { useEffect, useMemo, useState } from 'react';
import { listLocalAgents, listLocalDevices, type AtlasLocalAgent, type AtlasLocalDevice } from './localControlApi';

export function LocalDeviceModuleStatus({ moduleId, title }: { moduleId: string; title: string }) {
  const [agents,setAgents]=useState<AtlasLocalAgent[]>([]);
  const [devices,setDevices]=useState<AtlasLocalDevice[]>([]);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let active=true;
    Promise.all([listLocalAgents(),listLocalDevices()])
      .then(([nextAgents,nextDevices])=>{ if(active){setAgents(nextAgents);setDevices(nextDevices);} })
      .catch((value)=>{ if(active)setError(value instanceof Error ? value.message : 'local_control_unavailable'); });
    return ()=>{active=false;};
  },[]);

  const eligibleAgentIds=useMemo(
    ()=>new Set(agents.filter(agent=>agent.status!=='revoked' && agent.modules.includes(moduleId)).map(agent=>agent.id)),
    [agents,moduleId]
  );
  const moduleDevices=devices.filter(device=>eligibleAgentIds.has(device.agent_id));

  return <article className="feature-card wide">
    <div className="card-heading">
      <div><p className="eyebrow">ATLAS Local Control Plane</p><h2>{title}</h2></div>
      <span className="status-chip neutral">{moduleDevices.length} registered</span>
    </div>
    {error ? <p>Local device state is unavailable: {error.replaceAll('_',' ')}.</p> :
      moduleDevices.length ? <div className="module-grid compact">
        {moduleDevices.slice(0,6).map(device=><div className="module-card" key={device.id}>
          <span>{device.device_type} · {device.adapter}</span><strong>{device.label}</strong>
          <p>{device.capabilities.join(', ') || 'No capabilities declared'}</p>
          <span className={device.health_status==='healthy'?'status-chip':'status-chip warning'}>{device.health_status}</span>
        </div>)}
      </div> : <p>No Local Agent has reported a device for this module. ATLAS will not fabricate connected hardware.</p>}
  </article>;
}
