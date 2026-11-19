# YAI Studio V0 — Data Model & Storage Specification

**Authoritative Repository:** `YVSApps_Data_YaiStudio`  
**Storage Provider:** GitHub REST API v3 (Contents API)  
**Schema Version:** 1  
**TypeScript Definitions:** [`src/types/personal-intelligence.ts`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/src/types/personal-intelligence.ts)  

---

## 1. Complete GitHub Repository Directory Structure

Every user of YAI Studio owns a private GitHub repository named exactly `YVSApps_Data_YaiStudio`. The complete directory hierarchy is structured as follows:

```text
YVSApps_Data_YaiStudio/
├── README.md                                  # Repository overview & attribution
├── yaiManifest.json                           # Repository schema manifest
├── conversationsIndex.json                    # Flat discovery index of all conversations
│
├── workspaces/                                # Hierarchical workspace directories
│   ├── <workspaceName>/                       # e.g. "YetVastSolutions", "Research"
│   │   ├── workspaceData.json                 # Workspace metadata (ID, title, description)
│   │   ├── <conversationId>/                  # Conversation folder (UUID v4)
│   │   │   ├── conversation.json              # Conversation metadata & model info
│   │   │   ├── messages.json                  # Canonical structured message history
│   │   │   └── conversation.md                # Generated human-readable transcript
│   │   └── <subWorkspaceName>/                # Nested workspace directory
│   │       ├── workspaceData.json
│   │       └── <conversationId>/
│   │           ├── conversation.json
│   │           ├── messages.json
│   │           └── conversation.md
│
├── unfiledConversations/                      # Conversations not assigned to any workspace
│   └── <conversationId>/
│       ├── conversation.json
│       ├── messages.json
│       └── conversation.md
│
├── memory/                                    # Structured Personal Memory categories
│   ├── facts.json                             # Verified facts and profile information
│   ├── preferences.json                       # Working preferences, coding styles, habits
│   ├── interests.json                         # Topics of curiosity, hobbies, research areas
│   ├── goals.json                             # Strategic objectives and milestones
│   ├── relationships.json                     # People, contacts, teams, and affiliations
│   ├── decisions.json                         # Recorded architectural and design decisions
│   └── candidates/                            # Proposed memories awaiting user review
│       ├── <candidateId>.json                 # Pending memory candidate
│       └── <candidateId>.json
│
├── knowledge/                                 # Reference notes and external links
│   └── references/
│       ├── <knowledgeId>.json                 # Individual reference item
│       └── <knowledgeId>.json
│
└── activity/                                  # Immutable partitioned activity ledger
    └── <YYYY>/                                # Year partition (e.g. "2026")
        └── <MM>/                              # Month partition (e.g. "11")
            └── <sourceProduct>/               # Originating product (e.g. "yai-studio", "cogmit")
                ├── <activityEventId>.json     # Interaction summary event
                └── <activityEventId>.json
```

---

## 2. JSON Schemas & Data Contracts

### 2.1 Repository Manifest (`yaiManifest.json`)
The root metadata file identifying the schema version and initialization timestamp.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "YaiManifest",
  "type": "object",
  "required": ["version", "createdAt", "updatedAt", "schemaVersion"],
  "properties": {
    "version": { "type": "string", "example": "1.0.0" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "schemaVersion": { "type": "integer", "minimum": 1, "example": 1 }
  }
}
```

*Example instance:*
```json
{
  "version": "1.0.0",
  "createdAt": "2026-11-19T10:00:00.000Z",
  "updatedAt": "2026-11-19T10:00:00.000Z",
  "schemaVersion": 1
}
```

---

### 2.2 Global Conversations Index (`conversationsIndex.json`)
Maintained at the root to allow fast discovery and search without recursively traversing directories.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ConversationsIndex",
  "type": "object",
  "required": ["schemaVersion", "updatedAt", "conversations"],
  "properties": {
    "schemaVersion": { "type": "integer", "example": 1 },
    "updatedAt": { "type": "string", "format": "date-time" },
    "conversations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title", "workspaceName", "path", "updatedAt"],
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "title": { "type": "string" },
          "workspaceName": { "type": ["string", "null"] },
          "path": { "type": "string" },
          "updatedAt": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

*Example instance:*
```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-19T10:30:00.000Z",
  "conversations": [
    {
      "id": "e4b2d189-9a2c-47b6-9df2-a39c91f0923e",
      "title": "V1 Architecture Strategy",
      "workspaceName": "Architecture",
      "path": "workspaces/Architecture/e4b2d189-9a2c-47b6-9df2-a39c91f0923e",
      "updatedAt": "2026-11-19T10:30:00.000Z"
    }
  ]
}
```

---

### 2.3 Workspace Metadata (`workspaces/<name>/workspaceData.json`)
Defines a logical workspace folder.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WorkspaceData",
  "type": "object",
  "required": ["id", "name", "createdAt", "updatedAt"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "maxLength": 100 },
    "description": { "type": "string" },
    "color": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
```

