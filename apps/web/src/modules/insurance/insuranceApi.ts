const INSURANCE_DEFAULT = '/insurance';

export function resolveInsuranceReturnTo(rawTarget: string | null) {
  if (!rawTarget) return INSURANCE_DEFAULT;

  let target = rawTarget.trim();
  try {
    target = decodeURIComponent(target);
  } catch {
    return INSURANCE_DEFAULT;
  }

  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return INSURANCE_DEFAULT;
  }

  const pathname = target.split(/[?#]/, 1)[0];
  if (pathname === '/insurance' || pathname.startsWith('/insurance/')) {
    return target;
  }

  return INSURANCE_DEFAULT;
}
