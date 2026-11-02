import { useMemo, useState } from 'react';
import type { LiveReceivablesLedger } from '../../../lib/receivablesApi';
import { buildInvoice2030Model, formatInvoice2030Money } from '../../../lib/invoice2030';
import './AtlasInvoice2030.css';

type Language = 'en' | 'es';
const copy = {
  en: {
    invoice: 'INVOICE', subtitle: 'Enterprise billing document', draft: 'DRAFT · NOT AN OFFICIAL INVOICE',
    customer: 'BILL TO', issuer: 'ISSUED BY', date: 'Issue date', due: 'Due date',
    status: 'Status', description: 'Description', qty: 'Qty', price: 'Unit price',
    tax: 'Tax', amount: 'Amount', subtotal: 'Subtotal', total: 'Total', paid: 'Paid / credited',
    balance: 'Balance due', payment: 'Payment instructions', noBank: 'Bank details are not verified or configured. Do not send payment based on this preview.',
    signature: 'Digital signature', unsigned: 'Not digitally signed', evidence: 'Document evidence',
    noEvidence: 'No verified attachments or signed document are linked to this preview.',
    qr: 'Invoice QR / hosted payment', noQr: 'Not enabled: verified server-issued link and provider authorization required.',
    country: 'Country tax profile', noCountry: 'Not configured for official issuance.',
    company: 'ATLAS Enterprise Suite', legal: 'Legal issuer name / address / tax identifier must be verified before sending.',
    billing: 'Billing address', shipping: 'Shipping address', missing: 'Not configured',
    internal: 'INTERNAL PREVIEW · NOT VALID FOR CUSTOMER DELIVERY',
    help: 'Read-only view from ATLAS Accounts Receivable. Printing cannot post accounting entries.',
    preview: 'Print / Save preview as PDF', language: 'Language / Idioma', format: 'Print format',
    standard: 'A4 / Letter', thermal: '80mm receipt', blocked: 'Invoice preview unavailable',
    warning: 'The accounting record failed scope or amount validation; no document was generated.',
    id: 'Record reference', po: 'Customer PO', poMissing: 'Not recorded',
    taxWarning: 'Tax/exemption has not been independently certified for this jurisdiction.',
    customerContact: 'Customer contact'
  },
  es: {
    invoice: 'FACTURA', subtitle: 'Documento de facturación empresarial', draft: 'BORRADOR · NO ES FACTURA OFICIAL',
    customer: 'FACTURAR A', issuer: 'EMITIDA POR', date: 'Fecha de emisión', due: 'Vencimiento',
    status: 'Estado', description: 'Descripción', qty: 'Cant.', price: 'Precio unitario',
    tax: 'Impuesto', amount: 'Importe', subtotal: 'Subtotal', total: 'Total', paid: 'Pagado / acreditado',
    balance: 'Saldo pendiente', payment: 'Instrucciones de pago', noBank: 'Los datos bancarios no están verificados ni configurados. No pague basándose en esta vista.',
    signature: 'Firma digital', unsigned: 'Sin firma digital verificada', evidence: 'Evidencia documental',
    noEvidence: 'Esta vista no tiene adjuntos ni documentos firmados verificados.',
    qr: 'QR de factura / pago', noQr: 'No habilitado: requiere enlace seguro emitido por servidor y autorización del proveedor.',
    country: 'Perfil fiscal por país', noCountry: 'No configurado para emisión oficial.',
    company: 'ATLAS Enterprise Suite', legal: 'Verificar razón social emisora, dirección e identificación fiscal antes de enviar.',
    billing: 'Dirección de facturación', shipping: 'Dirección de entrega', missing: 'No configurada',
    internal: 'VISTA INTERNA · NO VÁLIDA PARA ENVÍO AL CLIENTE',
    help: 'Vista de solo lectura de cuentas por cobrar. Imprimir no genera asientos contables.',
    preview: 'Imprimir / Guardar vista como PDF', language: 'Idioma / Language', format: 'Formato de impresión',
    standard: 'A4 / Carta', thermal: 'Recibo 80 mm', blocked: 'Vista de factura no disponible',
    warning: 'El registro contable no pasó la validación de importes o alcance; no se generó el documento.',
    id: 'Referencia de registro', po: 'Orden de compra del cliente', poMissing: 'No registrada',
    taxWarning: 'Los impuestos o exenciones no han sido certificados para esta jurisdicción.',
    customerContact: 'Contacto del cliente'
  }
} as const;

