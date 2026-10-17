import { Link } from 'react-router-dom';
import { venezuela } from './venezuela';

export function VenezuelaPage() {
  return (
    <main className="page-stack" lang="es-VE">
      <header className="page-header">
        <p className="eyebrow">ATLAS Global · Venezuela · Piloto</p>
        <h1>Bienvenido a ATLAS Venezuela</h1>
        <p>Una plataforma para personas, emprendedores y empresas venezolanas.</p>
      </header>
      <p className="notice">Esta versión es un piloto. Las funciones fiscales y laborales requieren validación normativa y habilitación expresa antes de procesar operaciones reales.</p>
      <dl><dt>País</dt><dd>{venezuela.name}</dd><dt>Moneda base</dt><dd>{venezuela.currency}</dd><dt>Idioma</dt><dd>{venezuela.locale}</dd></dl>
      <div className="module-grid">
        {venezuela.modules.map((module) => module.gated ? (
          <div className="module-card disabled" aria-disabled="true" key={module.title}>
            <span>Pendiente de validación</span><strong>{module.title}</strong><p>{module.description}</p>
          </div>
        ) : (
          <Link className="module-card enabled" key={module.title} to={module.path}>
            <span>ATLAS Venezuela</span><strong>{module.title}</strong><p>{module.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
