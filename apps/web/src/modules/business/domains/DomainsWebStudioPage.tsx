import { useState } from 'react';
import { Link } from 'react-router-dom';

export function DomainsWebStudioPage() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState('');
  const validDomain = (value: string) => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
  return <main className="page-stack" data-testid="domains-web-studio">
    <header className="page-header">
      <p className="eyebrow">ATLAS · Business Suite · Pilot</p>
      <h1>Domains & Web Studio</h1>
      <p>Un espacio para preparar dominios, correo empresarial y sitios web. Este piloto no registra dominios, cobra ni modifica DNS.</p>
    </header>
    <div className="module-grid">
      <article className="module-card enabled"><span>01 · Identidad digital</span><strong>Dominios</strong><p>Prepara el nombre de tu empresa antes de consultar disponibilidad y precios con un registrador.</p></article>
      <article className="module-card enabled"><span>02 · Comunicación</span><strong>Correo profesional</strong><p>Diseña las direcciones de tu equipo. La creación de buzones requiere un proveedor autorizado.</p></article>
      <article className="module-card enabled"><span>03 · Presencia digital</span><strong>Web Studio</strong><p>Planifica tu página. La generación con IA y la publicación aún no están habilitadas.</p></article>
    </div>
    <section className="feature-card wide" aria-labelledby="pilot-domain-heading">
      <h2 id="pilot-domain-heading">Validar formato de dominio</h2>
      <form onSubmit={(event) => { event.preventDefault(); const candidate = domain.trim().toLowerCase(); setResult(validDomain(candidate) ? `Formato válido: ${candidate}. Disponibilidad no comprobada.` : 'Formato inválido. Ejemplo: miempresa.com'); }}>
        <label className="field" htmlFor="pilot-domain"><span>Dominio deseado</span><input id="pilot-domain" type="text" required autoComplete="off" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="miempresa.com" aria-describedby="pilot-domain-help" /></label>
        <p id="pilot-domain-help">Validación local del formato, sin consultas externas ni compras.</p>
        <button type="submit">Validar formato</button>
        <p role="status" aria-live="polite">{result}</p>
      </form>
    </section>
    <div className="notice">Piloto aislado. No se han activado registros, pagos, correo ni hosting.</div>
    <Link className="text-link" to="/business">Volver a Business Suite</Link>
  </main>;
}