*Example instance:*
```json
{
  "id": "a189f32b-3120-4dc5-b461-9c878e8749a2",
  "name": "Ecosystem",
  "description": "Cross-product integrations and standards",
  "color": "#4B0084",
  "createdAt": "2026-11-19T08:00:00.000Z",
  "updatedAt": "2026-11-19T08:00:00.000Z"
}
```

---

### 2.4 Conversation Metadata (`conversation.json`)
Located inside the conversation directory.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ConversationMeta",
  "type": "object",
  "required": ["id", "title", "createdAt", "updatedAt", "workspacePath", "status"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "workspacePath": { "type": ["string", "null"] },
    "status": { "type": "string", "enum": ["active", "archived"] },
    "model": { "type": "string" },
    "provider": { "type": "string" }
  }
}
```

---

### 2.5 Canonical Structured Messages (`messages.json`)
The authoritative source of truth for conversational content.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MessagesFile",
  "type": "object",
  "required": ["conversationId", "messages"],
  "properties": {
    "conversationId": { "type": "string", "format": "uuid" },
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "sequence", "role", "content", "createdAt"],
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "sequence": { "type": "integer", "minimum": 1 },
          "role": { "type": "string", "enum": ["user", "assistant", "system"] },
          "content": { "type": "string" },
          "createdAt": { "type": "string", "format": "date-time" },
          "model": { "type": "string" },
          "provider": { "type": "string" },
          "tokenCount": { "type": "integer" }
        }
      }
    }
  }
}
```

*Example instance:*
```json
{
  "conversationId": "e4b2d189-9a2c-47b6-9df2-a39c91f0923e",
  "messages": [
    {
      "id": "7f89b65e-23a1-4321-9988-123456789abc",
      "sequence": 1,
      "role": "user",
      "content": "What are our primary goals for YAI Studio V1?",
      "createdAt": "2026-11-19T10:15:00.000Z"
    },
    {
      "id": "6d78a9bc-1234-5678-aaaa-bbbbccccdddd",
      "sequence": 2,
      "role": "assistant",
      "content": "YAI Studio V1 focuses on two key deliverables: an installable Progressive Web Application (PWA) and local LiteRT-LM execution.",
      "createdAt": "2026-11-19T10:15:04.000Z",
      "model": "anthropic/claude-3.5-sonnet",
      "provider": "openrouter",
      "tokenCount": 54
    }
  ]
}
```

---

### 2.6 Generated Markdown Projection (`conversation.md`)
Generated deterministically from `conversation.json` and `messages.json` using `generateConversationMarkdown()`:

```markdown
# V1 Architecture Strategy

- **ID:** `e4b2d189-9a2c-47b6-9df2-a39c91f0923e`
- **Created:** 2026-11-19T10:00:00.000Z
- **Updated:** 2026-11-19T10:15:04.000Z
- **Workspace:** `workspaces/Architecture`
- **Model:** anthropic/claude-3.5-sonnet (openrouter)
- **Status:** active

---

### User · 2026-11-19T10:15:00.000Z

What are our primary goals for YAI Studio V1?

---

### YAI Assistant · 2026-11-19T10:15:04.000Z · `anthropic/claude-3.5-sonnet`

YAI Studio V1 focuses on two key deliverables: an installable Progressive Web Application (PWA) and local LiteRT-LM execution.

---
```

---

