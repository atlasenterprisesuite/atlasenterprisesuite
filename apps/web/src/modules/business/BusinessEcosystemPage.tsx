import { Link } from 'react-router-dom';
import './business-ecosystem.css';

type BusinessTool = {
  label: string;
  to: string;
};

type BusinessModuleCard = {
  name: string;
  description: string;
  glyph: string;
  tone: 'cyan' | 'gold' | 'violet' | 'green' | 'orange' | 'rose' | 'teal' | 'blue';
  to?: string;
  featured?: boolean;
  tools: BusinessTool[];
};

type BusinessModuleGroup = {
  index: string;
  title: string;
  strapline: string;
  modules: BusinessModuleCard[];
};

const groups: BusinessModuleGroup[] = [
  {
    index: '01',
    title: 'Núcleo Ejecutivo',
    strapline: 'Dirección · ejecución · conocimiento · todo conectado',
    modules: [
      {
        name: 'Assistant',
        description: 'Cerebro operativo para ejecutar, orientar y conectar todo el ecosistema.',
        glyph: 'AI',
        tone: 'cyan',
        to: '/assistant',
        tools: [
          { label: 'Chat', to: '/assistant' },
          { label: 'Acciones', to: '/work' },
          { label: 'Automatización', to: '/automations' }
        ]
      },
      {
        name: 'Work Command Center',
        description: 'Centro de ejecución, seguimiento de tareas, aprobaciones y evidencias.',
        glyph: 'WK',
        tone: 'gold',
        to: '/work',
        tools: [
          { label: 'Tareas', to: '/work/active' },
          { label: 'Aprobaciones', to: '/work/approvals' },
          { label: 'Historial', to: '/work/history' }
        ]
      },
      {
        name: 'Knowledge',
        description: 'Base de conocimiento, documentación, memoria operativa y consulta inteligente.',
        glyph: 'KN',
        tone: 'violet',
        to: '/knowledge',
        tools: [
          { label: 'Biblioteca', to: '/knowledge' },
          { label: 'Búsqueda', to: '/suite' },
          { label: 'Aprendizaje', to: '/learning' }
        ]
      }
    ]
  },
  {
    index: '02',
    title: 'Operación Empresarial',
    strapline: 'Del plan a la ejecución · toda la operación en un solo ecosistema',
    modules: [
      {
        name: 'Business',
        description: 'Vista integral del negocio: clientes, ventas, proveedores, proyectos y operación.',
        glyph: 'BI',
        tone: 'gold',
        featured: true,
        tools: [
          { label: 'Command Center', to: '/revenue' },
          { label: 'Clientes', to: '/crm' },
          { label: 'Operaciones', to: '/work' }
        ]
      },
      {
        name: 'Finance / Accounting',
        description: 'Control financiero, contabilidad, AP, AR, conciliaciones y reportes.',
        glyph: 'FN',
        tone: 'green',
        to: '/finance',
        tools: [
          { label: 'GL', to: '/finance/accounting' },
          { label: 'AP/AR', to: '/finance/accounting/accounts-receivable' },
          { label: 'Reportes', to: '/finance/accounting/reports/automotive-sales' }
        ]
      },
      {
        name: 'Payroll / HR',
        description: 'Gestión de personal, nómina, beneficios y ciclos de trabajo.',
        glyph: 'HR',
        tone: 'violet',
        to: '/people',
        tools: [
          { label: 'Empleados', to: '/people' },
          { label: 'Nómina', to: '/payroll' },
          { label: 'Timecards', to: '/people' }
        ]
      },
      {
        name: 'Inventory / Purchasing',
        description: 'Compras, recepción, inventario, costos y abastecimiento.',
        glyph: 'IV',
        tone: 'orange',
        to: '/inventory/procure-to-pay',
        tools: [
          { label: 'PO', to: '/inventory/procure-to-pay' },
          { label: 'Recepción', to: '/inventory/procure-to-pay' },
          { label: 'Stock', to: '/inventory/procure-to-pay' }
        ]
      },
      {
        name: 'CRM / Sales',
        description: 'Relación con clientes, oportunidades, pipeline y seguimiento comercial.',
        glyph: 'CR',
        tone: 'rose',
        to: '/crm',
        tools: [
          { label: 'Contactos', to: '/crm/contacts' },
          { label: 'Deals', to: '/crm/deals' },
          { label: 'Actividades', to: '/crm/activities' }
        ]
      },
      {
        name: 'Advisory',
        description: 'Servicios de asesoría, Business Launch 360 y acompañamiento estratégico.',
        glyph: 'AD',
        tone: 'teal',
        to: '/advisory',
        tools: [
          { label: 'Engagements', to: '/advisory/engagements' },
          { label: 'Readiness', to: '/advisory/readiness' },
          { label: 'Launch 360', to: '/advisory/business-launch-360/workspace' }
        ]
      }
    ]
  },
  {
    index: '03',
    title: 'Inteligencia y Crecimiento',
    strapline: 'Datos · creatividad · tecnología · crecimiento sostenible',
    modules: [
      {
        name: 'Business Analytics',
        description: 'Indicadores, métricas, visualización, análisis y decisiones basadas en datos.',
        glyph: 'AN',
        tone: 'cyan',
        to: '/business/insights',
        tools: [
          { label: 'KPIs', to: '/business/insights' },
          { label: 'Dashboards', to: '/business/insights' },
          { label: 'Forecast', to: '/business/insights' }
        ]
      },
      {
        name: 'Creator Studio / Social',
        description: 'Contenido, campañas, publicaciones y creatividad para crecimiento.',
        glyph: 'ST',
        tone: 'rose',
        to: '/studio',
        tools: [
          { label: 'Publisher', to: '/business/growth/social-publisher' },
          { label: 'Assets', to: '/studio' },
          { label: 'Campañas', to: '/studio/social' }
        ]
      },
      {
        name: 'Cloud',
        description: 'Infraestructura, servicios, despliegues, observabilidad y administración técnica.',
        glyph: 'CL',
        tone: 'blue',
        to: '/cloud',
        tools: [
          { label: 'Deploy', to: '/release' },
          { label: 'Servicios', to: '/cloud' },
          { label: 'Observabilidad', to: '/cloud' }
        ]
      }
    ]
  }
];