export function AtlasInvoice2030({ ledger, invoiceId }: { ledger: LiveReceivablesLedger; invoiceId: string }) {
  const [language, setLanguage] = useState<Language>('en');
  const [paper, setPaper] = useState<'standard' | 'thermal'>('standard');
  const labels = copy[language];
  const outcome = useMemo(() => {
    try { return { model: buildInvoice2030Model(ledger, invoiceId), error: null }; }
    catch (error) { return { model: null, error: error instanceof Error ? error.message : 'invalid_invoice' }; }
  }, [ledger, invoiceId]);

  const model = outcome.model;
  if (!model) {
    return <section className="atlas-2030-error" role="alert">
      <strong>{labels.blocked}</strong><p>{labels.warning}</p><code>{outcome.error}</code>
    </section>;
  }
  const money = (amount: number) => formatInvoice2030Money(amount, language);
  return (
    <section className="atlas-2030-wrap" aria-label="ATLAS 2030 invoice preview">
      <div className="atlas-2030-controls">
        <label>{labels.language}{' '}
          <select aria-label={labels.language} value={language} onChange={event => setLanguage(event.target.value as Language)}>
            <option value="en">English</option><option value="es">Español</option>
          </select>
        </label>
        <label>{labels.format}{' '}
          <select aria-label={labels.format} value={paper} onChange={event => setPaper(event.target.value as 'standard' | 'thermal')}>
            <option value="standard">{labels.standard}</option><option value="thermal">{labels.thermal}</option>
          </select>
        </label>
        <button type="button" className="secondary-action" onClick={() => window.print()}>{labels.preview}</button>
      </div>
      <article className={`atlas-invoice-print-scope atlas-invoice-2030 ${paper === 'thermal' ? 'atlas-2030-thermal' : ''}`}
        aria-label={labels.invoice}>
        <header className="atlas-2030-head">
          <div className="atlas-2030-wordmark" aria-label={labels.company}>ATLAS <span>2030</span><small>ENTERPRISE SUITE</small></div>
          <div className="atlas-2030-heading"><h3>{labels.invoice}</h3><p>{labels.subtitle}</p><strong>{model.invoiceNumber}</strong></div>
        </header>
        <p className="atlas-2030-watermark" role="status">{labels.internal}</p>
        <div className="atlas-2030-parties">
          <div><h4>{labels.issuer}</h4><strong>{labels.company}</strong><p>{labels.legal}</p></div>
          <div><h4>{labels.customer}</h4><strong>{model.customerName}</strong>
            <p>{labels.customerContact}: {model.customerEmail || model.customerPhone || labels.missing}</p>
            <p>{labels.billing}: {labels.missing}</p><p>{labels.shipping}: {labels.missing}</p></div>
        </div>
        <dl className="atlas-2030-meta">
          <div><dt>{labels.date}</dt><dd>{model.issueDate}</dd></div>
          <div><dt>{labels.due}</dt><dd>{model.dueDate || '—'}</dd></div>
          <div><dt>{labels.status}</dt><dd>{model.isDraft ? labels.draft : model.status}</dd></div>
          <div><dt>{labels.po}</dt><dd>{labels.poMissing}</dd></div>
        </dl>
        <div className="atlas-2030-table-scroll">
          <table>
            <thead><tr><th scope="col">{labels.description}</th><th scope="col">{labels.qty}</th><th scope="col">{labels.price}</th><th scope="col">{labels.tax}</th><th scope="col">{labels.amount}</th></tr></thead>
            <tbody>{model.items.map(line => <tr key={line.id}><td>{line.sku ? `${line.sku} · ` : ''}{line.description}</td>
              <td>{line.quantity}</td><td>{money(line.unitPriceMinor)}</td><td>{line.taxPercent}%</td><td>{money(line.totalMinor)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="atlas-2030-totals">
          <div><span>{labels.subtotal}</span><strong>{money(model.subtotalMinor)}</strong></div>
          <div><span>{labels.tax}</span><strong>{money(model.taxMinor)}</strong></div>
          <div className="atlas-2030-total"><span>{labels.total}</span><strong>{money(model.totalMinor)}</strong></div>
          <div><span>{labels.paid}</span><strong>{money(model.paidMinor)}</strong></div>
          <div className="atlas-2030-balance"><span>{labels.balance}</span><strong>{money(model.balanceMinor)}</strong></div>
        </div>
        <div className="atlas-2030-foot">
          <div><h4>{labels.payment}</h4><p>{labels.noBank}</p></div>
          <div><h4>{labels.qr}</h4><p>{labels.noQr}</p></div>
          <div><h4>{labels.signature}</h4><p>{labels.unsigned}</p></div>
          <div><h4>{labels.evidence}</h4><p>{labels.noEvidence}</p></div>
          <div><h4>{labels.country}</h4><p>{labels.noCountry}</p><p>{labels.taxWarning}</p></div>
        </div>
        <footer><span>{labels.help}</span><small>{labels.id}: {model.invoiceId}</small></footer>
      </article>
    </section>
  );
}
