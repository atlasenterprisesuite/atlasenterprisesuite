const ACCESS_TOKEN_KEY = 'atlas_access_token';
const REFRESH_TOKEN_KEY = 'atlas_refresh_token';

function storage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    ? window.localStorage
    : null;
}

export function readAccessToken() {
  return storage()?.getItem(ACCESS_TOKEN_KEY) || '';
}

export function readRefreshToken() {
  return storage()?.getItem(REFRESH_TOKEN_KEY) || '';
}

export function writeSession(data: { access_token?: string; refresh_token?: string }) {
  const target = storage();
  if (!target || !data.access_token) return false;
  target.setItem(ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token) target.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  return true;
}

export function clearSessionStorage() {
  const target = storage();
  if (!target) return false;
  target.removeItem(ACCESS_TOKEN_KEY);
  target.removeItem(REFRESH_TOKEN_KEY);
  return true;
}
