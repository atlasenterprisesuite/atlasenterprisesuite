/** ATLAS Finance shared, side-effect-free loan schedule engine. Simulation only. */
export interface LoanTerms { principal: number; annualRatePercent: number; months: number }
export interface LoanRow { month: number; payment: number; interest: number; principal: number; balance: number }
export function amortizeLoan(terms: LoanTerms): LoanRow[] {
  const { principal, annualRatePercent, months } = terms;
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(annualRatePercent) ||
      annualRatePercent < 0 || annualRatePercent > 100 || !Number.isInteger(months) ||
      months < 1 || months > 600) throw new RangeError('Invalid loan terms');
  const r = annualRatePercent / 1200;
  const regularPayment = r === 0 ? principal / months : principal * r / (1 - Math.pow(1 + r, -months));
  let balance = principal;
  const rows: LoanRow[] = [];
  for (let month = 1; month <= months; month++) {
    const interest = balance * r;
    const payment = month === months ? balance + interest : regularPayment;
    const principalPaid = payment - interest;
    balance = Math.max(0, balance - principalPaid);
    rows.push({ month, payment, interest, principal: principalPaid, balance });
  }
  return rows;
}
