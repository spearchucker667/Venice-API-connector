/**
 * @fileoverview Centralized response normalizers for Venice media operations.
 */

import type {
  AudioQueueResponseDto,
  AudioQuoteResponseDto,
  ImageGenerateResponseDto,
  SeedanceConsentChallenge,
  VideoQueueResponseDto,
  VideoQuoteResponseDto,
} from './types';

export function normalizeImageGenerateResponse(raw: unknown): {
  imagesBase64: string[];
} {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid image generation response structure.');
  }
  const dto = raw as ImageGenerateResponseDto;
  if (!Array.isArray(dto.images) || dto.images.length === 0) {
    throw new Error('Image generation response did not contain images.');
  }
  const imagesBase64: string[] = [];
  for (const item of dto.images) {
    if (typeof item === 'string') {
      imagesBase64.push(item);
    } else if (item && typeof item === 'object') {
      if (typeof item.b64_json === 'string' && item.b64_json.length > 0) {
        imagesBase64.push(item.b64_json);
      } else if (typeof item.url === 'string' && item.url.length > 0) {
        imagesBase64.push(item.url);
      }
    }
  }
  if (imagesBase64.length === 0) {
    throw new Error('No valid image data found in generation response.');
  }
  return { imagesBase64 };
}

export function normalizeVideoQuoteResponse(raw: unknown): { costUsd: number } {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid video quote response structure.');
  }
  const dto = raw as VideoQuoteResponseDto;
  const cost = dto.quote ?? dto.price ?? dto.cost;
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) {
    throw new Error('Video quote response did not contain a valid price.');
  }
  return { costUsd: cost };
}

export function normalizeVideoQueueResponse(raw: unknown): {
  model: string;
  queueId: string;
  downloadUrl?: string;
  status?: string;
} {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid video queue response structure.');
  }
  const dto = raw as VideoQueueResponseDto;
  const queueId = (dto.queue_id || dto.id || '').trim();
  if (!queueId) {
    throw new Error('Video queue response did not contain a valid queue_id.');
  }
  return {
    model: dto.model || '',
    queueId,
    downloadUrl: typeof dto.download_url === 'string' && dto.download_url.length > 0 ? dto.download_url : undefined,
    status: dto.status,
  };
}

export function normalizeAudioQuoteResponse(raw: unknown): { costUsd: number } {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid audio quote response structure.');
  }
  const dto = raw as AudioQuoteResponseDto;
  if (typeof dto.quote !== 'number' || !Number.isFinite(dto.quote) || dto.quote < 0) {
    throw new Error('Audio quote response did not contain a valid quote price.');
  }
  return { costUsd: dto.quote };
}

export function normalizeAudioQueueResponse(raw: unknown): {
  model: string;
  queueId: string;
  status?: string;
} {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid audio queue response structure.');
  }
  const dto = raw as AudioQueueResponseDto;
  const queueId = (dto.queue_id || dto.id || '').trim();
  if (!queueId) {
    throw new Error('Audio queue response did not contain a valid queue_id.');
  }
  return {
    model: dto.model || '',
    queueId,
    status: dto.status,
  };
}

export function normalizeSeedanceConsentChallenge(
  statusCode: number,
  body: unknown,
): SeedanceConsentChallenge | null {
  if (statusCode !== 409 || !body || typeof body !== 'object') {
    return null;
  }
  const record = body as Record<string, unknown>;
  const errorObj = record.error as Record<string, unknown> | undefined;
  if (
    record.consent_flow === 'seedance' ||
    errorObj?.code === 'needs_consent'
  ) {
    const faceRoles = Array.isArray(record.face_media_roles)
      ? (record.face_media_roles as SeedanceConsentChallenge['face_media_roles'])
      : undefined;
    const consentObj = record.consent && typeof record.consent === 'object'
      ? record.consent as Record<string, unknown>
      : undefined;

    return {
      error: {
        code: 'needs_consent',
        message: typeof errorObj?.message === 'string' ? errorObj.message : 'needs_consent',
      },
      consent_flow: 'seedance',
      face_media_roles: faceRoles,
      consent: {
        consent_version: typeof consentObj?.consent_version === 'string' ? consentObj.consent_version : undefined,
        policy_text: typeof consentObj?.policy_text === 'string' ? consentObj.policy_text : undefined,
      },
      docs_url: typeof record.docs_url === 'string' ? record.docs_url : undefined,
    };
  }
  return null;
}
