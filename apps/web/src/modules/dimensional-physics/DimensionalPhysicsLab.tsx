import { useState } from 'react';
import { addPlanckScale, classifyDimension, kkMassGeV, rsWarpedScaleGeV } from './dimensionalPhysics';

/** Scientific toy-model viewer. Never displays these predictions as measured observations. */
export function DimensionalPhysicsLab() {
  const [model, setModel] = useState<'kk'|'add'|'rs'>('kk');
  const [exponent, setExponent] = useState(16);
  const [mode, setMode] = useState(1);
  const result = model === 'kk'
    ? kkMassGeV(10 ** -exponent, mode)
    : model === 'add'
      ? addPlanckScale(1000, 2, 1e-3)
      : rsWarpedScaleGeV(1e19, exponent);
  return (
    <section aria-labelledby="dimensional-lab-title">
      <h2 id="dimensional-lab-title">ATLAS Dimensional Physics — model-only laboratory</h2>
      <p role="status">SIMULATION — not experimentally observed. Units: GeV. No external provider calls.</p>
      <label htmlFor="dim-model">Model</label>
      <select id="dim-model" value={model} onChange={event=>setModel(event.target.value as 'kk'|'add'|'rs')}>
        <option value="kk">Kaluza–Klein compact circle</option>
        <option value="add">ADD scaling (illustrative constants)</option>
        <option value="rs">Randall–Sundrum warped scale</option>
      </select>
      <label htmlFor="dim-exp">{model === 'kk' ? 'Radius exponent (R = 10^-x meters)' : 'Warp exponent / illustrative parameter'}: {exponent}</label>
      <input id="dim-exp" type="range" min="1" max="20" value={exponent} onChange={event=>setExponent(Number(event.target.value))} disabled={model==='add'} />
      {model==='kk' && <><label htmlFor="dim-mode">KK excitation mode: {mode}</label><input id="dim-mode" type="range" min="0" max="10" value={mode} onChange={event=>setMode(Number(event.target.value))}/></>}
      <output aria-live="polite">{Number.isFinite(result) ? result.toExponential(4) : 'Out of numerical range'} GeV</output>
      <p>Extra spatial axis: {classifyDimension('extra-spatial')}; Hilbert axis: {classifyDimension('hilbert')}; GPS 5D context: {classifyDimension('gps-context')}.</p>
      <p>These models use different parameters and must not be compared as if they predict the same observable. ADD constants are fixed demonstration values.</p>
    </section>
  );
}
