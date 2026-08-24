import { describe, expect, it } from 'vitest';
import {
  VeniceAPIError,
  normalizeError,
  readDesktopErrorBody,
  readWebErrorBody,
  readVeniceErrorBody
} from './errors';

describe('VeniceClient Errors', () => {
  it('should create VeniceAPIError', () => {
    const err = new VeniceAPIError('Test legacy error', 404);
    expect(err.message).toBe('Test legacy error');
    expect(err.status).toBe(404);
    expect(err.name).toBe('VeniceAPIError');
  });

  describe('normalizeError', () => {
    it('should normalize known status codes', () => {
      expect(normalizeError(400, 'Bad Request')).toBe('400 request/schema/model error: Bad Request');
      expect(normalizeError(429, '')).toBe('429 rate limit: Request failed');
    });

    it('should handle unknown status codes', () => {
      expect(normalizeError(418, 'I am a teapot')).toBe('I am a teapot');
      expect(normalizeError(null, '')).toBe('Request failed');
    });
  });

  describe('readDesktopErrorBody', () => {
    it('should extract error message from simple object', () => {
      expect(readDesktopErrorBody({ error: 'Direct error' })).toBe('Direct error');
      expect(readDesktopErrorBody({ message: 'Direct message' })).toBe('Direct message');
      expect(readDesktopErrorBody({ error: { message: 'Nested message' } })).toBe('Nested message');
    });

    it('should handle non-object inputs', () => {
      expect(readDesktopErrorBody(null)).toBe('Unknown Venice API error');
      expect(readDesktopErrorBody('String error')).toBe('String error');
    });

    it('should handle validation details', () => {
      expect(readDesktopErrorBody({ details: { _errors: ['Top level validation'] } })).toBe('Top level validation');
      expect(readDesktopErrorBody({ details: { field1: { _errors: ['Field validation'] } } })).toBe('field1: Field validation');
      expect(readDesktopErrorBody({ details: {} })).toBe('Request validation failed');
    });

    it('should handle complex nested error objects', () => {
       expect(readDesktopErrorBody({ error: { foo: 'bar' } })).toBe('{"foo":"bar"}');
    });
  });

  describe('readWebErrorBody', () => {
    it('should extract error message', () => {
      expect(readWebErrorBody({ error: 'Direct error' }, 'Raw text', 'Status')).toBe('Direct error');
      expect(readWebErrorBody(null, 'Raw text', 'Status')).toBe('Raw text');
      expect(readWebErrorBody(null, '', 'Status')).toBe('Status');
      expect(readWebErrorBody(null, '', '')).toBe('Unknown Venice API error');
    });
    it('should handle validation details', () => {
      expect(readWebErrorBody({ details: { field2: { _errors: ['Web field validation'] } } }, '', '')).toBe('field2: Web field validation');
    });
  });

  describe('readVeniceErrorBody', () => {
    it('should extract error message', () => {
      expect(readVeniceErrorBody({ error: 'Legacy error' })).toBe('Legacy error');
      expect(readVeniceErrorBody(null)).toBe('');
    });
    it('should handle validation details', () => {
      expect(readVeniceErrorBody({ details: { field3: { _errors: ['Legacy field validation'] } } })).toBe('field3: Legacy field validation');
    });
  });
});
