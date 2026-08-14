import { describe, it, expect } from 'vitest';
import {
  normalizeImageGenerateResponse,
  normalizeVideoQuoteResponse,
  normalizeVideoQueueResponse,
  normalizeAudioQuoteResponse,
  normalizeAudioQueueResponse,
  normalizeSeedanceConsentChallenge,
} from '../response-normalizers';

describe('Response Normalizers', () => {
  it('normalizes image generation response from strings or b64_json', () => {
    const raw1 = { images: ['base64string1', 'base64string2'] };
    expect(normalizeImageGenerateResponse(raw1).imagesBase64).toEqual(['base64string1', 'base64string2']);

    const raw2 = { images: [{ b64_json: 'base64obj' }] };
    expect(normalizeImageGenerateResponse(raw2).imagesBase64).toEqual(['base64obj']);
  });

  it('normalizes video and audio quote prices', () => {
    expect(normalizeVideoQuoteResponse({ quote: 0.05 }).costUsd).toBe(0.05);
    expect(normalizeVideoQuoteResponse({ price: 0.08 }).costUsd).toBe(0.08);
    expect(normalizeAudioQuoteResponse({ quote: 0.02 }).costUsd).toBe(0.02);
  });

  it('normalizes video queue responses and extracts download_url', () => {
    const raw = {
      model: 'seedance-v1',
      queue_id: 'q-12345',
      download_url: 'https://cdn.venice.ai/video/q-12345.mp4?signed=token',
    };
    const norm = normalizeVideoQueueResponse(raw);
    expect(norm.model).toBe('seedance-v1');
    expect(norm.queueId).toBe('q-12345');
    expect(norm.downloadUrl).toBe('https://cdn.venice.ai/video/q-12345.mp4?signed=token');
  });

  it('normalizes audio queue response', () => {
    const raw = { model: 'stable-audio', queue_id: 'q-aud-999', status: 'QUEUED' };
    const norm = normalizeAudioQueueResponse(raw);
    expect(norm.model).toBe('stable-audio');
    expect(norm.queueId).toBe('q-aud-999');
  });

  describe('Seedance Consent Challenge (409)', () => {
    it('extracts Seedance consent challenge with policy_text', () => {
      const challengeBody = {
        error: {
          code: 'needs_consent',
          message: 'Seedance face consent is required before generating face-driven video.',
        },
        consent_flow: 'seedance',
        face_media_roles: ['image'],
        consent: {
          consent_version: '2026-08-01',
          policy_text: 'By checking this box, you confirm that you have rights to use this face image.',
        },
        docs_url: 'https://docs.venice.ai/guides/media/seedance-face-consent',
      };

      const parsed = normalizeSeedanceConsentChallenge(409, challengeBody);
      expect(parsed).not.toBeNull();
      expect(parsed?.consent_flow).toBe('seedance');
      expect(parsed?.face_media_roles).toEqual(['image']);
      expect(parsed?.consent?.policy_text).toContain('By checking this box');
      expect(parsed?.docs_url).toBe('https://docs.venice.ai/guides/media/seedance-face-consent');
    });

    it('returns null if status is not 409 or body is not consent challenge', () => {
      expect(normalizeSeedanceConsentChallenge(200, {})).toBeNull();
      expect(normalizeSeedanceConsentChallenge(400, { error: 'Bad Request' })).toBeNull();
    });
  });
});
