import type { MidnightInvoice } from './midnightInvoice';
import './midnightInvoice.css';

const money = (cents: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD'
}).format(cents / 100);

export function MidnightInvoiceDocument({ model }: { model: MidnightInvoice }) {
  return (
    <article className="midnight-invoice-sheet" aria-label="Midnight Tech invoice preview / Vista de factura">
      <header className="midnight-invoice-header">
        <div>
          <span className="midnight-invoice-brand">ATLAS · MIDNIGHT TECH</span>
          <h2>{model.documentTitle}</h2>
          <p>Internal verification copy / Copia de verificación interna</p>
        </div>
        <div className="midnight-invoice-number">
          <span>Invoice no. / N.º de factura</span>
          <strong>{model.invoiceNumber}</strong>
          <span>Status / Estado: {model.status}</span>
        </div>
      </header>
      {model.warning && <p className="midnight-invoice-warning" role="status">{model.warning}</p>}
      <div className="midnight-invoice-meta">
        <div><span>Bill to / Facturar a</span><strong>{model.customerName}</strong></div>
        <div><span>Issue date / Fecha de emisión</span><strong>{model.issueDate}</strong></div>
        <div><span>Due date / Vencimiento</span><strong>{model.dueDate || '—'}</strong></div>
      </div>
      <div className="midnight-invoice-table-scroll">
        <table aria-label="Invoice line items / Partidas de factura">
          <thead>
            <tr>
              <th scope="col">Description / Descripción</th>
              <th scope="col">Qty / Cant.</th>
              <th scope="col">Unit price / Precio</th>
              <th scope="col">Tax / Impuesto</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {model.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td>{line.quantity}</td>
                <td>{money(Math.round(line.unitPrice * 100))}</td>
                <td>{line.taxRate}%</td>
                <td>{money(line.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="midnight-invoice-totals">
        <div><span>Total / Total</span><strong>{money(model.totalCents)}</strong></div>
        <div><span>Balance due / Saldo pendiente</span><strong>{money(model.balanceCents)}</strong></div>
      </div>
      <footer className="midnight-invoice-footer">
        <p>Internal print preview only. Legal issuer data, tax jurisdiction and payment instructions are not yet verified for external delivery.</p>
        <p>Solo vista previa interna. Datos legales del emisor, jurisdicción fiscal e instrucciones de pago pendientes de verificación.</p>
        <p>Unsigned / Sin firma digital · No payment link / Sin enlace de pago · USD only</p>
      </footer>
    </article>
  );
}
