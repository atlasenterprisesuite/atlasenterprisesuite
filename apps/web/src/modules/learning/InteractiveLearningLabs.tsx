import { useState } from 'react';

const food = [
  { name: 'Pasta', amount: 100, unit: 'g' },
  { name: 'Fresh spinach', amount: 40, unit: 'g' },
  { name: 'Parmesan', amount: 20, unit: 'g' },
  { name: 'Olive oil', amount: 1, unit: 'tbsp' },
  { name: 'Lemon', amount: 0.5, unit: '' },
  { name: 'Garlic cloves', amount: 1, unit: '' }
] as const;

const starStages = [
  { name: 'Stellar nebula', detail: 'Gravity draws dense regions of gas and dust together.' },
  { name: 'Protostar', detail: 'The forming star heats under gravitational compression.' },
  { name: 'Main sequence', detail: 'Stable hydrogen fusion powers a Sun-like star for billions of years.' },
  { name: 'Red giant', detail: 'After core hydrogen is exhausted, the star expands.' },
  { name: 'White dwarf', detail: 'Its outer layers are shed and a hot, dense remnant cools over time.' }
] as const;

const libraries = [
  { name: 'Trinity College Library', location: 'Dublin, Ireland', fact: 'Its historic Long Room is known for towering wooden bookcases.', link: 'https://www.tcd.ie/library/' },
  { name: 'Biblioteca Joanina', location: 'Coimbra, Portugal', fact: 'A richly decorated eighteenth-century Baroque library.', link: 'https://visit.uc.pt/' },
  { name: 'Admont Abbey Library', location: 'Admont, Austria', fact: 'Its white-and-gold hall includes monumental ceiling frescoes.', link: 'https://www.stiftadmont.at/' },
  { name: 'New York Public Library', location: 'New York, USA', fact: 'The Rose Main Reading Room is famous for its painted ceiling.', link: 'https://www.nypl.org/' },
  { name: 'Stuttgart City Library', location: 'Stuttgart, Germany', fact: 'The modern interior features a striking geometric atrium.', link: 'https://www.stuttgart.de/stadtbibliothek/' },
  { name: 'Royal Portuguese Reading Room', location: 'Rio de Janeiro, Brazil', fact: 'Its elaborate Neo-Manueline architecture surrounds a grand reading hall.', link: 'https://www.realgabinete.com.br/' }
] as const;

const tile: React.CSSProperties = { border: '1px solid var(--border, #a4a4a4)', borderRadius: 16, padding: 20, display: 'grid', gap: 14, minWidth: 0 };
const button: React.CSSProperties = { padding: '9px 14px', borderRadius: 9, border: '1px solid currentColor', background: 'transparent', color: 'inherit', cursor: 'pointer' };

