import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlausiblePhone } from '../../src/lib/phone-validation.ts';

test('rejects repeated digits, sequential placeholders and malformed numbers', () => {
  for (const value of ['000000000', '111111111', '999 999 999', '+351 000 000 000', '00351 111111111', '+44 0000000000', '123456789', '987654321', '+351 123456789', '00351 987654321', '+ 351 123456789', '00 351 123456789', '+35 1 987654321', '12345', '+1234567890123456', 'abc912345678', '912+345678', '9/12345678']) {
    assert.equal(isPlausiblePhone(value), false, value);
  }
});

test('accepts plausible domestic and international formatting without a Portuguese-only restriction', () => {
  for (const value of ['912345678', '212345678', '900000000', '+351 912 345 678', '00351 912 345 678', '+ 351 912 345 678', '00 351 912 345 678', '+351 900000000', '+44 20 7946 0958', '+1 (415) 555-2671', '+33 6 12 34 56 78', '020 7946 0958', '912.345.678']) {
    assert.equal(isPlausiblePhone(value), true, value);
  }
});
