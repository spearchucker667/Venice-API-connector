import { describe, expect, it } from 'vitest';
import {
  cloneChatMediaReference,
  coerceToChatMediaReferenceArray,
  createChatMediaReference,
  isChatMediaReference,
  isChatMediaReferenceArray,
} from './conversation';

describe('conversation types', () => {
  it('should export the expected functions from conversationVault', () => {
    expect(typeof cloneChatMediaReference).toBe('function');
    expect(typeof coerceToChatMediaReferenceArray).toBe('function');
    expect(typeof createChatMediaReference).toBe('function');
    expect(typeof isChatMediaReference).toBe('function');
    expect(typeof isChatMediaReferenceArray).toBe('function');
  });
});
