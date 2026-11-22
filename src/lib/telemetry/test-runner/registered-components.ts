/**
 * YAI Studio — Registered Component Catalog for Resource Accounting
 *
 * Exhaustive catalog of all registered components across all 8 architectural categories
 * specified in the YAI Studio telemetry specification:
 *   A. Model and inference resources
 *   B. Context and conversation resources
 *   C. Skills and knowledge resources
 *   D. Personal intelligence and memory resources
 *   E. Agent orchestration resources
 *   F. Tool and execution resources
 *   G. Application and infrastructure resources
 *   H. Response resources
 */

import type {
  ComponentResourceTelemetry,
  ComponentResourceStatus,
  MeasurementAccuracy,
} from './types';

export interface ComponentMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
  isAlwaysRegistered: boolean;
}

export const REGISTERED_COMPONENTS: readonly ComponentMetadata[] = [
  // ─── A. Model and Inference Resources ────────────────────────────
  {
    id: 'model_loading',
    name: 'Model Loading',
    category: 'Model and Inference',
    description: 'Memory and duration for loading model binary/tensors into execution memory',
    isAlwaysRegistered: true,
  },
  {
    id: 'model_weights',
    name: 'Model Weights Memory',
    category: 'Model and Inference',
    description: 'Resident memory buffers occupied by quantized model weights',
    isAlwaysRegistered: true,
  },
  {
    id: 'inference_runtime',
    name: 'Inference Runtime',
    category: 'Model and Inference',
    description: 'Execution engine runtime structures (WebGPU, Wasm, or native daemon)',
    isAlwaysRegistered: true,
  },
  {
    id: 'tokenizer',
    name: 'Tokenizer Memory',
    category: 'Model and Inference',
    description: 'Tokenizer vocabulary tables and token encoding structures',
    isAlwaysRegistered: true,
  },
  {
    id: 'prompt_processing',
    name: 'Prompt Processing (Prefill)',
    category: 'Model and Inference',
    description: 'Prompt evaluation, embedding lookup, and prefill phase compute',
    isAlwaysRegistered: true,
  },
  {
    id: 'kv_cache',
    name: 'KV Cache Memory',
    category: 'Model and Inference',
    description: 'Key-value cache memory buffers for attention sequence states',
    isAlwaysRegistered: true,
  },
  {
    id: 'attention_computation',
    name: 'Attention Computation',
    category: 'Model and Inference',
    description: 'Multi-head self-attention matrix multiplication compute and scratchpads',
    isAlwaysRegistered: true,
  },
  {
    id: 'token_generation',
    name: 'Token Generation (Decode)',
    category: 'Model and Inference',
    description: 'Autoregressive token generation loop and sampling',
    isAlwaysRegistered: true,
  },
  {
    id: 'output_decoding',
    name: 'Output Decoding',
    category: 'Model and Inference',
    description: 'Logit de-tokenization and text stream decoding',
    isAlwaysRegistered: true,
  },
  {
    id: 'execution_buffers',
    name: 'Inference Execution Buffers',
    category: 'Model and Inference',
    description: 'Temporary tensor compute buffers and scratchpad memory',
    isAlwaysRegistered: true,
  },

  // ─── B. Context and Conversation Resources ───────────────────────
  {
    id: 'system_instructions',
    name: 'System Instructions',
    category: 'Context and Conversation',
    description: 'System-level role, behavioral instructions, and identity constraints',
    isAlwaysRegistered: true,
  },
  {
    id: 'developer_instructions',
    name: 'Developer Instructions',
    category: 'Context and Conversation',
    description: 'Developer prompt overrides and runtime parameters',
    isAlwaysRegistered: true,
  },
  {
    id: 'user_prompt',
    name: 'User Prompt',
    category: 'Context and Conversation',
    description: 'Incoming user query text and prompt payload',
    isAlwaysRegistered: true,
  },
  {
    id: 'conversation_history',
    name: 'Conversation History',
    category: 'Context and Conversation',
    description: 'Prior turns and message history included in context',
    isAlwaysRegistered: true,
  },
  {
    id: 'context_assembly',
    name: 'Context Assembly',
    category: 'Context and Conversation',
    description: 'Formatting, message aggregation, and prompt template construction',
    isAlwaysRegistered: true,
  },
  {
    id: 'context_compression',
    name: 'Context Compression',
    category: 'Context and Conversation',
    description: 'Prompt compression or context compaction algorithms',
    isAlwaysRegistered: true,
  },
  {
    id: 'context_truncation',
    name: 'Context Truncation',
    category: 'Context and Conversation',
    description: 'Window sliding or token truncation to fit context capacity',
    isAlwaysRegistered: true,
  },
  {
    id: 'context_management',
    name: 'Context Management',
    category: 'Context and Conversation',
    description: 'Dynamic token budget management and context lifecycle',
    isAlwaysRegistered: true,
  },

  // ─── C. Skills and Knowledge Resources ───────────────────────────
  {
    id: 'skill_discovery',
    name: 'Skill Discovery',
    category: 'Skills and Knowledge',
    description: 'Scanning and matching available skills for query resolution',
    isAlwaysRegistered: true,
  },
  {
    id: 'skill_loading',
    name: 'Skill Loading',
    category: 'Skills and Knowledge',
    description: 'Loading matched skill instruction files and runtime handlers',
    isAlwaysRegistered: true,
  },
  {
    id: 'skill_execution',
    name: 'Skill Execution',
    category: 'Skills and Knowledge',
    description: 'Executing skill scripts or runtime transformations',
    isAlwaysRegistered: true,
  },
  {
    id: 'knowledge_retrieval',
    name: 'Knowledge Retrieval',
    category: 'Skills and Knowledge',
    description: 'Querying indexed knowledge repositories and document stores',
    isAlwaysRegistered: true,
  },
  {
    id: 'document_indexing',
    name: 'Document Indexing',
    category: 'Skills and Knowledge',
    description: 'Chunking and indexing documents into search structures',
    isAlwaysRegistered: true,
  },
  {
    id: 'embedding_generation',
    name: 'Embedding Generation',
    category: 'Skills and Knowledge',
    description: 'Neural embedding model execution for vector search',
    isAlwaysRegistered: true,
  },
  {
    id: 'vector_search',
    name: 'Vector Search',
    category: 'Skills and Knowledge',
    description: 'Approximate nearest neighbor similarity search',
    isAlwaysRegistered: true,
  },
  {
    id: 'retrieved_documents',
    name: 'Retrieved Documents',
    category: 'Skills and Knowledge',
    description: 'Buffer holding retrieved document chunks for prompt injection',
    isAlwaysRegistered: true,
  },
  {
    id: 'reranking',
    name: 'Reranking',
    category: 'Skills and Knowledge',
    description: 'Cross-encoder scoring and reranking of retrieved documents',
    isAlwaysRegistered: true,
  },

  // ─── D. Personal Intelligence and Memory Resources ───────────────
  {
    id: 'memory_retrieval',
    name: 'Memory Retrieval',
    category: 'Personal Intelligence',
    description: 'Fetching relevant user facts, preferences, and goals from storage',
    isAlwaysRegistered: true,
  },
  {
    id: 'memory_storage',
    name: 'Memory Storage',
    category: 'Personal Intelligence',
    description: 'Persisting new candidate memories or updating existing memory records',
    isAlwaysRegistered: true,
  },
  {
    id: 'memory_summarization',
    name: 'Memory Summarization',
    category: 'Personal Intelligence',
    description: 'Condensing conversation insights into concise user memory items',
    isAlwaysRegistered: true,
  },
  {
    id: 'context_graph_retrieval',
    name: 'Context Graph Retrieval',
    category: 'Personal Intelligence',
    description: 'Traversing personal intelligence context graph nodes',
    isAlwaysRegistered: true,
  },
  {
    id: 'relationship_resolution',
    name: 'Relationship Resolution',
    category: 'Personal Intelligence',
    description: 'Resolving entities and relational associations across memories',
    isAlwaysRegistered: true,
  },
  {
    id: 'goal_retrieval',
    name: 'Goal Retrieval',
    category: 'Personal Intelligence',
    description: 'Loading active user goals and tracking states',
    isAlwaysRegistered: true,
  },
  {
    id: 'decision_retrieval',
    name: 'Decision Retrieval',
    category: 'Personal Intelligence',
    description: 'Loading architectural and operational decisions ledger',
    isAlwaysRegistered: true,
  },
  {
    id: 'knowledge_graph_traversal',
    name: 'Knowledge Graph Traversal',
    category: 'Personal Intelligence',
    description: 'Graph search operations linking personal intelligence entities',
    isAlwaysRegistered: true,
  },
  {
    id: 'memory_consolidation',
    name: 'Memory Consolidation',
    category: 'Personal Intelligence',
    description: 'Deduplicating and consolidating candidate memories into accepted memories',
    isAlwaysRegistered: true,
  },

  // ─── E. Agent Orchestration Resources ────────────────────────────
  {
    id: 'agent_initialization',
    name: 'Agent Initialization',
    category: 'Agent Orchestration',
    description: 'Instantiating agent state machine and execution context',
    isAlwaysRegistered: true,
  },
  {
    id: 'task_planning',
    name: 'Task Planning',
    category: 'Agent Orchestration',
    description: 'Formulating step-by-step goal execution plan',
    isAlwaysRegistered: true,
  },
  {
    id: 'task_decomposition',
    name: 'Task Decomposition',
    category: 'Agent Orchestration',
    description: 'Splitting complex queries into sequential sub-tasks',
    isAlwaysRegistered: true,
  },
  {
    id: 'tool_selection',
    name: 'Tool Selection',
    category: 'Agent Orchestration',
    description: 'Evaluating available tool definitions against current task requirements',
    isAlwaysRegistered: true,
  },
  {
    id: 'tool_invocation',
    name: 'Tool Invocation',
    category: 'Agent Orchestration',
    description: 'Validating arguments and dispatching tool function calls',
    isAlwaysRegistered: true,
  },
  {
    id: 'execution_state',
    name: 'Execution State',
    category: 'Agent Orchestration',
    description: 'Tracking working memory, variables, and intermediate step outputs',
    isAlwaysRegistered: true,
  },
  {
    id: 'multi_agent_coordination',
    name: 'Multi-Agent Coordination',
    category: 'Agent Orchestration',
    description: 'Swarm / subagent message routing and role delegation',
    isAlwaysRegistered: true,
  },
  {
    id: 'retry_recovery',
    name: 'Retry & Recovery',
    category: 'Agent Orchestration',
    description: 'Handling model or tool errors with automatic retry strategies',
    isAlwaysRegistered: true,
  },
  {
    id: 'result_aggregation',
    name: 'Result Aggregation',
    category: 'Agent Orchestration',
    description: 'Synthesizing multiple step or agent outputs into final answer',
    isAlwaysRegistered: true,
  },

  // ─── F. Tool and Execution Resources ─────────────────────────────
  {
    id: 'filesystem_operations',
    name: 'Filesystem Operations',
    category: 'Tool and Execution',
    description: 'Reading, writing, or listing files in OPFS or local filesystem',
    isAlwaysRegistered: true,
  },
  {
    id: 'file_reads',
    name: 'File Reads',
    category: 'Tool and Execution',
    description: 'Payload reads from storage or attached context documents',
    isAlwaysRegistered: true,
  },
  {
    id: 'file_writes',
    name: 'File Writes',
    category: 'Tool and Execution',
    description: 'Persisting files or saving generated documents to storage',
    isAlwaysRegistered: true,
  },
  {
    id: 'terminal_execution',
    name: 'Terminal Execution',
    category: 'Tool and Execution',
    description: 'Executing shell scripts or commands in local sandbox',
    isAlwaysRegistered: true,
  },
  {
    id: 'browser_automation',
    name: 'Browser Automation',
    category: 'Tool and Execution',
    description: 'Headless or driver-based browser navigation and scraping',
    isAlwaysRegistered: true,
  },
  {
    id: 'api_requests',
    name: 'API Requests',
    category: 'Tool and Execution',
    description: 'HTTP/HTTPS requests sent to external REST or GraphQL endpoints',
    isAlwaysRegistered: true,
  },
  {
    id: 'database_queries',
    name: 'Database Queries',
    category: 'Tool and Execution',
    description: 'IndexedDB or local storage queries executed during operation',
    isAlwaysRegistered: true,
  },
  {
    id: 'external_connectors',
    name: 'External Connectors',
    category: 'Tool and Execution',
    description: 'Third-party SaaS connector integrations (Google Workspace, GitHub)',
    isAlwaysRegistered: true,
  },
  {
    id: 'child_processes',
    name: 'Child Processes',
    category: 'Tool and Execution',
    description: 'Spawning child processes or background daemon jobs',
    isAlwaysRegistered: true,
  },

  // ─── G. Application and Infrastructure Resources ─────────────────
  {
    id: 'frontend_memory',
    name: 'Frontend Application Heap',
    category: 'Application & Infrastructure',
    description: 'JavaScript heap memory consumed by UI components and React state',
    isAlwaysRegistered: true,
  },
  {
    id: 'backend_memory',
    name: 'Backend Runtime Memory',
    category: 'Application & Infrastructure',
    description: 'Server process or daemon memory footprint',
    isAlwaysRegistered: true,
  },
  {
    id: 'runtime_memory',
    name: 'Runtime Memory',
    category: 'Application & Infrastructure',
    description: 'Host memory dedicated to active AI runtime process',
    isAlwaysRegistered: true,
  },
  {
    id: 'cpu_utilization',
    name: 'CPU Utilization',
    category: 'Application & Infrastructure',
    description: 'Host CPU core utilization during inference and preparation',
    isAlwaysRegistered: true,
  },
  {
    id: 'cpu_execution_time',
    name: 'CPU Execution Time',
    category: 'Application & Infrastructure',
    description: 'Cumulative CPU time spent executing inference and processing',
    isAlwaysRegistered: true,
  },
  {
    id: 'gpu_utilization',
    name: 'GPU Utilization',
    category: 'Application & Infrastructure',
    description: 'WebGPU or hardware accelerator compute core saturation',
    isAlwaysRegistered: true,
  },
  {
    id: 'gpu_memory',
    name: 'GPU Memory (VRAM)',
    category: 'Application & Infrastructure',
    description: 'Dedicated GPU VRAM or shared unified memory allocation',
    isAlwaysRegistered: true,
  },
  {
    id: 'network_transfer',
    name: 'Network Bytes Transferred',
    category: 'Application & Infrastructure',
    description: 'Total network bytes sent and received during query execution',
    isAlwaysRegistered: true,
  },
  {
    id: 'cache_memory',
    name: 'Cache Memory',
    category: 'Application & Infrastructure',
    description: 'IndexedDB, OPFS, or memory caches retained in runtime',
    isAlwaysRegistered: true,
  },
  {
    id: 'background_workers',
    name: 'Background Worker Memory',
    category: 'Application & Infrastructure',
    description: 'Dedicated Web Workers, service workers, or background threads',
    isAlwaysRegistered: true,
  },
  {
    id: 'logging_telemetry_overhead',
    name: 'Logging & Telemetry Overhead',
    category: 'Application & Infrastructure',
    description: 'Memory and compute spent recording telemetry traces and logs',
    isAlwaysRegistered: true,
  },

  // ─── H. Response Resources ───────────────────────────────────────
  {
    id: 'response_composition',
    name: 'Response Composition',
    category: 'Response Resources',
    description: 'Assembling chunks or message blocks into structured response',
    isAlwaysRegistered: true,
  },
  {
    id: 'response_formatting',
    name: 'Response Formatting',
    category: 'Response Resources',
    description: 'Markdown parsing, code-block syntax highlighting, and sanitization',
    isAlwaysRegistered: true,
  },
  {
    id: 'response_streaming',
    name: 'Response Streaming',
    category: 'Response Resources',
    description: 'Buffer queue and stream iterator management during token delivery',
    isAlwaysRegistered: true,
  },
  {
    id: 'output_token_generation',
    name: 'Output Token Generation',
    category: 'Response Resources',
    description: 'Final decoded token sequence emitted to consumer',
    isAlwaysRegistered: true,
  },
  {
    id: 'response_serialization',
    name: 'Response Serialization',
    category: 'Response Resources',
    description: 'Serializing output message objects for persistence and UI state',
    isAlwaysRegistered: true,
  },
  {
    id: 'response_delivery',
    name: 'Response Delivery',
    category: 'Response Resources',
    description: 'Final rendering and presentation of output to user interface',
    isAlwaysRegistered: true,
  },
];

