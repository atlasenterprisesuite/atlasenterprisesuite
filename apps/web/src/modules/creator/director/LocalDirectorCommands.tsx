import React, { useMemo, useState } from 'react';
import { planDirectorCommand } from '../../../../../../packages/creator/local_commands';
import type { ProductionSpec } from '../../../../../../packages/creator/types';
import type { DirectorAction } from './directorState';

export function LocalDirectorCommands({ spec, canWrite, dispatch }: {
  spec: ProductionSpec; canWrite: boolean; dispatch: (action: DirectorAction) => void;
}) {
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState('');
  const plan = useMemo(() => planDirectorCommand(spec, command), [spec, command]);
  return <section className="director-review-card" aria-label="Local Director commands">
    <h2>Local Director · Dirección local</h2>
    <p>Edit with explicit ES/EN commands, without an AI API charge. Preview each change, then save using the existing draft flow.</p>
    <p>Reuse your existing references in Subject / Entity, Environment and Motion Designer before creating new media. Local editing does not generate cinematic footage.</p>
    <label className="director-field"><span>Command / Orden</span><textarea rows={2} maxLength={4000} value={command} disabled={!canWrite} onChange={event => { setCommand(event.target.value); setNotice(''); }} placeholder="Escena: Presentación de ATLAS | 5" /></label>
    <details><summary>Supported commands / Órdenes disponibles</summary><ul>
      <li>Título: Mi video / Title: My video</li><li>Idea: Describe tu objetivo / Brief: Your goal</li>
      <li>Formato: vertical / Format: horizontal / Format: square</li>
      <li>Narración: Tu texto / Narration: Your text</li>
      <li>Escena: Descripción | 5 / Scene: Description | 5 (seconds)</li><li>Modo: local / Mode: local</li>
    </ul></details>
    {command.trim() && <p role="status">{plan.summary}</p>}
    <button type="button" className="director-action" disabled={!canWrite || !plan.actions.length} onClick={() => {
      if (!canWrite) return;
      plan.actions.forEach(action => dispatch(action)); setCommand(''); setNotice('Applied to draft / Aplicado al borrador. Save before rendering.');
    }}>Apply to draft / Aplicar al borrador</button>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
