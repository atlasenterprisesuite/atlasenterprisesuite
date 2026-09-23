import type { PayrollCalculationInput, PayrollCalculationResult } from './types';
import type { TaxRuleSet } from './tax-rules';

function assertIntegerMoney(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid_money:${field}`);
}

function sha256(input: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const maxWord = 2 ** 32;
  const words: number[] = [];
  const ascii = unescape(encodeURIComponent(input));
  const bitLength = ascii.length * 8;
  let data = ascii + '\x80';
  while ((data.length % 64) !== 56) data += '\x00';
  for (let i = 0; i < data.length; i += 4) {
    words.push(
      ((data.charCodeAt(i) || 0) << 24) |
      ((data.charCodeAt(i + 1) || 0) << 16) |
      ((data.charCodeAt(i + 2) || 0) << 8) |
      (data.charCodeAt(i + 3) || 0)
    );
  }
  words.push(Math.floor(bitLength / maxWord));
  words.push(bitLength >>> 0);

  const h = [
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
  ];
  const k = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];

  for (let offset = 0; offset < words.length; offset += 16) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i += 1) w[i] = words[offset + i] | 0;
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = rightRotate(x, 7) ^ rightRotate(x, 18) ^ (x >>> 3);
      const s1 = rightRotate(y, 17) ^ rightRotate(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e,6) ^ rightRotate(e,11) ^ rightRotate(e,25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(a,2) ^ rightRotate(a,13) ^ rightRotate(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      hh=g; g=f; f=e; e=(d+temp1)|0; d=c; c=b; b=a; a=(temp1+temp2)|0;
    }
    const next=[a,b,c,d,e,f,g,hh];
    for(let i=0;i<8;i+=1) h[i]=(h[i]+next[i])|0;
  }
  return h.map((value)=>(value>>>0).toString(16).padStart(8,'0')).join('');
}

export function calculatePayroll(
  input: PayrollCalculationInput,
  ruleSet: TaxRuleSet
): PayrollCalculationResult {
  for (const [field, value] of Object.entries(input)) {
    if (typeof value === 'number') assertIntegerMoney(value, field);
  }
  if (!ruleSet.validated) throw new Error('tax_rule_not_validated');
  const taxableWageBaseCents = Math.max(0, input.taxableEarningsCents - input.pretaxDeductionsCents);
  const employeeTaxesCents = ruleSet.calculateEmployeeTaxes(taxableWageBaseCents);
  const employerTaxesCents = ruleSet.calculateEmployerTaxes(taxableWageBaseCents);
  assertIntegerMoney(employeeTaxesCents, 'employeeTaxesCents');
  assertIntegerMoney(employerTaxesCents, 'employerTaxesCents');
  const netPayCents =
    input.taxableEarningsCents +
    input.nonTaxableEarningsCents +
    input.reimbursementsCents -
    input.pretaxDeductionsCents -
    employeeTaxesCents -
    input.postTaxDeductionsCents -
    input.garnishmentsCents;
  if (!Number.isSafeInteger(netPayCents) || netPayCents < 0) throw new Error('invalid_net_pay');

  const normalized = JSON.stringify({
    input,
    rule: {
      jurisdiction: ruleSet.jurisdiction,
      version: ruleSet.version,
      effectiveFrom: ruleSet.effectiveFrom,
      effectiveTo: ruleSet.effectiveTo ?? null
    },
    result: { taxableWageBaseCents, employeeTaxesCents, employerTaxesCents, netPayCents }
  });

  return {
    taxableWageBaseCents,
    employeeTaxesCents,
    employerTaxesCents,
    netPayCents,
    ruleVersion: ruleSet.version,
    checksum: sha256(normalized)
  };
}
