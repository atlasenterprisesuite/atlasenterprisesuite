const SITE_REVIEW_ROUTE = Object.freeze({
  id: 'site-review',
  path: '/sites/review',
  title: 'ATLAS Site Review Center',
  status: 200
});

export function resolveRoute(pathname) {
  const normalized = pathname === '/' ? '/' : `/${String(pathname ?? '').split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '')}`;
  if (normalized === '/' || normalized === '/sites/review') {
    return SITE_REVIEW_ROUTE;
  }
  return Object.freeze({ id: 'not-found', path: normalized, title: 'Not Found', status: 404 });
}
