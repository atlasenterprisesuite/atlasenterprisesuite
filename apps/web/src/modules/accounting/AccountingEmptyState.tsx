export function AccountingEmptyState() {
  return (
    <section className="atlas-status-panel" aria-label="Accounting empty state">
      <strong>No accounting records</strong>
      <span>
        This organization currently has no accounts, journals, customers, vendors, invoices, or payments available to display.
      </span>
    </section>
  );
}
