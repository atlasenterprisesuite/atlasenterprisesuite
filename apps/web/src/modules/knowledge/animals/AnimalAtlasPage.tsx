import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  animalGroupOptions,
  animalRoleOptions,
  filterAnimalTaxa,
  type AnimalTaxon
} from '../../../../../../packages/knowledge/animal-atlas';
import {
  getAnimalAtlasRecords,
  type AnimalAtlasDataset
} from './animalAtlasData';
import './animal-atlas.css';

const emptyDataset: AnimalAtlasDataset = {
  source: 'repository_curated',
  records: [],
  loadedAt: ''
};

function sourceLabel(source: AnimalAtlasDataset['source']) {
  return source === 'supabase_live' ? 'Supabase live evidence' : 'Repository-curated evidence';
}

function evidenceLabel(record: AnimalTaxon) {
  if (record.evidenceState === 'verified_source') return 'Verified source';
  if (record.evidenceState === 'curated_reference') return 'Curated reference';
  return 'Needs review';
}

function useAnimalAtlasDataset() {
  const [dataset, setDataset] = useState<AnimalAtlasDataset>(emptyDataset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAnimalAtlasRecords()
      .then((next) => {
        if (!active) return;
        setDataset(next);
        setError('');
      })
      .catch(() => {
        if (!active) return;
        setError('Animal knowledge could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return { dataset, loading, error };
}

function AnimalHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="page-header animal-page-header">
      <p className="eyebrow">ATLAS Knowledge Atlas · Life & Nature</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

export function AnimalAtlasPage() {
  const { dataset, loading, error } = useAnimalAtlasDataset();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [role, setRole] = useState('');

  const groups = useMemo(() => animalGroupOptions(dataset.records), [dataset.records]);
  const roles = useMemo(() => animalRoleOptions(dataset.records), [dataset.records]);
  const filtered = useMemo(
    () => filterAnimalTaxa(dataset.records, { search, group, role }),
    [dataset.records, search, group, role]
  );

  return (
    <section className="page-stack animal-atlas-shell">
      <AnimalHeader
        title="Animal Kingdom"
        description="Explore evidence-backed animal taxonomy, ecology and human relationships without confusing ecological function with an unproven scientific claim about why a species was created."
      />

      <div className="animal-truth-boundary" role="note">
        <strong>Scientific truth boundary</strong>
        <span>Ecological roles describe observed or evidence-supported relationships. Religious or philosophical purpose is kept separate and explicitly labeled when present.</span>
      </div>

      {loading ? <div className="animal-state" role="status">Loading governed animal knowledge…</div> : null}
      {error ? <div className="animal-state error" role="alert">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="animal-source-state">
            <span className={`animal-source-dot ${dataset.source === 'supabase_live' ? 'live' : ''}`} aria-hidden="true" />
            <strong>{sourceLabel(dataset.source)}</strong>
            <span>· {dataset.records.length} {dataset.records.length === 1 ? 'record' : 'records'} loaded</span>
          </div>

          <div className="animal-controls" aria-label="Animal catalog controls">
            <label className="animal-search-field">
              <span>Search</span>
              <input
                type="search"
                aria-label="Search animals"
                placeholder="Name, taxonomy or ecological role"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              <span>Animal group</span>
              <select aria-label="Animal group" value={group} onChange={(event) => setGroup(event.target.value)}>
                <option value="">All groups</option>
                {groups.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Ecological role</span>
              <select aria-label="Ecological role" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="">All roles</option>
                {roles.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <div className="animal-results-heading">
            <strong>{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</strong>
            {(search || group || role) ? (
              <button type="button" onClick={() => { setSearch(''); setGroup(''); setRole(''); }}>Clear filters</button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state animal-empty">
              <strong>No animals match these filters</strong>
              <span>Change the search, group or ecological role. ATLAS does not invent records to fill an empty result.</span>
            </div>
          ) : (
            <div className="animal-card-grid">
              {filtered.map((record) => (
                <Link key={record.id} className="animal-card" to={`/knowledge/animals/${record.slug}`}>
                  <div className="animal-card-topline">
                    <span>{record.group}</span>
                    <span className={`animal-evidence-chip ${record.evidenceState}`}>{evidenceLabel(record)}</span>
                  </div>
                  <h2>{record.commonNames[0] || record.scientificName}</h2>
                  <p className="animal-scientific-name">{record.scientificName}</p>
                  <p>{record.habitat}</p>
                  <div className="animal-role-list" aria-label={`${record.commonNames[0] || record.scientificName} ecological roles`}>
                    {record.ecologicalRoles.map((item) => <span key={item}>{item}</span>)}
                  </div>
                  <span className="animal-open-link">Open species record →</span>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function TaxonomyPanel({ record }: { record: AnimalTaxon }) {
  const ranks = [
    ['Kingdom', record.taxonomy.kingdom],
    ['Phylum', record.taxonomy.phylum],
    ['Class', record.taxonomy.class],
    ['Order', record.taxonomy.order],
    ['Family', record.taxonomy.family],
    ['Genus', record.taxonomy.genus],
    ['Species', record.taxonomy.species]
  ];

  return (
    <article className="animal-detail-card">
      <p className="eyebrow">Taxonomy</p>
      <dl className="animal-taxonomy-list">
        {ranks.map(([rank, value]) => <div key={rank}><dt>{rank}</dt><dd>{value}</dd></div>)}
      </dl>
    </article>
  );
}

export function AnimalDetailPage() {
  const { slug } = useParams();
  const { dataset, loading, error } = useAnimalAtlasDataset();
  const record = dataset.records.find((item) => item.slug === slug);

  if (loading) return <section className="page-stack"><div className="animal-state" role="status">Loading animal record…</div></section>;
  if (error) return <section className="page-stack"><div className="animal-state error" role="alert">{error}</div></section>;
  if (!record) return <Navigate to="/knowledge/animals" replace />;

  const commonName = record.commonNames[0] || record.scientificName;

  return (
    <section className="page-stack animal-atlas-shell">
      <nav className="animal-breadcrumbs" aria-label="Animal record breadcrumb">
        <Link to="/knowledge/animals">Animal Kingdom</Link><span aria-hidden="true">/</span><span>{commonName}</span>
      </nav>
      <AnimalHeader title={commonName} description={record.scientificName} />

      <div className="animal-source-state">
        <span className={`animal-source-dot ${dataset.source === 'supabase_live' ? 'live' : ''}`} aria-hidden="true" />
        <strong>{sourceLabel(dataset.source)}</strong>
        <span>· reviewed {record.reviewedAt}</span>
      </div>

      <div className="animal-detail-layout">
        <TaxonomyPanel record={record} />
        <article className="animal-detail-card animal-ecology-card">
          <div className="animal-card-topline">
            <p className="eyebrow">Ecology</p>
            <span className={`animal-evidence-chip ${record.evidenceState}`}>{evidenceLabel(record)}</span>
          </div>
          <section><h2>Habitat</h2><p>{record.habitat}</p></section>
          <section><h2>Diet</h2><p>{record.diet}</p></section>
          <section><h2>Reproduction</h2><p>{record.reproduction}</p></section>
          <section>
            <h2>Ecological roles</h2>
            <div className="animal-role-list">{record.ecologicalRoles.map((item) => <span key={item}>{item}</span>)}</div>
          </section>
        </article>
      </div>

      <div className="animal-detail-layout">
        <article className="animal-detail-card">
          <p className="eyebrow">Humans & conservation</p>
          <h2>Relationship with people</h2>
          <p>{record.humanRelationship}</p>
          {record.conservationStatus ? <p><strong>Conservation status:</strong> {record.conservationStatus}</p> : <p className="animal-muted">No conservation status is asserted in this record without a governed source.</p>}
          {record.medicalRelevance ? <p><strong>Medical relevance:</strong> {record.medicalRelevance}</p> : null}
          {record.risks.length > 0 ? <><h2>Risks / cautions</h2><ul>{record.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></> : null}
        </article>

        <article className="animal-detail-card">
          <p className="eyebrow">Truth boundary</p>
          <h2>Purpose vs. ecological function</h2>
          <p>Science can investigate this animal's evolution, behavior and ecological functions. It does not establish a theological reason that the animal was created.</p>
          {record.purposeInterpretation ? <div className="animal-interpretation"><strong>Religious / philosophical interpretation</strong><p>{record.purposeInterpretation}</p></div> : null}
          {record.mythCorrection ? <div className="animal-myth"><strong>Myth correction</strong><p>{record.mythCorrection}</p></div> : null}
        </article>
      </div>

      <section className="animal-evidence-region" aria-label="Evidence sources">
        <div className="animal-section-heading">
          <div><p className="eyebrow">Provenance</p><h2>Evidence sources</h2></div>
          <span>{record.sources.length} {record.sources.length === 1 ? 'source' : 'sources'}</span>
        </div>
        {record.sources.length === 0 ? (
          <div className="empty-state"><strong>No governed sources are attached</strong><span>This record should be treated as needing review.</span></div>
        ) : (
          <div className="animal-source-list">
            {record.sources.map((source) => (
              <article key={`${source.organization}-${source.url}`}>
                <div><strong>{source.title}</strong><span>{source.organization}</span><small>{source.claimScope}</small></div>
                <a href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.organization}: ${source.title}`}>Open source ↗</a>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
