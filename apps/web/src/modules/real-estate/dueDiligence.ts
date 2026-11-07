/** Pre-close diligence: a manual review tracker, never proof of ownership or approval. */
export type RealEstateChecklistStage =
  | 'Property & title' | 'Financials & taxes' | 'Physical & environmental'
  | 'Permits & legal' | 'Loan & insurance' | 'Closing & operations';

export type RealEstateChecklistItem = {
  id: string;
  stage: RealEstateChecklistStage;
  title: string;
  detail: string;
  priority: 'P0' | 'P1';
};

export type RealEstateReviewStatus = 'pending' | 'reviewed' | 'issue';
export type RealEstateReviewMap = Record<string, RealEstateReviewStatus>;
export type RealEstateReviewSummary = {
  total: number;
  pending: number;
  reviewed: number;
  issues: number;
  p0Outstanding: number;
  readiness: 'blocked' | 'manual-review-complete';
  independentlyVerified: false;
};

/** One canonical set of required tasks, not a representation of provider-verified evidence. */
export const REAL_ESTATE_CHECKLIST: readonly RealEstateChecklistItem[] = [
  { id: 'identity', stage: 'Property & title', title: 'Propiedad e identidad del vendedor', detail: 'Identidad legal, facultad para vender, escritura, descripción legal y número de parcela.', priority: 'P0' },
  { id: 'title', stage: 'Property & title', title: 'Título, gravámenes y servidumbres', detail: 'Title commitment, hipotecas, embargos, litigios, liens, restricciones, servidumbres y survey.', priority: 'P0' },
  { id: 'valuation', stage: 'Property & title', title: 'Valoración y comparables', detail: 'Comps recientes, appraisal independiente si aplica y precio por unidad o superficie.', priority: 'P1' },
  { id: 'leases', stage: 'Financials & taxes', title: 'Contratos, rent roll y depósitos', detail: 'Comprobar inquilinos, rentas reales, morosidad, depósitos y vencimientos; conciliación bancaria.', priority: 'P0' },
  { id: 'operations', stage: 'Financials & taxes', title: 'Histórico de ingresos y gastos', detail: 'T12/P&L, utilities, mantenimiento, nómina, administración, contratos, ocupación y vacantes.', priority: 'P0' },
  { id: 'property-tax', stage: 'Financials & taxes', title: 'Impuesto inmobiliario y deuda fiscal', detail: 'Registro del Property Appraiser y Tax Collector; atrasos, assessments especiales y posible cambio tras venta.', priority: 'P0' },
  { id: 'income-tax', stage: 'Financials & taxes', title: 'Plan tributario y estructura de tenencia', detail: 'Depreciación, base fiscal, clasificación de entidad, impuestos de ingreso y asesoría fiscal aplicable.', priority: 'P1' },
  { id: 'hoa', stage: 'Financials & taxes', title: 'HOA/condominio y derramas', detail: 'Estatutos, restricciones, balances, estatus de cuotas y special assessments si aplica.', priority: 'P0' },
  { id: 'structure', stage: 'Physical & environmental', title: 'Inspección estructural y techo', detail: 'Inspección profesional; estructura, techo, humedad, cimentación y reparación presupuestada.', priority: 'P0' },
  { id: 'systems', stage: 'Physical & environmental', title: 'HVAC, electricidad y plomería', detail: 'Edad, estado, eficiencia, permisos de trabajos previos y estimados de reemplazo.', priority: 'P0' },
  { id: 'pests', stage: 'Physical & environmental', title: 'Plagas y condiciones ambientales', detail: 'Termitas, moho, materiales peligrosos, plomo/asbesto y estudios Phase I/II cuando correspondan.', priority: 'P0' },
  { id: 'repairs', stage: 'Physical & environmental', title: 'Reparaciones y reservas de capital', detail: 'Cotizaciones de contratistas, contingencia, diferidos, CAPEX y calendario de mantenimiento.', priority: 'P0' },
  { id: 'zoning', stage: 'Permits & legal', title: 'Zoning, uso permitido y ocupación', detail: 'Uso legal, densidad, licencias, ocupación, restricciones de alquiler y short-term rental si corresponde.', priority: 'P0' },
  { id: 'permits', stage: 'Permits & legal', title: 'Permisos, multas y code violations', detail: 'Permisos abiertos/cerrados, violaciones, órdenes, inspecciones de la ciudad/condado y certificados requeridos.', priority: 'P0' },
  { id: 'tenant-law', stage: 'Permits & legal', title: 'Obligaciones ante inquilinos', detail: 'Depósitos, contratos, protección de vivienda justa, renovaciones y obligaciones locales/estatales.', priority: 'P0' },
  { id: 'hazard', stage: 'Loan & insurance', title: 'Seguro de propiedad y riesgos', detail: 'Cotización vinculante, incendios, responsabilidad, viento/huracán, inundación, deducibles y exclusiones.', priority: 'P0' },
  { id: 'loan', stage: 'Loan & insurance', title: 'Términos y condiciones del crédito', detail: 'LTV, DSCR/DTI, tipo de tasa, amortización, vencimiento, puntos, comisiones, prepayment, garantías y contingencias.', priority: 'P0' },
  { id: 'credit', stage: 'Loan & insurance', title: 'Crédito, underwriting y documentación', detail: 'Historial crediticio cuando aplique, ingresos, liquidez, reservas, estados de cuenta, KYC y aprobación real del prestamista.', priority: 'P0' },
  { id: 'insurance-cost', stage: 'Loan & insurance', title: 'Coste asegurado tras la compra', detail: 'Confirmar prima y límites definitivos con póliza cotizada para el uso previsto.', priority: 'P0' },
  { id: 'contract', stage: 'Closing & operations', title: 'Contrato y contingencias', detail: 'Earnest money, due diligence, inspección, financiamiento, plazos, incumplimientos y derecho a cancelar.', priority: 'P0' },
  { id: 'closing', stage: 'Closing & operations', title: 'Cierre, escrow y tributos de transferencia', detail: 'Title fees, recording, doc stamps, survey, lender fees, prorrateos, impuestos y efectivo exacto al cierre.', priority: 'P0' },
  { id: 'wire', stage: 'Closing & operations', title: 'Prevención de fraude en transferencias', detail: 'Confirmar instrucciones de wire con agente de cierre por un canal independiente previamente conocido.', priority: 'P0' },
  { id: 'management', stage: 'Closing & operations', title: 'Plan de administración posterior', detail: 'Property management, mantenimiento, proveedores, seguros, contabilidad, reservas y calendario fiscal.', priority: 'P1' },
  { id: 'audit', stage: 'Closing & operations', title: 'Evidencia y revisión independiente', detail: 'Referencias documentales, autorizaciones, responsables, fechas de comprobación y revisión profesional.', priority: 'P0' }
] as const;

export function summarizeRealEstateReview(
  statuses: RealEstateReviewMap,
  checklist: readonly RealEstateChecklistItem[] = REAL_ESTATE_CHECKLIST
): RealEstateReviewSummary {
  let pending = 0;
  let reviewed = 0;
  let issues = 0;
  let p0Outstanding = 0;
  for (const item of checklist) {
    const status = statuses[item.id] ?? 'pending';
    if (status === 'reviewed') reviewed++;
    else if (status === 'issue') issues++;
    else pending++;
    if (item.priority === 'P0' && status !== 'reviewed') p0Outstanding++;
  }
  return {
    total: checklist.length, pending, reviewed, issues, p0Outstanding,
    readiness: pending + issues + p0Outstanding > 0 ? 'blocked' : 'manual-review-complete',
    independentlyVerified: false
  };
}