export function InteractiveLearningLabs() {
  const [servings, setServings] = useState<2 | 4>(2);
  const [ready, setReady] = useState<string[]>([]);
  const [stage, setStage] = useState(0);
  const [position, setPosition] = useState(68);
  const [pass, setPass] = useState(true);
  const [library, setLibrary] = useState(0);
  const offsidePosition = position > 75;
  const currentLibrary = libraries[library];

  return (
    <section aria-labelledby="interactive-labs-title" style={{ padding: '24px clamp(12px, 3vw, 36px)' }}>
      <h2 id="interactive-labs-title">Interactive Learning Labs</h2>
      <p>Explore four self-contained learning experiences. All controls work with touch, keyboard and assistive technology. No personal data is sent or saved by these demos.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: 20 }}>
        <section aria-labelledby="recipe-title" style={tile}>
          <h3 id="recipe-title">1. Lemon & spinach pasta</h3>
          <label htmlFor="recipe-servings">Servings</label>
          <select id="recipe-servings" value={servings} onChange={e => setServings(Number(e.target.value) as 2 | 4)} style={{ padding: 10, borderRadius: 8 }}>
            <option value="2">2 people</option><option value="4">4 people</option>
          </select>
          <p>Check ingredients as you prepare them:</p>
          {food.map(item => (
            <label key={item.name} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input type="checkbox" checked={ready.includes(item.name)} onChange={e => setReady(existing => e.target.checked ? [...existing, item.name] : existing.filter(name => name !== item.name))} />
              <span>{item.name} — {item.amount * servings / 2} {item.unit}</span>
            </label>
          ))}
          <p role="status">{ready.length} of {food.length} ingredients ready</p>
          <button type="button" style={button} onClick={() => setReady([])}>Reset ingredients</button>
          <p>Boil pasta until al dente. Sauté garlic in olive oil, add spinach, then toss with pasta, lemon, cooking water and Parmesan.</p>
        </section>

        <section aria-labelledby="stars-title" style={tile}>
          <h3 id="stars-title">2. Life of a Sun-like star</h3>
          <svg role="img" aria-label={`Diagram representing ${starStages[stage].name}`} viewBox="0 0 320 165" style={{ maxWidth: '100%', borderRadius: 12, background: '#111b35' }}>
            <circle cx="160" cy="82" r={[35,24,29,61,12][stage]} fill={['#9675c9','#e9a353','#ffca69','#ed704b','#d4edff'][stage]} />
            <text x="160" y="153" textAnchor="middle" fill="white" fontSize="13">{starStages[stage].name}</text>
          </svg>
          <p aria-live="polite"><strong>Stage {stage + 1} of 5:</strong> {starStages[stage].detail}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={button} disabled={stage === 0} onClick={() => setStage(s => s - 1)}>Previous</button>
            <button type="button" style={button} disabled={stage === starStages.length - 1} onClick={() => setStage(s => s + 1)}>Next</button>
          </div>
          <small>Massive stars follow different evolutionary paths. Diagram is illustrative, not to scale.</small>
        </section>

        <section aria-labelledby="offside-title" style={tile}>
          <h3 id="offside-title">3. Soccer offside simulator</h3>
          <svg role="img" aria-label={`Soccer pitch with a second-last defender at 75 percent and an attacker at ${position} percent`} viewBox="0 0 320 170" style={{ maxWidth: '100%', borderRadius: 12, background: '#24764f' }}>
            <rect x="10" y="10" width="300" height="150" fill="none" stroke="white" strokeWidth="2" />
            <path d="M160 10V160 M310 45H260V125H310" stroke="white" fill="none" />
            <path d="M235 10V160" stroke="#ffdf68" strokeWidth="2" strokeDasharray="5 4" />
            <circle cx="235" cy="54" r="9" fill="#f2f6fc" />
            <circle cx="278" cy="123" r="9" fill="#f2f6fc" />
            <circle cx="118" cy="112" r="9" fill="#fa7777" />
            <circle cx={10 + position * 3} cy="88" r="9" fill="#fa7777" />
            <circle cx="118" cy="96" r="4" fill="white" />
            <text x="223" y="27" fill="white" fontSize="10" textAnchor="end">Offside line</text>
          </svg>
          <label htmlFor="offside-position">Attacker position: {position}%</label>
          <input id="offside-position" type="range" min="25" max="95" value={position} onChange={e => setPosition(Number(e.target.value))} />
          <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={pass} onChange={e => setPass(e.target.checked)} /> Teammate passes toward the attacker</label>
          <p role="status"><strong>{pass && offsidePosition ? 'Potential offside offense' : 'No offside offense in this scenario'}</strong></p>
          <small>This simplified scenario assumes the pass occurs at this instant, the attacker participates in play, the ball is behind the second-last defender, and normal open play. Position alone is not an offense.</small>
        </section>

        <section aria-labelledby="libraries-title" style={tile}>
          <h3 id="libraries-title">4. Extraordinary libraries</h3>
          <div aria-live="polite">
            <p><strong>{currentLibrary.name}</strong></p>
            <p>{currentLibrary.location}</p>
            <p>{currentLibrary.fact}</p>
            <a href={currentLibrary.link} target="_blank" rel="noopener noreferrer">Explore official information about this library</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" style={button} disabled={library === 0} onClick={() => setLibrary(i => i - 1)}>Previous</button>
            <span aria-label={`Library ${library + 1} of ${libraries.length}`}>{library + 1} / {libraries.length}</span>
            <button type="button" style={button} disabled={library === libraries.length - 1} onClick={() => setLibrary(i => i + 1)}>Next</button>
          </div>
          <small>Text-based collection. Licensed photographs and attribution will be added after source verification.</small>
        </section>
      </div>
    </section>
  );
}
