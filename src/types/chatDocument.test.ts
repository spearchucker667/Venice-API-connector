import { describe, expect, it } from 'vitest';
import { isChatDocumentRef } from './chatDocument';

describe('isChatDocumentRef', () => {
  it('should return true for a valid ChatDocumentRef', () => {
    expect(isChatDocumentRef({
      documentId: 'doc1',
      projectId: 'proj1',
      relativePath: 'path/to/doc.md',
      displayName: 'Document',
      format: 'md',
      revisionId: 'rev1'
    })).toBe(true);
  });

  it('should return false for invalid or missing fields', () => {
    expect(isChatDocumentRef(null)).toBe(false);
    expect(isChatDocumentRef(undefined)).toBe(false);
    expect(isChatDocumentRef({})).toBe(false);
    
    // Missing fields
    expect(isChatDocumentRef({
      projectId: 'proj1',
      relativePath: 'path/to/doc.md',
      displayName: 'Document',
      format: 'md',
      revisionId: 'rev1'
    })).toBe(false);
    
    // Empty strings
    expect(isChatDocumentRef({
      documentId: '',
      projectId: 'proj1',
      relativePath: 'path/to/doc.md',
      displayName: 'Document',
      format: 'md',
      revisionId: 'rev1'
    })).toBe(false);
    
    // Invalid format
    expect(isChatDocumentRef({
      documentId: 'doc1',
      projectId: 'proj1',
      relativePath: 'path/to/doc.md',
      displayName: 'Document',
      format: 'invalid',
      revisionId: 'rev1'
    })).toBe(false);
  });
});
