import { describe, expect, it } from 'vitest';
import { proposeAutofill } from '../../apps/web/src/modules/tools/smartAutofill777';

const profile = { name: 'Ada Lovelace', email: 'ada@example.test', phone: '5550100', company: 'ATLAS', address: '123 Main St' };

describe('ATLAS Smart Autofill 777 proposal engine', () => {
  it('proposes only exact, recognizable fields from supplied profile', () => {
    expect(proposeAutofill([
      { id: 'a', label: 'Nombre completo' },
      { id: 'b', label: 'Email', type: 'email' },
      { id: 'c', label: 'Mystery question' }
    ], profile)).toEqual([
      { fieldId: 'a', category: 'name', value: 'Ada Lovelace', source: 'authorized-profile' },
      { fieldId: 'b', category: 'email', value: 'ada@example.test', source: 'authorized-profile' }
    ]);
  });
  it('blocks hidden, readonly, disabled and sensitive fields', () => {
    const fields = [
      { id: 'a', label: 'Name', hidden: true },
      { id: 'b', label: 'Email', disabled: true },
      { id: 'c', label: 'Phone', readOnly: true },
      { id: 'd', label: 'Bank account number', autocomplete: 'name' },
      { id: 'e', label: 'Name', type: 'password' },
      { id: 'f', label: 'Name', type: 'hidden' },
      { id: 'g', label: 'Name', autocomplete: 'cc-number' }
    ];
    expect(proposeAutofill(fields, profile)).toEqual([]);
  });
  it('rejects conflicting hints, wrong input types and missing values', () => {
    expect(proposeAutofill([
      { id: 'a', label: 'Email', autocomplete: 'name' },
      { id: 'b', label: 'Name', type: 'email' },
      { id: 'c', label: 'Company' }
    ], { name: 'Ada' })).toEqual([]);
  });
  it('does not duplicate field identifiers or mutate the profile', () => {
    const before = JSON.stringify(profile);
    expect(proposeAutofill([{ id: 'x', label: 'Name' }, { id: 'x', label: 'Email' }], profile)).toHaveLength(1);
    expect(JSON.stringify(profile)).toBe(before);
  });
});
