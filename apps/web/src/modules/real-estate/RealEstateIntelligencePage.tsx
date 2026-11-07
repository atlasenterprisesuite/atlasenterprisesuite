import { type FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { evaluateRealEstateDeal, type RealEstateDealInput, type RealEstateEvaluation } from './underwriting';
import {
  REAL_ESTATE_CHECKLIST, summarizeRealEstateReview,
  type RealEstateReviewMap, type RealEstateReviewStatus
} from './dueDiligence';
import './real-estate.css';

type Field = {
  key: keyof RealEstateDealInput;
  label: string;
  help?: string;
  required?: boolean;
  step?: string;
};
const FIELDS: readonly Field[] = [
  { key: 'purchasePrice', label: 'Precio de compra ($)', required: true },
  { key: 'units', label: 'Número de unidades', required: true, step: '1' },
  { key: 'rentPerUnitMonthly', label: 'Alquiler mensual por unidad ($)', required: true },
  { key: 'otherIncomeMonthly', label: 'Otros ingresos mensuales ($)' },
  { key: 'vacancyPercent', label: 'Vacancia estimada (%)', required: true },
  { key: 'operatingExpensesMonthly', label: 'Otros gastos operativos mensuales ($)', required: true, help: 'Sin impuestos, seguro ni HOA; para evitar duplicaciones.' },
  { key: 'annualPropertyTaxes', label: 'Property tax anual ($)', help: 'Verificar contra registro oficial y proyección post-compra.' },
  { key: 'annualInsurance', label: 'Seguro anual ($)', help: 'Cotización específica del inmueble; añadir viento/inundación si corresponde.' },
  { key: 'monthlyAssociationFees', label: 'HOA / condominio mensual ($)' },
  { key: 'monthlyCapitalReserve', label: 'Reserva CAPEX mensual ($)', help: 'Se descuenta del flujo de caja, no del NOI.' },
  { key: 'downPaymentPercent', label: 'Pago inicial (%)', required: true },
  { key: 'interestRatePercent', label: 'Interés anual estimado (%)', required: true },
  { key: 'amortizationYears', label: 'Amortización (años)', required: true },
  { key: 'closingCosts', label: 'Costos de cierre ($)' },
  { key: 'lenderFees', label: 'Comisiones y puntos del crédito ($)' },
  { key: 'repairsBudget', label: 'Reparaciones y rehabilitación ($)' },
  { key: 'cashReserves', label: 'Reserva de efectivo inicial ($)' }
];

const INITIAL_VALUES: Record<keyof RealEstateDealInput, string> = {
  purchasePrice: '', units: '', rentPerUnitMonthly: '', otherIncomeMonthly: '',
  vacancyPercent: '5', operatingExpensesMonthly: '',
  annualPropertyTaxes: '', annualInsurance: '', monthlyAssociationFees: '',
  monthlyCapitalReserve: '', downPaymentPercent: '25',
  interestRatePercent: '6', amortizationYears: '30',
  closingCosts: '', repairsBudget: '', lenderFees: '', cashReserves: ''
};

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(value);
const ratio = (value: number | null, suffix = '%') =>
  value === null ? 'N/A' : `${value.toFixed(2)}${suffix}`;

function parseDealInput(values: Record<keyof RealEstateDealInput, string>): RealEstateDealInput {
  const parsed = {} as Record<keyof RealEstateDealInput, number>;
  for (const field of FIELDS) {
    const raw = values[field.key].trim();
    parsed[field.key] = raw.length ? Number(raw) : field.required ? Number.NaN : 0;
  }
  return parsed;
}

export function RealEstateIntelligencePage() {
  const [propertyLabel, setPropertyLabel] = useState('');
  const [values, setValues] = useState({ ...INITIAL_VALUES });
  const [evaluation, setEvaluation] = useState<RealEstateEvaluation | null>(null);
  const [reviews, setReviews] = useState<RealEstateReviewMap>({});
  const summary = useMemo(() => summarizeRealEstateReview(reviews), [reviews]);
  const stages = [...new Set(REAL_ESTATE_CHECKLIST.map((item) => item.stage))];

  const evaluate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEvaluation(evaluateRealEstateDeal(parseDealInput(values)));
  };

  const reset = () => {
    setValues({ ...INITIAL_VALUES });
    setPropertyLabel('');
    setEvaluation(null);
    setReviews({});
  };

  const resultReady = evaluation?.ok === true;
  const criticalRisk = resultReady && evaluation.risks.some((item) => item.level === 'critical');

  return (
    <section className="page-stack atlas-real-estate" aria-label="ATLAS Real Estate Intelligence">
      <header className="page-header">
        <p className="eyebrow">ATLAS Enterprise Suite · Real Estate Intelligence</p>
        <h1>Property Investment Intelligence</h1>
        <p>Analiza un inmueble, calcula el flujo de caja y revisa cada obligación antes de una compra. Los valores son escenarios ingresados por ti, no datos de mercado ni ofertas de préstamo.</p>
      </header>

      <div className="notice" role="status">
        <strong>Origen de datos: entrada manual.</strong> ATLAS Hospitality aún no tiene un catálogo de inmuebles verificados.
        <span> </span><Link className="text-link" to="/hospitality/properties">Consultar catálogo de propiedades</Link>.
        No se envía información financiera a prestamistas, brokers ni registros públicos.
        Esta versión no almacena expedientes en servidores.
      </div>

      <form className="feature-card wide atlas-re-form" onSubmit={evaluate} noValidate>
        <div className="atlas-re-heading">
          <div><p className="eyebrow">01 · Underwriting</p><h2>Evaluación financiera</h2></div>
          <span className="atlas-re-chip">Escenario · Sin propiedad conectada</span>
        </div>
        <label className="atlas-re-label">
          <span>Nombre o referencia de la propiedad (opcional)</span>
          <input type="text" maxLength={120} value={propertyLabel} onChange={(event) => setPropertyLabel(event.target.value)} placeholder="Ej.: inmueble por evaluar" />
        </label>
        <div className="atlas-re-form-grid">
          {FIELDS.map((field) => (
            <label className="atlas-re-label" key={field.key}>
              <span>{field.label}{field.required ? ' *' : ''}</span>
              <input
                type="number" inputMode="decimal" step={field.step || 'any'} min="0"
                required={field.required} value={values[field.key]}
                onChange={(event) => {
                  const newValue = event.target.value;
                  setValues((current) => ({ ...current, [field.key]: newValue }));
                  setEvaluation(null);
                }}
                aria-describedby={field.help ? `help-${field.key}` : undefined}
              />
              {field.help ? <small id={`help-${field.key}`}>{field.help}</small> : null}
            </label>
          ))}
        </div>
        <div className="atlas-re-actions">
          <button type="submit" className="atlas-re-primary">Calcular escenario</button>
          <button type="button" className="atlas-re-secondary" onClick={reset}>Restablecer</button>
        </div>
        <p className="atlas-re-subnote">El modelo no incluye apreciación futura, beneficios fiscales de renta, refinanciamiento, incentivos ni garantías de ocupación.</p>
      </form>

      {evaluation && !evaluation.ok ? (
        <div className="notice atlas-re-warning" role="alert">
          <strong>Faltan datos válidos:</strong>
          <ul>{evaluation.errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}

      {evaluation?.ok ? (
        <section className="feature-card wide" aria-label="Resultados de cálculo" aria-live="polite">
          <div className="atlas-re-heading">
            <div><p className="eyebrow">02 · Finanzas estimadas</p><h2>{propertyLabel.trim() || 'Análisis sin referencia de inmueble'}</h2></div>
            <span className="atlas-re-chip">No es aprobación de crédito</span>
          </div>
          <div className="atlas-re-metrics">
            {[
              ['Ingresos anuales potenciales', money(evaluation.values.grossPotentialAnnual)],
              ['Ingresos anuales efectivos', money(evaluation.values.effectiveGrossAnnual)],
              ['Gastos operativos anuales', money(evaluation.values.operatingExpensesAnnual)],
              ['NOI anual', money(evaluation.values.noiAnnual)],
              ['Cap rate', ratio(evaluation.values.capRatePercent)],
              ['Préstamo hipotético', money(evaluation.values.loanAmount)],
              ['Servicio anual de deuda', money(evaluation.values.annualDebtService)],
              ['DSCR', ratio(evaluation.values.dscr, 'x')],
              ['Flujo anual tras deuda y reserva CAPEX', money(evaluation.values.cashFlowAnnual)],
              ['Efectivo inicial estimado', money(evaluation.values.initialCashRequired)],
              ['Cash-on-cash', ratio(evaluation.values.cashOnCashPercent)],
              ['Ratio de gastos operativos', ratio(evaluation.values.expenseRatioPercent)]
            ].map(([label, value]) => (
              <div className="atlas-re-metric" key={label}>
                <span>{label}</span><strong>{value}</strong>
              </div>
            ))}
          </div>
          {evaluation.risks.length ? (
            <div className="atlas-re-warning" role="status">
              <h3>Alertas de evaluación</h3>
              <ul>{evaluation.risks.map((risk) => <li key={risk.id}><strong>{risk.level === 'critical' ? 'Bloqueante' : 'Revisar'}:</strong> {risk.message}</li>)}</ul>
            </div>
          ) : (
            <p>Sin alertas numéricas automáticas. Aun así, la documentación y las condiciones del crédito requieren verificación independiente.</p>
          )}
        </section>
      ) : null}

      <section className="feature-card wide" aria-label="Checklist de diligencia">
        <div className="atlas-re-heading">
          <div><p className="eyebrow">03 · Due diligence 777</p><h2>Inspecciones, taxes, trámites y cierre</h2></div>
          <span className="atlas-re-chip">{summary.reviewed}/{summary.total} revisados manualmente</span>
        </div>
        <p>Lista de control para evitar costos y obligaciones olvidados. «Revisado» solo registra tu progreso local; no demuestra certificación de una institución.</p>
        <div className="atlas-re-gate" aria-live="polite">
          <strong>{summary.readiness === 'blocked' || criticalRisk ? 'NO-GO · Evaluación abierta' : 'Revisión manual completada · Aún no aprobado'}</strong>
          <span>{summary.p0Outstanding} verificaciones críticas pendientes o con incidencias · {summary.issues} incidencias documentales · Verificación independiente: NO realizada.</span>
        </div>
        {stages.map((stage) => (
          <section className="atlas-re-stage" key={stage}>
            <h3>{stage}</h3>
            {REAL_ESTATE_CHECKLIST.filter((item) => item.stage === stage).map((item) => (
              <div className="atlas-re-check-row" key={item.id}>
                <div><strong>{item.title} <span className="atlas-re-priority">{item.priority}</span></strong><p>{item.detail}</p></div>
                <label>
                  <span className="atlas-re-sr">Estado de {item.title}</span>
                  <select
                    aria-label={`Estado de ${item.title}`}
                    value={reviews[item.id] || 'pending'}
                    onChange={(event) => {
                      const status = event.target.value as RealEstateReviewStatus;
                      setReviews((current) => ({ ...current, [item.id]: status }));
                    }}
                  >
                    <option value="pending">Pendiente</option>
                    <option value="reviewed">Revisado por usuario</option>
                    <option value="issue">Incidencia</option>
                  </select>
                </label>
              </div>
            ))}
          </section>
        ))}
        <div className="atlas-re-warning">
          <strong>Control de seguridad:</strong> ninguna casilla libera fondos, valida títulos, autoriza contratos, solicita crédito ni demuestra cumplimiento regulatorio. Las decisiones reales dependen de documentos, profesionales autorizados y los proveedores correspondientes.
        </div>
      </section>
      <section className="feature-card wide" aria-label="Registros públicos para Orlando">
        <div className="atlas-re-heading">
          <div><p className="eyebrow">04 · Evidencia externa</p><h2>Fuentes oficiales · Orlando / Orange County, Florida</h2></div>
          <span className="atlas-re-chip">Enlaces externos, sin conexión automática</span>
        </div>
        <p>Consulta fuentes oficiales cuando una propiedad esté ubicada en esta jurisdicción. Estas páginas no verifican automáticamente ningún expediente dentro de ATLAS.</p>
        <ul className="atlas-re-sources">
          <li><a href="https://ocpaweb.ocpafl.org/?locale=en_us" target="_blank" rel="noopener noreferrer">Orange County Property Appraiser: parcela, titularidad, valor y estimador fiscal</a></li>
          <li><a href="https://www.octaxcol.com/taxes/about-property-tax/" target="_blank" rel="noopener noreferrer">Orange County Tax Collector: recibos y deudas tributarias</a></li>
          <li><a href="https://www.occompt.com/161/Official-Records" target="_blank" rel="noopener noreferrer">Orange County Comptroller: escrituras, hipotecas y gravámenes registrados</a></li>
          <li><a href="https://www.orlando.gov/Our-Government/Records-and-Documents/Property-Information" target="_blank" rel="noopener noreferrer">City of Orlando: permisos, zoning y code enforcement (si pertenece a la ciudad)</a></li>
          <li><a href="https://floridarevenue.com/taxes/taxesfees/Pages/doc_stamp.aspx" target="_blank" rel="noopener noreferrer">Florida Department of Revenue: documentary stamp tax</a></li>
        </ul>
        <p className="atlas-re-subnote">Para propiedades fuera de Orlando o del condado, comprueba la jurisdicción competente antes de usar estas fuentes. Ningún mapa catastral sustituye un survey, un título asegurado o una inspección.</p>
      </section>
    </section>
  );
}