const operatingModel = [
  { glyph: '◉', title: 'Ver', copy: 'Dashboards y estado', tone: 'cyan' },
  { glyph: '⚙', title: 'Operar', copy: 'Flujos, tareas y acciones', tone: 'violet' },
  { glyph: '◇', title: 'Controlar', copy: 'Permisos, auditoría y evidencia', tone: 'gold' },
  { glyph: '↗', title: 'Escalar', copy: 'Automatización, datos e IA', tone: 'green' }
] as const;

const idealRoute = [
  { label: 'Assistant', to: '/assistant' },
  { label: 'Work', to: '/work' },
  { label: 'Business', to: '/business' },
  { label: 'Finance', to: '/finance' },
  { label: 'Analytics', to: '/business/insights' }
];

function ModuleCard({ module }: { module: BusinessModuleCard }) {
  return (
    <article className={`business-map-card tone-${module.tone}${module.featured ? ' featured' : ''}`}>
      <div className="business-map-card-head">
        <span className="business-map-glyph" aria-hidden="true">{module.glyph}</span>
        <div>
          {module.to ? <Link className="business-map-title" to={module.to}>{module.name}</Link> : <strong className="business-map-title">{module.name}</strong>}
          <p>{module.description}</p>
        </div>
      </div>
      <div className="business-map-tools" aria-label={`${module.name} tools`}>
        <span>Herramientas útiles:</span>
        <div>
          {module.tools.map((tool) => <Link key={`${module.name}-${tool.label}`} to={tool.to}>{tool.label}</Link>)}
        </div>
      </div>
    </article>
  );
}

export function BusinessEcosystemPage() {
  return (
    <section className="business-map-page">
      <header className="business-map-hero">
        <div className="business-map-brand">
          <span className="business-map-atlas">ATLAS</span>
          <span className="business-map-divider" aria-hidden="true" />
          <div>
            <p className="eyebrow">07 · Business</p>
            <h1>Ecosistema de Módulos</h1>
            <p>Una vista funcional para entender qué hace cada módulo y entrar directamente a sus herramientas reales.</p>
          </div>
        </div>
        <div className="business-map-orbit" aria-hidden="true">
          <span className="business-map-planet" />
          <span className="business-map-orbit-line orbit-a" />
          <span className="business-map-orbit-line orbit-b" />
          <span className="business-map-orbit-node node-a" />
          <span className="business-map-orbit-node node-b" />
        </div>
      </header>

      <div className="business-map-groups">
        {groups.map((group) => (
          <section className="business-map-group" key={group.index}>
            <header>
              <div><span>{group.index}</span><h2>{group.title}</h2></div>
              <p>{group.strapline}</p>
            </header>
            <div className={`business-map-grid business-map-grid-${group.index}`}>
              {group.modules.map((module) => <ModuleCard key={module.name} module={module} />)}
            </div>
          </section>
        ))}
      </div>

      <section className="business-map-footer-grid" aria-label="ATLAS operating model">
        <article className="business-map-reading">
          <header>
            <span aria-hidden="true">✧</span>
            <div><h2>Cómo leer ATLAS</h2><p>De la visión al impacto</p></div>
          </header>
          <div className="business-map-reading-grid">
            {operatingModel.map((item, index) => (
              <div className={`business-map-reading-card tone-${item.tone}`} key={item.title}>
                <span aria-hidden="true">{item.glyph}</span>
                <div><strong>{item.title}</strong><small>{item.copy}</small></div>
                <em>{String(index + 1).padStart(2, '0')}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="business-map-route">
          <header><span aria-hidden="true">◎</span><h2>Ruta ideal de uso</h2></header>
          <nav aria-label="Ruta ideal de uso de ATLAS">
            {idealRoute.map((item, index) => (
              <span className="business-map-route-step" key={item.label}>
                <Link to={item.to}>{item.label}</Link>
                {index < idealRoute.length - 1 ? <i aria-hidden="true">→</i> : null}
              </span>
            ))}
          </nav>
          <p>ATLAS conecta la operación completa sin duplicar fuentes de verdad.</p>
        </article>
      </section>

      <div className="business-map-truth" role="note">
        Las tarjetas describen capacidades y rutas implementadas. Estados externos, datos financieros, proveedores y conexiones solo se consideran activos cuando existe evidencia autenticada.
      </div>
    </section>
  );
}
