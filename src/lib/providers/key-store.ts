/**
 * YAI Studio — Provider Key Store (server-only)
 *
 * Manages user-supplied BYOK (Bring Your Own Key) credentials for cloud AI providers.
 *
 * Delegated to `@/lib/storage/credential-vault`:
 * - Persistent across Vercel serverless lambda restarts (Vercel KV REST + Encrypted Cookie fallback)
 * - Strict per-user isolation by `yvUserId`
 * - AES-256-GCM encryption at rest
 * - Zero plaintext leakage to browser bundles, responses, or logs
 *
 * @module lib/providers/key-store
 */
import 'server-only';

export {
  storeProviderKey,
  getProviderKey,
  getProviderKeyStatus,
  listConfiguredProviders,
  deleteProviderKey,
  maskKey,
  type ProviderKeyStatus,
} from '@/lib/storage/credential-vault';
