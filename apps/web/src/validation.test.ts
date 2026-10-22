import { describe, expect, it } from 'vitest';
import { validateTitle } from './validation';

describe('validateTitle', () => {
  it('rejects empty and whitespace-only titles', () => {
    expect(validateTitle('')).toMatch(/enter a task title/i);
    expect(validateTitle('   \t ')).toMatch(/enter a task title/i);
  });

  it('accepts 1 to 120 characters after trimming', () => {
    expect(validateTitle('a')).toBeNull();
    expect(validateTitle(`  ${'x'.repeat(120)}  `)).toBeNull();
  });

  it('rejects titles longer than 120 characters', () => {
    expect(validateTitle('x'.repeat(121))).toMatch(/120 characters or fewer/);
  });
});
