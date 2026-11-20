/**
 * Unit tests for the streaming SHA-256 verifier (sha256-stream.ts)
 *
 * These tests run in Vitest under Node.js. Node exposes the Web Crypto API
 * on the global `crypto` object since Node 19 / 20 (and as a polyfill via
 * `globalThis.crypto`). Vitest sets up a browser-like environment.
 */

import { describe, it, expect } from 'vitest';
import { digestToHex, constantTimeHexEqual } from '@/lib/inference/sha256-stream';

describe('SHA-256 Stream Utilities', () => {
  describe('digestToHex', () => {
    it('converts an empty digest buffer to a hex string of the right length', async () => {
      // SHA-256 of empty input is known
      const emptyBuf = new ArrayBuffer(32); // 32-byte all-zero buffer
      const hex = digestToHex(emptyBuf);
      expect(hex).toHaveLength(64);
      expect(hex).toMatch(/^[0-9a-f]+$/);
    });

    it('produces lowercase hex', () => {
      const buf = new Uint8Array([0xab, 0xcd, 0xef]).buffer;
      const hex = digestToHex(buf);
      expect(hex).toBe('abcdef');
    });

    it('pads single-hex-digit bytes correctly', () => {
      const buf = new Uint8Array([0x00, 0x0f, 0xff]).buffer;
      const hex = digestToHex(buf);
      expect(hex).toBe('000fff');
    });
  });

  describe('constantTimeHexEqual', () => {
    it('returns true for identical hex strings', () => {
      const a = 'a'.repeat(64);
      expect(constantTimeHexEqual(a, a)).toBe(true);
    });

    it('returns false for different hex strings of the same length', () => {
      const a = 'a'.repeat(64);
      const b = 'b'.repeat(64);
      expect(constantTimeHexEqual(a, b)).toBe(false);
    });

    it('returns false when lengths differ', () => {
      expect(constantTimeHexEqual('abc', 'abcd')).toBe(false);
    });

    it('detects a single-character difference', () => {
      const a = 'a'.repeat(63) + 'b';
      const b = 'a'.repeat(63) + 'c';
      expect(constantTimeHexEqual(a, b)).toBe(false);
    });
  });

  describe('Web Crypto SHA-256 integration', () => {
    it('computes the known SHA-256 of an empty buffer', async () => {
      // Known SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const knownEmpty = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const digest = await crypto.subtle.digest('SHA-256', new ArrayBuffer(0));
      expect(digestToHex(digest)).toBe(knownEmpty);
    });

    it('computes a deterministic digest for small input', async () => {
      const input = new TextEncoder().encode('YAI Studio local inference');
      const digest1 = await crypto.subtle.digest('SHA-256', input);
      const digest2 = await crypto.subtle.digest('SHA-256', input);
      expect(digestToHex(digest1)).toBe(digestToHex(digest2));
    });
  });
});
