export type AssistantElementContext = {
  tag: string;
  role: string | null;
  type: string | null;
  id: string | null;
  component: string | null;
  name: string | null;
  label: string | null;
  placeholder: string | null;
  href_path: string | null;
  selector_hint: string;
  rect: { x: number; y: number; width: number; height: number } | null;
};

function clean(value: string | null, max = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeToken(value: string | null, max = 80) {
  const token = clean(value, max);
  return /^[A-Za-z][A-Za-z0-9:_.-]*$/.test(token) ? token : '';
}

function safeIdentifier(value: string | null, max = 80) {
  const token = safeToken(value, max);
  if (!token) return '';
  if (/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(token) || /\d{6,}/.test(token)) return '';
  return token;
}

function siblingIndex(element: Element) {
  const parent = element.parentElement;
  if (!parent) return 1;
  const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  return Math.max(1, siblings.indexOf(element) + 1);
}

function selectorHint(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  const id = safeIdentifier(element.id);
  if (id) return `${tag}#${id}`;

  const component = safeIdentifier(element.getAttribute('data-atlas-component'));
  if (component) return `${tag}[data-atlas-component=${component}]`;

  const role = safeToken(element.getAttribute('role'));
  if (role) return `${tag}[role=${role}]:nth-of-type(${siblingIndex(element)})`;

  return `${tag}:nth-of-type(${siblingIndex(element)})`;
}

function safeHrefPath(element: HTMLElement) {
  if (!(element instanceof HTMLAnchorElement)) return null;
  const href = clean(element.getAttribute('href'), 300);
  if (!href || !href.startsWith('/')) return null;
  const rawPath = href.split(/[?#]/, 1)[0].slice(0, 180);
  const redacted = rawPath.split('/').map((segment) => {
    if (/^\d{6,}$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || segment.length > 80) return ':id';
    return segment;
  }).join('/');
  return redacted || null;
}

export function describeAssistantElement(element: HTMLElement): AssistantElementContext {
  const rect = typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
  const dataComponent = safeIdentifier(element.getAttribute('data-atlas-component'))
    || safeIdentifier(element.getAttribute('data-component'))
    || safeIdentifier(element.getAttribute('data-testid'));

  return {
    tag: element.tagName.toLowerCase(),
    role: safeToken(element.getAttribute('role')) || null,
    type: safeToken(element.getAttribute('type')) || null,
    id: safeIdentifier(element.id) || null,
    component: dataComponent || null,
    name: safeIdentifier(element.getAttribute('name')) || null,
    label: null,
    placeholder: null,
    href_path: safeHrefPath(element),
    selector_hint: selectorHint(element),
    rect: rect ? {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    } : null
  };
}

export function serializeAssistantElementContext(context: AssistantElementContext) {
  return [
    `tag=${context.tag}`,
    context.role ? `role=${context.role}` : '',
    context.type ? `type=${context.type}` : '',
    context.id ? `id=${context.id}` : '',
    context.component ? `component=${context.component}` : '',
    context.name ? `name=${context.name}` : '',
    context.label ? `label=${context.label}` : '',
    context.placeholder ? `placeholder=${context.placeholder}` : '',
    context.href_path ? `href_path=${context.href_path}` : '',
    `selector_hint=${context.selector_hint}`,
    context.rect ? `rect=${context.rect.x},${context.rect.y},${context.rect.width},${context.rect.height}` : ''
  ].filter(Boolean).join('\n').slice(0, 1800);
}

export function assistantElementLabel(context: AssistantElementContext) {
  return context.component
    || context.id
    || context.label
    || context.role
    || context.name
    || context.selector_hint;
}

export function startAssistantElementPicker(input: {
  onSelect: (context: AssistantElementContext) => void;
  onCancel?: () => void;
}) {
  if (typeof document === 'undefined') return () => undefined;

  let hovered: HTMLElement | null = null;
  let active = true;

  const eligible = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof HTMLElement)) return null;
    if (target.closest('.atlas-assistant-root')) return null;
    if (target.closest('[data-sensitive="true"], [data-private="true"]')) return null;
    return target;
  };

  const clearHover = () => {
    hovered?.classList.remove('atlas-assistant-element-hover');
    hovered = null;
  };

  const cleanup = () => {
    if (!active) return;
    active = false;
    clearHover();
    document.body.classList.remove('atlas-assistant-picking');
    document.removeEventListener('pointerover', onPointerOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  };

  const onPointerOver = (event: Event) => {
    const target = eligible(event.target);
    if (!target || target === hovered) return;
    clearHover();
    hovered = target;
    hovered.classList.add('atlas-assistant-element-hover');
  };

  const onClick = (event: MouseEvent) => {
    const target = eligible(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const context = describeAssistantElement(target);
    cleanup();
    input.onSelect(context);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    cleanup();
    input.onCancel?.();
  };

  document.body.classList.add('atlas-assistant-picking');
  document.addEventListener('pointerover', onPointerOver, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  return cleanup;
}
