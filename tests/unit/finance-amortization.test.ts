import { describe, expect, it } from 'vitest';
import { amortizeLoan } from '../../packages/finance/src/amortization';
describe('ATLAS Finance amortization', () => {
 it('calculates 40000 at 15% over 60 months', () => {
   const rows=amortizeLoan({principal:40000,annualRatePercent:15,months:60});
   expect(rows).toHaveLength(60);
   expect(rows[0].payment).toBeCloseTo(951.60,1);
   expect(rows[0].interest).toBeCloseTo(500,5);
   expect(rows[59].balance).toBe(0);
   expect(rows.reduce((sum,row)=>sum+row.principal,0)).toBeCloseTo(40000,5);
 });
 it('supports zero interest',()=>{const r=amortizeLoan({principal:1200,annualRatePercent:0,months:12});expect(r[0].payment).toBe(100);expect(r[11].balance).toBe(0)});
 it.each([{principal:-1,annualRatePercent:15,months:60},{principal:40000,annualRatePercent:-1,months:60},{principal:40000,annualRatePercent:15,months:0},{principal:Infinity,annualRatePercent:15,months:60}])('rejects invalid terms %j',(terms)=>expect(()=>amortizeLoan(terms)).toThrow(RangeError));
});
