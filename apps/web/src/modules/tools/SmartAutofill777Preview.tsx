import { useMemo, useState } from 'react';
import { proposeAutofill, type AutofillCategory, type AutofillProfile } from './smartAutofill777';

const demoFields = [
  { id: 'demo-name', label: 'Nombre completo', type: 'text' },
  { id: 'demo-email', label: 'Correo electrónico', type: 'email' },
  { id: 'demo-company', label: 'Empresa', type: 'text' }
] as const;
const profileFields: { category: AutofillCategory; label: string; type: string }[] = [
  { category: 'name', label: 'Nombre para la demostración', type: 'text' },
  { category: 'email', label: 'Correo para la demostración', type: 'email' },
  { category: 'company', label: 'Empresa para la demostración', type: 'text' }
];
export function SmartAutofill777Preview() {
  const [profile, setProfile] = useState<AutofillProfile>({});
  const [approved, setApproved] = useState<string[]>([]);
  const [filled, setFilled] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const proposals = useMemo(() => proposeAutofill(demoFields, profile), [profile]);
  const update = (category: AutofillCategory, value: string) => {
    setProfile(old => ({ ...old, [category]: value }));
    setApproved([]);
    setFilled({});
    setMessage('Cambios detectados. Revisa y autoriza nuevamente los campos.');
  };
  const fill = () => {
    const selected = proposals.filter(p => approved.includes(p.fieldId));
    if (!selected.length) { setMessage('Selecciona al menos un campo para autorizarlo.'); return; }
    setFilled(Object.fromEntries(selected.map(p => [p.fieldId, p.value])));
    setMessage(`Se rellenaron ${selected.length} campos en el formulario de demostración. No se envió información.`);
  };
  return <section aria-labelledby="atlas-autofill-title" style={{ border: '1px solid currentColor', borderRadius: 12, padding: 16 }}>
    <h2 id="atlas-autofill-title">Smart Autofill 777 — demostración local</h2>
    <p>Introduce únicamente datos ficticios. Esta demostración no guarda perfiles, no visita páginas externas y nunca envía formularios.</p>
    <fieldset><legend>Perfil temporal (solo en memoria)</legend>
      {profileFields.map(field => <div key={field.category}>
        <label htmlFor={`atlas-profile-${field.category}`}>{field.label}</label>
        <input id={`atlas-profile-${field.category}`} type={field.type} autoComplete="off" value={profile[field.category] || ''} onChange={e => update(field.category, e.target.value)} />
      </div>)}
    </fieldset>
    <fieldset><legend>Revisar y autorizar cada propuesta</legend>
      {proposals.length === 0 ? <p>No hay propuestas disponibles. Completa los datos ficticios del perfil.</p> : proposals.map(p => <div key={p.fieldId}>
        <label><input type="checkbox" checked={approved.includes(p.fieldId)} onChange={e => setApproved(old => e.target.checked ? [...old, p.fieldId] : old.filter(id => id !== p.fieldId))} /> Autorizar {demoFields.find(f => f.id === p.fieldId)?.label}: {p.value}</label>
      </div>)}
    </fieldset>
    <button type="button" onClick={fill} disabled={!proposals.length || !approved.length}>Rellenar formulario de demostración</button>
    <button type="button" onClick={() => { setProfile({}); setApproved([]); setFilled({}); setMessage('Datos temporales eliminados.'); }}>Limpiar demostración</button>
    <fieldset><legend>Formulario de demostración (sin envío)</legend>
      {demoFields.map(field => <div key={field.id}>
        <label htmlFor={field.id}>{field.label}</label>
        <input id={field.id} type={field.type} readOnly value={filled[field.id] || ''} />
      </div>)}
    </fieldset>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
