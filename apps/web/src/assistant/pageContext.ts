export type AssistantPageContext = {
  pathname: string;
  title: string;
  headings: string[];
  activeControls: string[];
  alertCount: number;
  viewport: { width: number; height: number } | null;
};

function cleanText(value: string, max = 160) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function isSafeStructuralElement(element: Element) {
  return !element.closest(
    'input, textarea, select, [contenteditable="true"], table, [data-sensitive="true"], [data-private="true"]'
  );
}

function isVisible(element: Element) {
  if (typeof window === 'undefined') return true;
  const node = element as HTMLElement;
  if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function collectSafeText(selector: string, limit: number) {
  if (typeof document === 'undefined') return [];
  const values: string[] = [];
  for (const element of Array.from(document.querySelectorAll(selector))) {
    if (values.length >= limit) break;
    if (!isVisible(element) || !isSafeStructuralElement(element)) continue;
    const value = cleanText(element.getAttribute('aria-label') || element.textContent || '');
    if (!value || values.includes(value)) continue;
    values.push(value);
  }
  return values;
}

export function collectAssistantPageContext(pathname: string): AssistantPageContext {
  if (typeof document === 'undefined') {
    return {
      pathname,
      title: '',
      headings: [],
      activeControls: [],
      alertCount: 0,
      viewport: null
    };
  }

  const alerts = Array.from(document.querySelectorAll('main [role="alert"], main [aria-live="assertive"]'))
    .filter((element) => isVisible(element) && isSafeStructuralElement(element));

  return {
    pathname,
    title: cleanText(document.title || ''),
    headings: collectSafeText('main h1, main h2, main [role="heading"]', 8),
    activeControls: collectSafeText(
      'main [role="tab"][aria-selected="true"], main button[aria-pressed="true"], main a[aria-current="page"]',
      8
    ),
    alertCount: alerts.length,
    viewport: typeof window === 'undefined'
      ? null
      : { width: window.innerWidth, height: window.innerHeight }
  };
}

export function serializeAssistantPageContext(context: AssistantPageContext) {
  const lines = [
    `Route: ${context.pathname}`,
    context.title ? `Document title: ${context.title}` : '',
    context.headings.length ? `Visible headings: ${context.headings.join(' | ')}` : '',
    context.activeControls.length ? `Active controls: ${context.activeControls.join(' | ')}` : '',
    `Visible alert count: ${context.alertCount}`,
    context.viewport ? `Viewport: ${context.viewport.width}x${context.viewport.height}` : ''
  ].filter(Boolean);

  return lines.join('\n').slice(0, 3000);
}
