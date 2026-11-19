# YAI Studio V1 — Local Inference & LiteRT-LM Evaluation

---

## 1. Local Inference Objectives

Local inference enables YAI Studio users to generate responses, query personal memory, and summarize conversations strictly on their client device without transmitting prompt data across the network.

Key requirements:
1. Zero outbound network traffic during local generation.
2. WebGPU / WASM browser runtime execution.
3. No silent cloud fallback: if local execution fails, report the error honestly to the user.
4. User consent for model downloads with clear storage quota warnings.

---

## 2. LiteRT-LM Browser Runtime Assessment

### Initial Runtime Findings:
- **Runtime Identity**: LiteRT (formerly TensorFlow Lite) is Google's high-performance runtime for on-device ML.
- **LiteRT-LM**: Specialized LLM execution engine targeting Gemma, Phi, and other small language models.
- **Browser Execution Path**:
  - WebAssembly (WASM) for CPU inference fallback.
  - WebGPU for accelerated tensor computation on client GPUs.
- **Model Candidate**: Gemma 2B-IT / Gemma 2 2B INT4 quantized weights (~1.4 GB to 1.8 GB).
- **Storage Strategy**: Origin Private File System (OPFS) for persistent model weight caching without exhausting standard IndexedDB memory limits.

---

## 3. Hardware & Browser Capability Matrix

| Feature | Requirement | Fallback / Behavior |
| :--- | :--- | :--- |
| **WebGPU** | `navigator.gpu` available and requestAdapter succeeds | Fallback to WASM if viable, or flag device as unsupported |
| **Available Storage** | At least 3.0 GB free disk space reported via `navigator.storage.estimate()` | Prohibit download until sufficient disk quota is freed |
| **Device RAM** | Minimum 4 GB system memory recommended | Warn user on constrained devices |
| **Integrity Check** | SHA-256 hash match against verified manifest | Abort model load if hash verification fails |
