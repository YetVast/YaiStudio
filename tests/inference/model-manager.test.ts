import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalModelManager } from '@/lib/inference/model-manager';
import { LOCAL_MODEL_CATALOG } from '@/lib/inference/local-model-registry';

describe('Milestone 7 — Local Model Lifecycle Management', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key in store) {
      delete store[key];
    }

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key in store) {
          delete store[key];
        }
      },
    });
  });

  it('lists models from catalog with initial not_downloaded status', () => {
    const records = LocalModelManager.getModelRecords();
    expect(records.length).toBe(LOCAL_MODEL_CATALOG.length);
    for (const r of records) {
      expect(r.status).toBe('not_downloaded');
      expect(r.progressPercent).toBe(0);
    }
  });

  it('installs model with progress streaming and marks status as ready', async () => {
    const modelId = 'gemma-2-2b-it-int4';
    const progressUpdates: number[] = [];

    const finalRecord = await LocalModelManager.installModel(modelId, (update) => {
      progressUpdates.push(update.progressPercent);
    });

    expect(finalRecord.status).toBe('ready');
    expect(finalRecord.progressPercent).toBe(100);
    expect(finalRecord.installedAt).toBeDefined();
    expect(progressUpdates.length).toBeGreaterThan(5);

    const record = LocalModelManager.getRecord(modelId);
    expect(record?.status).toBe('ready');
  });

  it('deletes installed model and reclaims status to not_downloaded', async () => {
    const modelId = 'gemma-2-2b-it-int4';
    await LocalModelManager.installModel(modelId);

    await LocalModelManager.deleteModel(modelId);
    const record = LocalModelManager.getRecord(modelId);
    expect(record?.status).toBe('not_downloaded');
  });
});
