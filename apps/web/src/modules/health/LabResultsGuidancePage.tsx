import { useMemo, useState } from 'react';

type ProteinLevel = 'negative' | 'trace' | '1+' | '2+' | '3+' | '4+';

const guidance: Record<ProteinLevel, { level: string; summary: string; next: string }> = {
  negative: { level: 'Within dipstick range', summary: 'No protein was detected on this urine dipstick.', next: 'Interpret with the rest of the urinalysis and clinical context.' },
  trace: { level: 'Low-level finding', summary: 'A trace result can be transient and does not establish kidney disease.', next: 'If clinically appropriate, repeat testing and quantify albumin with a urine albumin-to-creatinine ratio (UACR).' },
  '1+': { level: 'Abnormal screening finding', summary: 'Protein 1+ is a semiquantitative dipstick finding. It can be temporary or persistent and, by itself, does not diagnose kidney disease.', next: 'Confirm persistence and quantify albumin with UACR. Review serum creatinine/eGFR, blood pressure, diabetes status, hydration, infection symptoms and medications with a clinician.' },
  '2+': { level: 'Elevated screening finding', summary: 'Protein is clearly detected on dipstick and needs clinical correlation and quantitative confirmation.', next: 'Arrange clinical review and quantify with UACR or another clinician-selected urine protein measurement; assess kidney function and contributing conditions.' },
  '3+': { level: 'Marked screening finding', summary: 'A high dipstick protein result warrants prompt clinical assessment, especially when new or accompanied by symptoms.', next: 'Seek timely clinical review for quantitative urine testing, kidney function testing and evaluation of possible causes.' },
  '4+': { level: 'Marked screening finding', summary: 'A very high dipstick protein result warrants prompt clinical assessment.', next: 'Seek timely clinical review for quantitative urine testing, kidney function testing and evaluation of possible causes.' }
};

export function LabResultsGuidancePage() {
  const [age, setAge] = useState(75);
  const [protein, setProtein] = useState<ProteinLevel>('1+');
  const result = useMemo(() => guidance[protein], [protein]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 20px', color: 'inherit' }}>
      <p style={{ letterSpacing: '.12em', textTransform: 'uppercase', opacity: .7 }}>ATLAS Health · Labs</p>
      <h1>Urinalysis guidance</h1>
      <p>Educational decision support for interpreting a urine protein dipstick result. It does not diagnose a condition or replace clinical evaluation.</p>
      <section aria-label="Lab inputs" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', margin: '28px 0' }}>
        <label>Age<input aria-label="Age" type="number" min={18} max={120} value={age} onChange={e => setAge(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 8, padding: 10 }} /></label>
        <label>Urine protein<select aria-label="Urine protein" value={protein} onChange={e => setProtein(e.target.value as ProteinLevel)} style={{ display: 'block', width: '100%', marginTop: 8, padding: 10 }}>{(['negative','trace','1+','2+','3+','4+'] as ProteinLevel[]).map(value => <option key={value}>{value}</option>)}</select></label>
      </section>
      <section aria-live="polite" style={{ border: '1px solid currentColor', borderRadius: 16, padding: 22 }}>
        <p><strong>{result.level}</strong></p>
        <h2>Protein {protein}{age >= 65 ? ' · older adult (' + age + ')' : ''}</h2>
        <p>{result.summary}</p>
        <h3>Suggested follow-up</h3><p>{result.next}</p>
        {age >= 65 && <p>For an older adult, interpretation should account for kidney function, blood pressure, diabetes, medications, hydration and urinary symptoms rather than age alone.</p>}
      </section>
      <section style={{ marginTop: 24 }}><h2>Escalation</h2><p>Prompt medical assessment is appropriate when protein in the urine occurs with visible blood, substantially reduced urine output, new major swelling, shortness of breath, confusion, severe weakness, fever with urinary symptoms, or other acute deterioration.</p></section>
    </main>
  );
}
