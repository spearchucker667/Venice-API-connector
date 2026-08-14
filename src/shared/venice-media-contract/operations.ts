/**
 * @fileoverview Canonical Venice media operations registry.
 * Strictly defines supported operations matching upstream Venice API capabilities.
 */

export const VENICE_MEDIA_OPERATIONS = [
  'image.generate',
  'image.edit',
  'image.multi_edit',
  'image.upscale',
  'image.background_remove',
  'video.quote',
  'video.queue',
  'video.retrieve',
  'video.complete',
  'video.transcribe',
  'audio.quote',
  'audio.queue',
  'audio.retrieve',
  'audio.complete',
  'audio.tts',
  'audio.voice_clone',
  'audio.transcribe',
] as const;

export type VeniceMediaOperation = (typeof VENICE_MEDIA_OPERATIONS)[number];

export function isVeniceMediaOperation(value: unknown): value is VeniceMediaOperation {
  return typeof value === 'string' && VENICE_MEDIA_OPERATIONS.includes(value as VeniceMediaOperation);
}
