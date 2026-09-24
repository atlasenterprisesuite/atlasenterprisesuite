import { verifyDnsTxt } from '../../../packages/execution/src/dns-verification.ts';

export class DnsPublicVerificationError extends Error {
  constructor(readonly code: string, readonly status = 502) {
    super(code);
  }
}

export async function verifyPublicTxt(input: {
  hostname: string;
  expectedValue: string;
  fetchImpl?: typeof fetch;
  attempts?: number;
  delayMs?: number;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const attempts = Math.max(1, Math.min(30, input.attempts ?? 12));
  const delayMs = Math.max(0, Math.min(30_000, input.delayMs ?? 5000));
  let lastAnswers: string[] = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(input.hostname)}&type=TXT`;
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { accept: 'application/dns-json' } });
    } catch {
      throw new DnsPublicVerificationError('dns_resolver_unavailable', 502);
    }
    if (!response.ok) throw new DnsPublicVerificationError('dns_resolver_unavailable', 502);

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      throw new DnsPublicVerificationError('dns_resolver_unavailable', 502);
    }

    const answers = Array.isArray(payload?.Answer)
      ? payload.Answer.filter((answer: any) => Number(answer?.type) === 16 && typeof answer?.data === 'string').map((answer: any) => String(answer.data))
      : [];
    const verification = verifyDnsTxt(input.expectedValue, answers);
    lastAnswers = verification.answers;
    if (verification.verified) return { verified: true, answers: lastAnswers, attemptsUsed: attempt };

    if (attempt < attempts && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { verified: false, answers: lastAnswers, attemptsUsed: attempts };
}
