/**
 * @fileoverview Typed errors for Venice API operations.
 */

import type { SeedanceConsentChallenge } from './types';

export class VeniceContractError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'VeniceContractError';
  }
}

export class VeniceConsentRequiredError extends VeniceContractError {
  constructor(
    public readonly challenge: SeedanceConsentChallenge,
    responseBody?: unknown,
  ) {
    super(
      challenge.error.message || 'Seedance face consent is required for this request.',
      409,
      'needs_consent',
      responseBody,
    );
    this.name = 'VeniceConsentRequiredError';
  }
}

export class VeniceContentPolicyError extends VeniceContractError {
  constructor(
    message: string,
    public readonly reasonCode?: string,
    responseBody?: unknown,
  ) {
    super(message, 422, reasonCode || 'CONTENT_POLICY_VIOLATION', responseBody);
    this.name = 'VeniceContentPolicyError';
  }
}

export class VenicePaymentRequiredError extends VeniceContractError {
  constructor(message: string, responseBody?: unknown) {
    super(message, 402, 'PAYMENT_REQUIRED', responseBody);
    this.name = 'VenicePaymentRequiredError';
  }
}

export class VeniceRateLimitError extends VeniceContractError {
  constructor(message: string, public readonly retryAfterSeconds?: number, responseBody?: unknown) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', responseBody);
    this.name = 'VeniceRateLimitError';
  }
}

export class VeniceValidationError extends VeniceContractError {
  constructor(message: string, responseBody?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', responseBody);
    this.name = 'VeniceValidationError';
  }
}
