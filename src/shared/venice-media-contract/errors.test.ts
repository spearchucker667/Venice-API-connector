import { describe, expect, it } from 'vitest';
import {
  VeniceContractError,
  VeniceConsentRequiredError,
  VeniceContentPolicyError,
  VenicePaymentRequiredError,
  VeniceRateLimitError,
  VeniceValidationError,
} from './errors';
import type { SeedanceConsentChallenge } from './types';

describe('VeniceMediaContract Errors', () => {
  it('should create VeniceContractError', () => {
    const err = new VeniceContractError('Test error', 500, 'TEST_CODE', { data: 1 });
    expect(err.message).toBe('Test error');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('TEST_CODE');
    expect(err.responseBody).toEqual({ data: 1 });
    expect(err.name).toBe('VeniceContractError');
  });

  it('should create VeniceConsentRequiredError', () => {
    const challenge: SeedanceConsentChallenge = {
      error: {
        code: 'needs_consent',
        message: 'Face consent required'
      },
      consent_flow: 'seedance'
    };
    const err = new VeniceConsentRequiredError(challenge, { detail: 'msg' });
    expect(err.message).toBe('Face consent required');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('needs_consent');
    expect(err.challenge).toBe(challenge);
    expect(err.responseBody).toEqual({ detail: 'msg' });
    expect(err.name).toBe('VeniceConsentRequiredError');
  });

  it('should create VeniceContentPolicyError', () => {
    const err = new VeniceContentPolicyError('Policy violation', 'NSFW', { detail: 'msg' });
    expect(err.message).toBe('Policy violation');
    expect(err.statusCode).toBe(422);
    expect(err.reasonCode).toBe('NSFW');
    expect(err.code).toBe('NSFW');
    expect(err.responseBody).toEqual({ detail: 'msg' });
    expect(err.name).toBe('VeniceContentPolicyError');
  });

  it('should create VenicePaymentRequiredError', () => {
    const err = new VenicePaymentRequiredError('Payment required', { detail: 'msg' });
    expect(err.message).toBe('Payment required');
    expect(err.statusCode).toBe(402);
    expect(err.code).toBe('PAYMENT_REQUIRED');
    expect(err.responseBody).toEqual({ detail: 'msg' });
    expect(err.name).toBe('VenicePaymentRequiredError');
  });

  it('should create VeniceRateLimitError', () => {
    const err = new VeniceRateLimitError('Rate limit', 60, { detail: 'msg' });
    expect(err.message).toBe('Rate limit');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.retryAfterSeconds).toBe(60);
    expect(err.responseBody).toEqual({ detail: 'msg' });
    expect(err.name).toBe('VeniceRateLimitError');
  });

  it('should create VeniceValidationError', () => {
    const err = new VeniceValidationError('Validation failed', { detail: 'msg' });
    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.responseBody).toEqual({ detail: 'msg' });
    expect(err.name).toBe('VeniceValidationError');
  });
});
