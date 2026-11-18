# YAI Studio — Personal Intelligence Data Model

## 1. Repository boundary

Each user owns a private GitHub repository named exactly:

`YVSApps_Data_YaiStudio`

The repository is separate from the application source repository `yaistudio`. It stores the user's private YAI data and must never contain source-code secrets, OAuth tokens, provider API keys or server credentials.

The repository is created only after an explicit user action. If missing, show the required setup message and a create-private-repository action.

## 2. Design principles transferred from Cogmit

Transfer these principles, not Cogmit's domain model:
- filesystem represents user-visible hierarchy;
- durable objects have clear directories;
- Markdown is human-readable;
- JSON stores structured metadata;
- a global index is a navigation aid, not a second database;
- object identity is separate from current path;
- Git history is the version history;
- reads do not silently mutate;
- define canonical content when multiple representations exist.

Do not use RootCog, ChildCog, NPPCogs, `cogsIndex.json`, `deletedCogs/` or the 57-day Cog deletion policy as YAI concepts.

## 3. Proposed initial repository layout

```text
YVSApps_Data_YaiStudio/
├── README.md
├── yaiManifest.json
├── conversationsIndex.json
├── workspaces/
│   └── <Workspace Name>/
│       ├── workspaceData.json
│       ├── <Nested Workspace Name>/
│       │   ├── workspaceData.json
│       │   └── <ConversationId>/
│       │       ├── conversation.json
│       │       ├── messages.json
│       │       └── conversation.md
│       └── <ConversationId>/
│           ├── conversation.json
│           ├── messages.json
│           └── conversation.md
├── unfiledConversations/
│   └── <ConversationId>/
│       ├── conversation.json
│       ├── messages.json
│       └── conversation.md
├── memory/
│   ├── facts.json
│   ├── preferences.json
│   ├── interests.json
│   ├── goals.json
│   ├── relationships.json
│   ├── decisions.json
│   ├── candidates/
│   └── memoryChanges/
├── knowledge/
│   ├── topics/
│   └── references/
├── activity/
│   └── YYYY/
│       └── MM/
│           └── <productId>/
│               └── <eventId>.json
├── intelligence/
│   ├── memory-index.json
│   ├── relationships.json
│   └── manifest.json
└── exports/
```

This is the proposed YAI v0 layout. Validate exact schemas before writing production user data. Avoid creating empty folders merely to match a diagram; create required folders/files during the explicit initialization operation.

## 4. Workspace hierarchy

A workspace is represented by a directory. A workspace may contain:
- `workspaceData.json`;
- conversation directories belonging immediately to it;
- nested workspace directories.

There is no `conversations/` folder layer inside each workspace unless a later measured requirement justifies it. Nested workspaces may be arbitrarily deep. Folder path represents hierarchy; `workspaceData.json` stores metadata not already represented by the path.

Workspace names must be validated for safe path use, reserved names, collisions and cross-platform compatibility. Do not impose Cogmit's 57-character project-name limit without a YAI-specific decision.

## 5. Conversation object

Each conversation has a stable ID independent of its current path.

- `conversation.json`: conversation metadata (ID, title, created/updated timestamps, current workspace/path, status, model/provider reference and retention metadata).
- `messages.json`: canonical structured ordered message records (role, content, sequence, timestamp, attachments/references where supported, model/provider metadata).
- `conversation.md`: generated human-readable projection/export of `messages.json`; it is not independently editable or authoritative.

**Canonical source:** `messages.json`. Markdown is generated from it. This prevents dual-source drift.

A conversation may live directly in a workspace or in `unfiledConversations/`. Moving it changes its path and the corresponding index entry; its stable ID remains unchanged.

## 6. Global index

`conversationsIndex.json` is a flat list of conversation navigation records:
- conversation ID;
- title;
- immediate workspace name or `null`;
- actual repository-relative path;
- updated timestamp if required for sorting.

It is not a duplicate workspace tree and is not the source of conversation content. Nested hierarchy is represented by directories and paths.

The index must be kept consistent with conversation moves, creation and deletion. Define recoverability/rebuild behavior. Do not claim multi-file atomicity if GitHub operations are not atomic.

## 7. Memory records

Separate:
- raw interaction/activity;
- retrieved context;
- memory candidate;
- accepted persistent memory;
- memory change event.

A candidate is not a memory. Each accepted memory should have a stable ID, type, value/content, source/provenance, created/updated time, status and any approved confidence/validity fields.

User approval is the default v0 acceptance policy. Do not turn every question into a permanent memory. Avoid storing sensitive data unless the user explicitly chooses to retain it and the product's privacy policy supports it.

## 8. Activity records

Use partitioned immutable event files by year/month/product rather than one frequently rewritten `activity.json`.

An event can record:
- event/request ID;
- timestamp;
- source product;
- user query or summary subject to retention setting;
- answer or summary subject to retention setting;
- retrieved memory/knowledge IDs;
- provider/model and execution mode;
- memory candidates;
- resulting memory changes.

## 9. Git history, deletion and export

Git provides file history but ordinary file deletion does not erase old commits or existing clones. Distinguish:
- archive;
- remove from current Personal Intelligence;
- permanent history purge (not a v0 promise).

Do not import Cogmit's 57-day lifecycle. Permanent deletion/history rewriting requires a separately approved design.

Users should be able to clone the private repository and understand its structure through README and schemas. Export should not include credentials.

## 10. GitHub API operational rules

- GitHub Contents API updates/deletes require the current file SHA.
- Concurrent writes to the same path can conflict.
- Serialize or batch mutations where necessary.
- Use retries only with idempotency/conflict handling.
- Handle rate limits and secondary rate limits.
- Do not rewrite a large conversation on every token streamed from a model; persist completed turns or controlled batches.
- Show unsaved/pending/saved/conflict states accurately.
- Keep a rebuildable index strategy documented.
