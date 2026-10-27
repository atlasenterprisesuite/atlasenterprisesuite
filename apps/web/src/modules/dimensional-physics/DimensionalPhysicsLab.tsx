import { useId, useState } from 'react';
import { addPlanckScale, classifyDimension, kkMassGeV, rsWarpedScaleGeV } from './dimensionalPhysics';

/** Illustrative mathematical models only; never imply direct observation of extra dimensions. */
export function DimensionalPhysicsLab() {
  const id = useId();
  const [model, setModel] = useState<'kk'|'add'|'rs'>('kk');
  const [exponent, setExponent] = useState(16);
  const [mode, setMode] = useState(1);
  const value = model === 'kk'
    ? kkMassGeV(10 ** -exponent, mode)
    : model === 'add' ? addPlanckScale(1000, 2, 1e-3)
    : rsWarpedScaleGeV(1e19, exponent);
  const parameters = model === 'kk'
    ? 'Compactification radius R = 10^(-x) meters; massless 4D base state.'
    : model === 'add'
      ? 'M_D = 1000 GeV, n = 2, R = 0.001 GeV^-1; no geometric 2π factors.'
      : 'M_UV = 10^19 GeV, warp exponent kπr = x.';
  return (
    <section aria-labelledby={id + '-title'} aria-describedby={id + '-disclaimer'}>
      <h2 id={id + '-title'}>ATLAS Dimensional Physics — illustrative laboratory</h2>
      <p id={id + '-disclaimer'}>SIMULATION ONLY. No discovery of extra physical dimensions is claimed. No paid services or location data.</p>
      <label htmlFor={id + '-model'}>Mathematical model</label>
      <select id={id + '-model'} value={model} onChange={event => setModel(event.target.value as 'kk'|'add'|'rs')}>
        <option value="kk">Kaluza–Klein: compact circular dimension</option>
        <option value="add">ADD: idealized Planck-scale relationship</option>
        <option value="rs">Randall–Sundrum: warped energy scale</option>
      </select>
      <p id={id + '-parameters'}>{parameters}</p>
      {model !== 'add' && (
        <>
          <label htmlFor={id + '-exponent'}>{model === 'kk' ? 'Negative base-10 radius exponent' : 'Dimensionless warp exponent'}: {exponent}</label>
          <input id={id + '-exponent'} aria-describedby={id + '-parameters'} type="range" min="1" max="20" step="1" value={exponent} onChange={event => setExponent(Number(event.target.value))} />
        </>
      )}
      {model === 'kk' && (
        <>
          <label htmlFor={id + '-mode'}>Excitation mode n: {mode}</label>
          <input id={id + '-mode'} type="range" min="0" max="10" step="1" value={mode} onChange={event => setMode(Number(event.target.value))} />
        </>
      )}
      <p>Predicted energy scale (model only): <output aria-live="polite" aria-atomic="true">{value.toExponential(4)} GeV</output></p>
      <p>Hypothetical physical: {classifyDimension('extra-spatial')}; quantum state-space: {classifyDimension('hilbert')}; GPS 5D metadata: {classifyDimension('gps-context')}.</p>
      <p>These are different models and observables. No comparison with collider exclusions is performed without an explicit compatible benchmark.</p>
    </section>
  );
}