### 2.7 Structured Personal Memory (`memory/<category>s.json`)
Maintains verified records across six categories (`facts.json`, `preferences.json`, `interests.json`, `goals.json`, `relationships.json`, `decisions.json`).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MemoryFile",
  "type": "object",
  "required": ["schemaVersion", "updatedAt", "records"],
  "properties": {
    "schemaVersion": { "type": "integer", "example": 1 },
    "updatedAt": { "type": "string", "format": "date-time" },
    "records": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "content", "status", "createdAt", "updatedAt"],
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "type": { "type": "string", "enum": ["fact", "preference", "interest", "goal", "relationship", "decision"] },
          "content": { "type": "string" },
          "source": { "type": "string" },
          "provenance": { "type": "string" },
          "status": { "type": "string", "enum": ["active", "archived", "rejected"] },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "createdAt": { "type": "string", "format": "date-time" },
          "updatedAt": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

*Example instance (`memory/preferences.json`):*
```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-19T09:00:00.000Z",
  "records": [
    {
      "id": "b7891234-5678-90ab-cdef-1234567890ab",
      "type": "preference",
      "content": "Prefers Next.js App Router, TypeScript, and strictly scoped CSS Modules without Tailwind.",
      "provenance": "User confirmed engineering standards",
      "status": "active",
      "createdAt": "2026-11-19T09:00:00.000Z",
      "updatedAt": "2026-11-19T09:00:00.000Z"
    }
  ]
}
```

---

### 2.8 Memory Candidate Review Queue (`memory/candidates/<id>.json`)
Individual files for proposed memories awaiting review:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MemoryCandidate",
  "type": "object",
  "required": ["id", "proposedType", "proposedContent", "proposedAt", "status"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "proposedType": { "type": "string", "enum": ["fact", "preference", "interest", "goal", "relationship", "decision"] },
    "proposedContent": { "type": "string" },
    "sourceActivityId": { "type": "string" },
    "sourceConversationId": { "type": "string" },
    "proposedAt": { "type": "string", "format": "date-time" },
    "status": { "type": "string", "enum": ["pending", "approved", "rejected"] },
    "reviewedAt": { "type": "string", "format": "date-time" }
  }
}
```

---

### 2.9 Partitioned Activity Ledger (`activity/<YYYY>/<MM>/<product>/<id>.json`)
Immutable records of user interactions across YVS applications:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ActivityEvent",
  "type": "object",
  "required": ["id", "timestamp", "sourceProduct", "executionMode"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "timestamp": { "type": "string", "format": "date-time" },
    "sourceProduct": { "type": "string", "example": "yai-studio" },
    "querySummary": { "type": "string" },
    "responseSummary": { "type": "string" },
    "model": { "type": "string" },
    "provider": { "type": "string" },
    "executionMode": { "type": "string", "enum": ["cloud", "local"] },
    "retrievedMemoryIds": { "type": "array", "items": { "type": "string" } },
    "memoryCandidateIds": { "type": "array", "items": { "type": "string" } },
    "resultingMemoryIds": { "type": "array", "items": { "type": "string" } }
  }
}
```

---

### 2.10 Knowledge References (`knowledge/references/<id>.json`)
Individual reference documents and research snippets:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "KnowledgeItem",
  "type": "object",
  "required": ["id", "title", "content", "createdAt", "updatedAt"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "content": { "type": "string" },
    "source": { "type": "string" },
    "sourceUrl": { "type": "string", "format": "uri" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
```

---

## 3. Storage Invariants & Security Rules

1. **Path Traversal Prevention:**
   All paths passed to storage functions are strictly checked by `preventPathTraversal(path)`:
   - Paths must not start with `/` (absolute path injection).
   - Paths must not contain `..` (parent traversal).
   - Paths must not match Windows drive prefixes (`C:`) or UNC paths (`\\\\`).
2. **Workspace Name Sanitization:**
   `sanitizeWorkspaceName(name)` strips unsafe filesystem characters (`/\\:*?"<>|#%&{}$!@+\`=`), collapses whitespace, truncates to 100 characters, and blocks reserved OS names (`con`, `prn`, `aux`, `nul`, `com1`, `lpt1`).
3. **Optimistic Concurrency & SHA Tracking:**
   Updates and deletions in GitHub require passing the exact current file SHA. If another request or manual commit has modified the file, GitHub returns `409 Conflict`, which `putFile()` catches and retries once with fresh SHA.
4. **Read Operations Never Mutate:**
   `getFile()`, `listDirectory()`, `getConversation()`, and `getMemory()` are strictly read-only. Missing files return `null` or empty arrays; they never trigger automatic creation or schema migration.
