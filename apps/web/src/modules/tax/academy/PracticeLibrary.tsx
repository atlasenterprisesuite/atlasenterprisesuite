import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACADEMY_2026_CASES } from '../../../../../../packages/tax-academy/src';

export function PracticeLibrary() {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [filingStatus, setFilingStatus] = useState('all');

  const cases = useMemo(() => ACADEMY_2026_CASES.filter((item) => {
    const haystack = `${item.id} ${item.title} ${item.filingStatus} ${item.level}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (level === 'all' || item.level === level)
      && (filingStatus === 'all' || item.filingStatus === filingStatus);
  }), [query, level, filingStatus]);

  return (
    <div className="academy-page">
      <section className="academy-section-head">
        <div><p className="eyebrow">Practice &amp; Exams</p><h1>Practice Library</h1><p>Complete 2026 synthetic returns. Select by professional level and filing status.</p></div>
        <span className="academy-pill">{cases.length} templates</span>
      </section>

      <section className="academy-filters">
        <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Schedule C, Marketplace, HOH…" /></label>
        <label><span>Level</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All levels</option>{['A1','A2','A3','A4','A5','A6'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Filing status</span><select value={filingStatus} onChange={(event) => setFilingStatus(event.target.value)}><option value="all">All statuses</option>{['single','mfj','mfs','hoh','qss'].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
      </section>

      <section className="academy-case-grid">
        {cases.map((item) => (
          <article className="academy-case-card" key={item.id}>
            <header><span>{item.id}</span><span>{item.level}</span></header>
            <h2>{item.title}</h2>
            <p>{item.filingStatus.toUpperCase()} · {item.practiceVariants} generated variants · tax year {item.taxYear}</p>
            <div className="academy-chip-row">{item.requiredForms.slice(0, 4).map((form) => <span key={form.formId}>{form.formId}</span>)}</div>
            <Link to={`/tax/academy/practice/${item.id}`}>Open practical return</Link>
          </article>
        ))}
      </section>
    </div>
  );
}
