import { describe, it, expect } from 'vitest';
import {
  isImageEditModel,
  isImageGenerateModel,
  isVideoModel,
  isAudioMusicModel,
  isAudioTtsModel,
  resolveModelSizingMode,
} from '../capabilities';

describe('Model Capabilities', () => {
  describe('Image Edit vs Image Generate', () => {
    it('identifies inpaint models from explicit type', () => {
      expect(isImageEditModel({ id: 'custom-model', type: 'inpaint' })).toBe(true);
      expect(isImageEditModel({ id: 'custom-model', model_type: 'image-edit' })).toBe(true);
    });

    it('identifies inpaint models from traits or capabilities', () => {
      expect(isImageEditModel({ id: 'custom-model', traits: ['inpaint'] })).toBe(true);
      expect(isImageEditModel({ id: 'custom-model', model_spec: { capabilities: { supportsInpaint: true } } })).toBe(true);
    });

    it('identifies known edit model IDs', () => {
      expect(isImageEditModel('firered-image-edit')).toBe(true);
      expect(isImageEditModel('seedream-v5-pro-edit')).toBe(true);
      expect(isImageEditModel('qwen-edit')).toBe(true);
      expect(isImageEditModel('nano-banana-2-edit')).toBe(true);
    });

    it('does not classify general text-to-image Flux or SDXL as edit models', () => {
      expect(isImageEditModel('flux-dev')).toBe(false);
      expect(isImageEditModel('lustify-sdxl')).toBe(false);
      expect(isImageEditModel('nano-banana-pro')).toBe(false);
      expect(isImageEditModel('seedream-v5-pro')).toBe(false);
    });

    it('correctly discriminates text-to-image models', () => {
      expect(isImageGenerateModel('flux-dev')).toBe(true);
      expect(isImageGenerateModel('firered-image-edit')).toBe(false);
    });
  });

  describe('Video and Audio Model Detection', () => {
    it('identifies video models', () => {
      expect(isVideoModel('seedance-v1')).toBe(true);
      expect(isVideoModel('wan-2-1-t2v-480p')).toBe(true);
      expect(isVideoModel({ id: 'custom-vid', type: 'video' })).toBe(true);
      expect(isVideoModel('flux-dev')).toBe(false);
    });

    it('identifies audio music and tts models', () => {
      expect(isAudioMusicModel('stable-audio')).toBe(true);
      expect(isAudioMusicModel({ id: 'custom-music', traits: ['music'] })).toBe(true);
      expect(isAudioMusicModel('tts-kokoro')).toBe(false);

      expect(isAudioTtsModel('tts-kokoro')).toBe(true);
      expect(isAudioTtsModel({ id: 'custom-voice', type: 'tts' })).toBe(true);
      expect(isAudioTtsModel('stable-audio')).toBe(false);
    });
  });

  describe('Sizing Mode Resolution', () => {
    it('resolves aspectResolution when model constraints have both aspect ratios and resolutions', () => {
      const mode = resolveModelSizingMode('nano-banana-v1', {
        aspect_ratios: ['1:1', '16:9'],
        resolutions: ['720p', '1080p'],
      });
      expect(mode).toBe('aspectResolution');
    });

    it('resolves aspectRatio when only aspect ratios are present', () => {
      const mode = resolveModelSizingMode('seedream-v5-pro', {
        aspect_ratios: ['1:1', '16:9'],
      });
      expect(mode).toBe('aspectRatio');
    });

    it('defaults to widthHeight for pixel-based models without aspect ratios', () => {
      const mode = resolveModelSizingMode('flux-dev', {});
      expect(mode).toBe('widthHeight');
    });
  });
});
