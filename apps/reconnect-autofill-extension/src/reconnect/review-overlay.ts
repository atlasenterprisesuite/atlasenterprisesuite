export interface ReviewSummary {
  state: 'filled' | 'blocked' | 'mapping-changed' | 'error';
  filled?: string[];
  preserved?: string[];
  missing?: string[];
  reason?: string;
}

export function clearReviewOverlay(document: Document): void {
  document.querySelector('[data-atlas-reconnect-review]')?.remove();
}

export function renderReviewOverlay(document: Document, summary: ReviewSummary): HTMLElement {
  clearReviewOverlay(document);
  const region = document.createElement('section');
  region.setAttribute('data-atlas-reconnect-review', 'true');
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('tabindex', '-1');
  region.style.cssText = [
    'position:fixed','right:16px','bottom:16px','z-index:2147483647','max-width:360px','padding:16px',
    'border:1px solid #7c8cff','border-radius:14px','background:#10131a','color:#f7f8ff',
    'font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif','box-shadow:0 12px 36px rgba(0,0,0,.35)'
  ].join(';');

  const title = document.createElement('strong');
  title.textContent = `ATLAS Reconnect — ${summary.state.toUpperCase()}`;
  region.append(title);

  const details = document.createElement('div');
  const lines: string[] = [];
  if (summary.reason) lines.push(`Reason: ${summary.reason}`);
  if (summary.filled?.length) lines.push(`Filled: ${summary.filled.join(', ')}`);
  if (summary.preserved?.length) lines.push(`Preserved: ${summary.preserved.join(', ')}`);
  if (summary.missing?.length) lines.push(`Missing: ${summary.missing.join(', ')}`);
  details.textContent = lines.length ? ` ${lines.join(' · ')}` : ' Review the page before continuing.';
  region.append(details);

  document.body.append(region);
  region.focus({ preventScroll: true });
  return region;
}