/**
 * Creates default telemetry record for a registered component.
 * If status is 'NOT_USED', consumption and duration are strictly set to 0.
 * If status is 'UNAVAILABLE' or 'NOT_SUPPORTED', consumption values are strictly null.
 */
export function createDefaultComponentTelemetry(
  meta: ComponentMetadata,
  status: ComponentResourceStatus = 'NOT_USED',
  source: string = 'system-accounting',
  accuracy: MeasurementAccuracy = 'EXACT'
): ComponentResourceTelemetry {
  const isNotUsed = status === 'NOT_USED';

  return {
    componentId: meta.id,
    componentName: meta.name,
    category: meta.category,
    status,
    memory: {
      allocatedBytes: isNotUsed ? 0 : null,
      residentBytes: isNotUsed ? 0 : null,
      peakBytes: isNotUsed ? 0 : null,
      incrementalBytes: isNotUsed ? 0 : null,
      retainedBytes: isNotUsed ? 0 : null,
      releasedBytes: isNotUsed ? 0 : null,
      sharedBytes: isNotUsed ? 0 : null,
    },
    compute: {
      cpuUtilizationPercent: isNotUsed ? 0 : null,
      cpuTimeMs: isNotUsed ? 0 : null,
      gpuUtilizationPercent: isNotUsed ? 0 : null,
      gpuTimeMs: isNotUsed ? 0 : null,
      gpuMemoryBytes: isNotUsed ? 0 : null,
    },
    timing: {
      startedAt: null,
      endedAt: null,
      durationMs: isNotUsed ? 0 : null,
    },
    tokens: {
      input: isNotUsed ? 0 : null,
      output: isNotUsed ? 0 : null,
    },
    measurement: {
      source,
      method: isNotUsed ? 'uninvoked-component-baseline' : 'runtime-probe',
      accuracy: isNotUsed ? 'EXACT' : accuracy,
    },
  };
}

/**
 * Builds the initial telemetry array with all registered components pre-populated.
 */
export function buildInitialComponentsTelemetry(): ComponentResourceTelemetry[] {
  return REGISTERED_COMPONENTS.map((meta) => createDefaultComponentTelemetry(meta, 'NOT_USED'));
}
