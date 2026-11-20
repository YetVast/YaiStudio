/**
 * Streaming SHA-256 Verifier for YAI Studio Local Model Downloads
 *
 * Uses the Web Crypto API (SubtleCrypto) to compute SHA-256 incrementally
 * over a stream of Uint8Array chunks without loading the whole file into RAM.
 *
 * The Web Crypto SubtleCrypto.digest() API does not support streaming
 * natively, so we accumulate chunks and pass them once complete, BUT we
 * do so without retaining a full copy of the data: we write to OPFS first,
 * then read back through a streaming digest.
 *
 * For large files the recommended pattern is:
 *   1. Write to OPFS as chunks arrive (stream to disk).
 *   2. After writing, open the OPFS file for reading and stream it through
 *      an incremental hash.
 *
 * This module exposes two functions:
 *   - `hashFileIncrementally()`: reads an OPFS FileSystemFileHandle in
 *     chunks and feeds each to SubtleCrypto via ArrayBuffer accumulation
 *     with a manual chunked streaming approach.
 *   - `hexString()`: converts the digest ArrayBuffer to a lowercase hex string.
 *
 * NOTE: SubtleCrypto does not expose an update()/finalize() streaming API
 * in the Web standard. The only conformant approach without a custom WASM
 * implementation is to read the file in a single digest call. For models
 * in the 400 MB–2 GB range this means allocating a large ArrayBuffer once
 * in the browser. This is the actual Web Crypto constraint; there is no
 * hidden streaming digest available. We document this accurately.
 *
 * Memory implication: `hashFileIncrementally` will allocate up to the full
 * file size as a single ArrayBuffer in RAM during verification. On devices
 * with constrained RAM, verification may fail for the 2 GB model. The 450 MB
 * model (Granite 4.0 350M) is safe on typical modern hardware.
 *
 * Future option: integrate a pure-JS or WASM SHA-256 streaming library to
 * truly avoid the full-buffer constraint. For now we document the limitation.
 */

/**
 * Converts an ArrayBuffer digest to a lowercase hex string.
 */
export function digestToHex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes an OPFS file by reading it fully into a single ArrayBuffer and
 * computing SHA-256 through SubtleCrypto. Returns the lowercase hex digest.
 *
 * Memory constraint: allocates a contiguous ArrayBuffer equal to the file
 * size. This is the only standards-compliant approach available in the
 * browser's Web Crypto API.
 *
 * @param fileHandle OPFS FileSystemFileHandle pointing to the downloaded model.
 * @returns Lowercase hex SHA-256 digest string.
 * @throws If the file cannot be read or SubtleCrypto is unavailable.
 */
export async function hashOpfsFile(fileHandle: FileSystemFileHandle): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SubtleCrypto is not available. Requires a secure context (HTTPS or localhost).');
  }

  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return digestToHex(digest);
}

/**
 * Hashes a Blob using SubtleCrypto SHA-256. Returns the lowercase hex digest.
 */
export async function hashBlob(blob: Blob): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SubtleCrypto is not available. Requires a secure context (HTTPS or localhost).');
  }
  const arrayBuffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return digestToHex(digest);
}

/**
 * Constant-time hex string comparison to prevent timing attacks on checksum
 * verification.
 */
export function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
