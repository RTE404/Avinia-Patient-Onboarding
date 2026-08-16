import { describe, it, expect } from 'vitest';
import { sandboxPatients } from './sandbox-patients.js';

describe('sandboxPatients', () => {
  it('has exactly 8 confirmed patients', () => {
    expect(sandboxPatients).toHaveLength(8);
  });

  it('has 5 GOLD and 3 BRONZE patients', () => {
    const gold = sandboxPatients.filter((p) => p.tier === 'GOLD');
    const bronze = sandboxPatients.filter((p) => p.tier === 'BRONZE');
    expect(gold).toHaveLength(5);
    expect(bronze).toHaveLength(3);
  });

  it('every patient_id is unique', () => {
    const ids = sandboxPatients.map((p) => p.demographics.patient_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Hart Fallon is a BRONZE patient registered as test-007', () => {
    const hart = sandboxPatients.find((p) => p.name === 'Hart Fallon');
    expect(hart?.tier).toBe('BRONZE');
    expect(hart?.demographics.patient_id).toBe('test-007');
    expect(hart?.demographics.date_of_birth).toBe('1952-10-01');
  });
});
