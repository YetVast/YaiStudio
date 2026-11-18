# Cogmit GitHub Private Storage — Complete Folder-Structure Reference

**Purpose:** Document the Cogmit GitHub-backed private storage model in sufficient detail to use it as an architectural reference while designing YAI Studio's storage of user questions and AI answers in Markdown and JSON files.

**Source basis:**
- `Cogmit_in_Github_invariants.md` — current GitHub design record and its agreed structure.
- `Cogmit_GitHub_Complete_Discussion.md` — detailed discussion, rationale, deferred items, and architecture-status qualifications.
- `COGMIT_CONCEPT_HERITAGE_FROM_OLD_DESIGN.md` — durable Cogmit domain concepts retained from the earlier design.

**Important architecture-status warning:** The GitHub documents describe a candidate/current GitHub-first implementation direction and explicitly state that they do not silently supersede the older locked Phase-1 Google Drive + Firestore architecture. The older Phase-1 invariants remain authoritative unless explicitly superseded. This document explains the GitHub model as a reference; it does not declare that the original Phase-1 architecture has been replaced.

---

## 1. Executive model

Cogmit's GitHub design uses the repository filesystem to represent the user's private content hierarchy. Markdown stores primary cognition content, small JSON files store domain metadata and collections, one global JSON index supports navigation and discovery, and Git stores historical versions.

The central design principle is:

> Use the filesystem for structure, Markdown for cognition, small JSON files for domain metadata, one global `cogsIndex.json` for navigation, and Git for history.

The conceptual hierarchy is:

```text
User
└── GitHub account / repository
    └── Project
        └── RootCog
            └── ChildCogs
```

Projects can be nested arbitrarily. A RootCog may be inside any level of a Project hierarchy or may have no parent Project at all. The latter is an **NPPCog** (No Parent Project Cog).

---

## 2. Repository root structure

The agreed current repository shape is:

```text
cogmit/
├── cogsIndex.json
├── projects/
└── NPPCogs/
```

A future deletion-storage location is also named:

```text
cogmit/
├── cogsIndex.json
├── projects/
├── NPPCogs/
└── deletedCogs/          # future/later-sprint concept
```

### Root-level responsibilities

| Path | Responsibility | Status |
|---|---|---|
| `cogsIndex.json` | Single global RootCog navigation/discovery index | Current agreed design |
| `projects/` | Container for Project directories | Current agreed design |
| `NPPCogs/` | Container for RootCogs with no parent Project | Current agreed design; exact casing matters |
| `deletedCogs/` | Future physical location for deleted RootCogs | Named and conceptually agreed; mechanics deferred |

Do not infer additional root-level folders from this design. In particular, it does not specify a separate database folder, a per-project index directory, or a `cogs/` folder inside Projects.

---

## 3. Projects and nested Projects

A Project is represented directly by a directory. A Project directory can contain three kinds of things:

1. `projectData.json` — metadata for that Project.
2. RootCog directories belonging immediately to that Project.
3. Nested Project directories (subprojects).

There is deliberately **no `cogs/` subdirectory** inside a Project.

Example:

```text
projects/
└── Current Affairs/
    ├── projectData.json
    ├── rootCog-001/
    │   ├── rootCog.md
    │   ├── rootCogInfo.json
    │   └── children.json
    ├── Geopolitics/
    │   ├── projectData.json
    │   ├── rootCog-002/
    │   │   ├── rootCog.md
    │   │   ├── rootCogInfo.json
    │   │   └── children.json
    │   └── rootCog-003/
    │       ├── rootCog.md
    │       ├── rootCogInfo.json
    │       └── children.json
    └── Elections/
        ├── projectData.json
        └── rootCog-004/
            ├── rootCog.md
            ├── rootCogInfo.json
            └── children.json
```

In this example:
- `Current Affairs` is a Project.
- `Geopolitics` and `Elections` are nested Projects under `Current Affairs`.
- `rootCog-001` belongs directly to `Current Affairs`.
- `rootCog-002` and `rootCog-003` belong directly to `Geopolitics`.
- `rootCog-004` belongs directly to `Elections`.

The directory tree is the representation of the Project hierarchy. It is not separately duplicated as a Project tree in `cogsIndex.json`.

### 3.1 Arbitrary nesting

The design allows nested Projects at multiple levels:

```text
projects/
└── Current Affairs/
    ├── projectData.json
    └── International/
        ├── projectData.json
        └── Geopolitics/
            ├── projectData.json
            └── rootCog-005/
                ├── rootCog.md
                ├── rootCogInfo.json
                └── children.json
```

The full path records the hierarchy. The immediate parent Project of `rootCog-005` is `Geopolitics`; its ancestors are `International` and `Current Affairs`.

### 3.2 Project folder names and limits

- The folder name is the Project name, not a Project ID.
- Maximum Project title/name length: **57 characters**.
- A separate Project ID is not introduced without a concrete requirement.
- Two Projects may have the same name in different branches because their full paths distinguish them. For example, `Current Affairs/Elections/` and `Movies/Elections/` are different Project locations.
- The folder path is the authoritative structural identity/location of the Project.

### 3.3 `projectData.json`

Each Project may contain:

```text
projectData.json
```

It stores metadata belonging specifically to that Project. The directory name already supplies the Project name, so `projectData.json` should not redundantly duplicate the name merely because it is available. The exact JSON schema is deferred; do not invent required fields from the folder design alone.

Principle:

> Filesystem represents structural identity and hierarchy. JSON stores metadata that the filesystem cannot provide.

---

## 4. NPPCogs — RootCogs without a parent Project

**NPPCogs** means RootCogs with **No Parent Project**. The exact agreed top-level directory name is:

```text
NPPCogs/
```

Example:

```text
NPPCogs/
├── rootCog-101/
│   ├── rootCog.md
│   ├── rootCogInfo.json
│   └── children.json
└── rootCog-102/
    ├── rootCog.md
    ├── rootCogInfo.json
    └── children.json
```

Rules:
- NPPCogs are RootCogs, not a special kind of Project.
- No synthetic or placeholder Project is required for them.
- Their `project` value in the global index is `null`.
- Their `path` begins with `NPPCogs/`.

Example index entry:

```json
{
  "id": "rootCog-101",
  "title": "An Unsorted Idea",
  "project": null,
  "path": "NPPCogs/rootCog-101"
}
```

---

## 5. RootCog directory — the primary content-storage unit

Every RootCog is represented as its own directory. The RootCog directory is the RootCog storage boundary and contains the canonical content, metadata, and its ChildCog collection.

Canonical structure:

```text
<RootCogId>/
├── rootCog.md
├── rootCogInfo.json
└── children.json
```

### 5.1 `rootCog.md`

- Canonical RootCog content file.
- Contains the actual human-readable cognition/content.
- The agreed filename is exactly `rootCog.md`, **not** `content.md`.
- Markdown is the primary human-readable representation.
- Markdown can be converted/extracted to plain text for runtime CIS/TTS processing; a duplicate `.txt` file is not required merely for TTS.

### 5.2 `rootCogInfo.json`

- Contains RootCog-specific metadata that does not belong in the Markdown body.
- The agreed filename is exactly `rootCogInfo.json`, not the earlier generic `info.json`.
- Do not use it to recreate data already available from the filesystem, Git history, or navigation index without a concrete domain need.
- The exact schema is not fully specified in the GitHub discussion.

### 5.3 `children.json`

- Contains the RootCog's ChildCogs as one collection.
- The current design intentionally prefers one `children.json` file over one file per ChildCog.
- Rationale: ChildCogs are expected often to be relatively small comments/notes; individual files would create additional filesystem and GitHub API operations.
- Detailed ChildCog schema, ID rules, lifecycle, promotion behavior, and sharding are deferred.
- Do not invent a per-ChildCog directory/file layout as if it were part of the current model.

### 5.4 RootCog title limit

Maximum RootCog title length: **77 characters**. The title is stored in the navigation index for efficient listing and search.

---

## 6. `cogsIndex.json` — the one global navigation index

There is exactly one global RootCog index by default, located at the repository root:

```text
cogsIndex.json
```

There are not separate Cog indexes inside Projects. There is no duplicate Project tree in the index.

### 6.1 Purpose

`cogsIndex.json` is a **navigation/discovery index**, not a second authoritative database. It supports:
- listing all RootCogs;
- grouping RootCogs by immediate Project;
- listing NPPCogs;
- central title/ID/Project search;
- opening a RootCog using its path;
- representing deleted RootCogs in the future lifecycle design.

It allows navigation/search without reading every `rootCog.md` or `rootCogInfo.json` file.

### 6.2 Active RootCog record

Each active RootCog record contains:
- `id` — RootCog identity;
- `title` — bounded display/search title;
- `project` — immediate parent Project name, or `null` for NPPCogs;
- `path` — actual RootCog directory path relative to the repository root.

Example:

```json
{
  "cogs": [
    {
      "id": "rootCog-001",
      "title": "Why Social Media Platforms Fail Long-Form Commentary",
      "project": "Geopolitics",
      "path": "projects/Current Affairs/Geopolitics/rootCog-001"
    },
    {
      "id": "rootCog-002",
      "title": "Thoughts on International Political Developments",
      "project": "Geopolitics",
      "path": "projects/Current Affairs/Geopolitics/rootCog-002"
    },
    {
      "id": "rootCog-101",
      "title": "An Unsorted Idea",
      "project": null,
      "path": "NPPCogs/rootCog-101"
    }
  ]
}
```

This is a conceptual active-record example, not a claim that every final top-level detail of the JSON schema has been finalized.

### 6.3 Why `project` and `path` both exist

`project` is the **immediate parent Project name**, not the full hierarchy. It is deliberately denormalized for common navigation operations such as “show all Cogs in Geopolitics.”

`path` is the actual storage location and carries the full hierarchy. It is needed to open the RootCog and to determine its full Project ancestry.

For example:

```json
{
  "project": "Geopolitics",
  "path": "projects/Current Affairs/International/Geopolitics/rootCog-001"
}
```

Here, `Geopolitics` is the immediate parent; `Current Affairs/International/Geopolitics` is the full hierarchy.

### 6.4 Why the index is flat with respect to RootCogs

The index contains RootCog records, not a nested Project tree. The application can reconstruct the Project tree from RootCog paths and the repository filesystem when needed.

The index does not need a structure like:

```json
{
  "projects": {
    "Current Affairs": {
      "children": []
    }
  }
}
```

That would duplicate hierarchy already represented by directories and paths. Subprojects do not need their own index records solely to establish that they exist.

### 6.5 Why title is duplicated in the index

The RootCog title could be loaded from its metadata, but doing so for every navigation item would require many extra file reads. Storing the short title in the global index is an intentional navigation optimization. The title limit is 77 characters.

### 6.6 Index is not the source of truth

The authoritative RootCog content remains in its RootCog directory:

```text
<RootCog directory>/
├── rootCog.md
├── rootCogInfo.json
└── children.json
```

The index is for discovery/navigation. If an index record becomes stale, the RootCog's actual directory remains the content location. User-initiated structural operations must keep the index synchronized. Index rebuild/recovery and exact atomicity mechanics are deferred implementation questions.

### 6.7 Index schema version

A per-user `version: 1` field in `cogsIndex.json` is **not currently required** by this design. Future application versions may migrate repository structure functionally. Git history preserves previous file states, but Git does not automatically migrate application schemas.

---

## 7. Moving and renaming Projects

Because a Project is a directory, moving it changes the paths of RootCogs beneath it. The relevant RootCog records in `cogsIndex.json` must then have their `path` values updated. Their `project` values must also reflect the new immediate parent Project name where that changes.

Example before:

```text
projects/Current Affairs/Geopolitics/rootCog-001
```

Example after:

```text
projects/Current Affairs/International Relations/rootCog-001
```

Corresponding index values change:

```json
{
  "project": "International Relations",
  "path": "projects/Current Affairs/International Relations/rootCog-001"
}
```

No separate Project index is required. Exact rename/move behavior, collision validation, and index-update transaction mechanics are deferred implementation details.

---

## 8. Deleted Cogs — named future structure

The agreed terminology is:
- folder: `deletedCogs/`;
- object: deleted Cog / deletedCog;
- timestamp field: `deletedAt`;
- later check functionality: `cogDeletion`.

The term **recycle bin** was explicitly rejected.

Future physical shape:

```text
deletedCogs/
└── <RootCogId>/
    ├── rootCog.md
    ├── rootCogInfo.json
    └── children.json
```

A deleted RootCog retains:
- its original RootCog ID;
- its original title;
- its Project value;
- its recorded path information;
- a deletion timestamp (`deletedAt`).

The title does not change on deletion.

Conceptual deleted record:

```json
{
  "id": "rootCog-001",
  "title": "Original RootCog Title",
  "project": "Geopolitics",
  "path": "projects/Current Affairs/Geopolitics/rootCog-001",
  "deletedAt": "2026-09-26T12:00:00Z"
}
```

### 8.1 57-day lifecycle

The design records a **57-day** deleted-Cog retention period. The intended later-sprint flow is:

1. RootCog is deleted.
2. `deletedAt` is recorded.
3. It is represented as a deleted-Cog object in `cogsIndex.json`.
4. Its content is associated with the `deletedCogs/` location.
5. On user login, a `cogDeletion` check examines deleted Cogs.
6. Cogs past the 57-day period are identified.
7. The user is notified that they are due for permanent deletion.
8. If the notification is not checked before logout, eligible Cogs are permanently deleted.

This is explicitly **not part of the earliest implementation sprint**. Physical move mechanics, exact deleted collection schema, notification UI, login/logout behavior, and permanent deletion are deferred. No background deletion worker is implied.

---

## 9. Git history and versioning

Git is the historical versioning layer. It supplies:
- commits;
- diffs;
- timestamps associated with commits;
- prior file states;
- change history.

The application should not duplicate Git's historical information in JSON merely to recreate version history. Domain metadata belongs in JSON only when it represents semantic information Git cannot provide.

Important distinction:
- Git history preserves historical file versions.
- Git history does **not** automatically migrate a changed application schema.
- A future application version must read the existing repository structure and perform any required migration itself.

The GitHub discussion does not lock the branch strategy, commit strategy, API batching, conflict recovery, authentication model, or GitHub App choice. Those are deferred implementation topics.

---

## 10. Repository access and write-operation implications

The discussion's intended application flow is:

```text
Browser
  ↓
Backend / serverless layer
  ↓
GitHub API
  ↓
GitHub repository
```

The browser should not hold privileged GitHub credentials. GitHub acts as persistent storage; the backend mediates access.

The GitHub REST Contents API documentation states that creating/updating a file requires a commit message and Base64-encoded content; updating an existing file requires the existing file's `sha`. The documentation also warns that file-content update and delete operations against the same repository path should not be run in parallel because they can conflict. This is external API behavior, not a Cogmit-specific invariant. See [GitHub REST API — Repository contents](https://docs.github.com/en/rest/repos/contents?apiVersion=2026-03-10).

The Cogmit discussion explicitly defers exact GitHub API implementation details, authentication, batching, rate limits, branch strategy, commit strategy, and error recovery. Therefore this reference does not prescribe a concrete implementation for those topics.

---

## 11. Complete current and future structure, combined

```text
cogmit/
│
├── cogsIndex.json
│
├── projects/
│   └── <Project Name>/
│       ├── projectData.json
│       │
│       ├── <RootCogId>/
│       │   ├── rootCog.md
│       │   ├── rootCogInfo.json
│       │   └── children.json
│       │
│       └── <SubProject Name>/
│           ├── projectData.json
│           ├── <RootCogId>/
│           │   ├── rootCog.md
│           │   ├── rootCogInfo.json
│           │   └── children.json
│           └── <Further SubProject Name>/
│               ├── projectData.json
│               └── <RootCogId>/
│                   ├── rootCog.md
│                   ├── rootCogInfo.json
│                   └── children.json
│
├── NPPCogs/
│   └── <RootCogId>/
│       ├── rootCog.md
│       ├── rootCogInfo.json
│       └── children.json
│
└── deletedCogs/                  # future/later-sprint location
    └── <RootCogId>/
        ├── rootCog.md
        ├── rootCogInfo.json
        └── children.json
```

---

## 12. Locked names, limits, and rules from the GitHub discussion

| Item | Agreed name / rule |
|---|---|
| RootCog content | `rootCog.md` |
| RootCog metadata | `rootCogInfo.json` |
| ChildCog collection | `children.json` |
| Project metadata | `projectData.json` |
| Global RootCog index | `cogsIndex.json` |
| No-parent-Project folder | `NPPCogs/` |
| Deleted-Cog folder | `deletedCogs/` |
| Deletion timestamp | `deletedAt` |
| Deletion check | `cogDeletion` |
| Project name maximum | 57 characters |
| RootCog title maximum | 77 characters |
| Deleted-Cog retention | 57 days |
| Project-level `cogs/` folder | Not used |
| Project-specific Cog index | Not used by default |
| Duplicate Project hierarchy in index | Not used |
| Separate file per ChildCog | Not used in current design |
| Duplicate `.txt` for TTS | Not required |
| Per-user index schema-version field | Not currently required |
| Git as historical versioning layer | Yes |

---

## 13. Explicitly deferred or unspecified in the Cogmit GitHub model

Do not mistake the folder diagram for a complete implementation specification. The following were deliberately deferred or left unspecified:

### ChildCogs
- exact `children.json` schema;
- ChildCog ID rules and metadata;
- ChildCog lifecycle;
- ChildCog promotion to RootCog;
- large collection behavior and optional sharding.

### Projects
- exact `projectData.json` schema;
- rename/move behavior details;
- deletion behavior;
- collision and name validation.

### Global index
- exact complete `cogsIndex.json` schema;
- atomicity of directory changes and index changes within a Git commit;
- index rebuild/recovery;
- stale-index detection;
- future migration behavior.

### Deleted Cogs
- exact physical move behavior;
- exact deleted collection placement/schema;
- login-time check implementation;
- notification UI;
- logout behavior;
- permanent deletion operation.

### GitHub integration
- authentication mechanism;
- GitHub App versus another credential model;
- repository creation;
- branch strategy;
- commit strategy;
- API batching;
- rate limits;
- error recovery.

---

## 14. Conceptual heritage that may inform YAI Studio

The older Cogmit concept document preserves ideas that are not tied to the GitHub folder layout:

- cognition can be treated as a structured object rather than disposable text;
- a RootCog is an identity boundary for a thought tree;
- ChildCogs represent subordinate or related thoughts;
- cognition evolves iteratively;
- lineage and ownership matter;
- publication is a deliberate act;
- a published representation can be a frozen snapshot distinct from mutable private working cognition;
- text is the primary cognitive medium, while speech is a runtime presentation layer.

These are Cogmit domain concepts, not mandatory YAI Studio storage rules. They may be useful if YAI Studio eventually models conversation threads, saved answers, collections, or derived knowledge as durable objects. They should not be imported automatically if YAI Studio's actual domain model is different.

---

# Part II — Applying the pattern to YAI Studio

## 15. What can transfer directly as a storage principle

The following are reusable architectural patterns, independent of Cogmit's specific Cog terminology:

1. **Repository as product/user storage boundary.** A repository can hold a coherent user's private YAI Studio data.
2. **Filesystem as hierarchy.** Directories can represent workspaces, projects, collections, or other stable organizational boundaries.
3. **Markdown for human-readable content.** Questions, answers, summaries, and notes can be stored in Markdown when readability and Git diffs matter.
4. **JSON for structured metadata.** IDs, timestamps, model/provider identifiers, relationships, tags, and status can be stored in JSON when they are real application data.
5. **One navigation index per chosen scope.** A central index can provide fast discovery without loading every content file, provided it remains a pointer/navigation layer rather than a duplicate database.
6. **Minimize duplicated data.** Let paths represent hierarchy; let Git represent revision history; store only the metadata needed by the application.
7. **Stable identity separate from path.** An object's ID identifies it; its path identifies its current location.
8. **Explicit persistence semantics.** Define exactly when a user action causes a commit. Do not let a folder diagram accidentally imply autosave or background persistence.

## 16. Illustrative YAI Studio structure — proposal, not Cogmit specification

The following is a starting proposal only. It is not present in the Cogmit documents and should be treated as a YAI Studio design option requiring its own decisions.

```text
yai-studio/
├── conversationsIndex.json
├── workspaces/
│   └── <Workspace Name>/
│       ├── workspaceData.json
│       ├── <ConversationId>/
│       │   ├── conversation.md
│       │   ├── conversation.json
│       │   └── messages.json
│       └── <Nested Workspace Name>/
│           ├── workspaceData.json
│           └── <ConversationId>/
│               ├── conversation.md
│               ├── conversation.json
│               └── messages.json
├── unfiledConversations/
│   └── <ConversationId>/
│       ├── conversation.md
│       ├── conversation.json
│       └── messages.json
└── archivedConversations/          # only if archive semantics are required
    └── <ConversationId>/
        ├── conversation.md
        ├── conversation.json
        └── messages.json
```

### 16.1 Candidate file responsibilities

| YAI Studio path | Candidate responsibility | Notes |
|---|---|---|
| `conversationsIndex.json` | Global conversation discovery/navigation | Keep it small; index IDs, titles, workspace, path, and perhaps a last-activity value if the UI requires it |
| `workspaces/` | Top-level workspace hierarchy | Use only if users need persistent grouping above conversations |
| `<Workspace Name>/workspaceData.json` | Workspace-specific metadata | Do not duplicate the directory name without a concrete need |
| `<ConversationId>/conversation.md` | Human-readable transcript or curated conversation view | Define whether this is canonical or generated from structured messages; do not leave dual-source ambiguity |
| `<ConversationId>/conversation.json` | Conversation-level metadata | Possible fields: conversation ID, title, created timestamp, updated timestamp, model configuration reference; exact schema must be decided |
| `<ConversationId>/messages.json` | Structured message records | Possible fields: message ID, role, content, timestamp, sequence, response metadata; exact schema must be decided |
| `unfiledConversations/` | Conversations with no workspace | Analogous in purpose to NPPCogs, but this name is a YAI Studio proposal, not a Cogmit name |
| `archivedConversations/` | Archived conversation storage | Include only if archive is a real lifecycle state; do not equate archive with deletion without defining semantics |

### 16.2 Important canonical-content decision

If YAI Studio stores the same question and answer content in both `conversation.md` and `messages.json`, it must define which representation is authoritative.

Possible patterns:

- **Structured source of truth:** `messages.json` is canonical; `conversation.md` is generated/exported for human reading. This avoids independently editing two copies of the same message content.
- **Markdown source of truth:** `conversation.md` is canonical; JSON contains only metadata and pointers. This is simpler for text-first workflows but weaker for message-level querying and structured UI rendering.
- **Single representation initially:** Store messages in one format first, and add the second representation only when a concrete use case justifies it.

Do not silently treat both files as equally authoritative. That creates synchronization and conflict problems.

## 17. A leaner YAI Studio alternative

If a conversation is the main storage unit and users do not need nested workspaces, a simpler structure may be preferable:

```text
yai-studio/
├── conversationsIndex.json
├── conversations/
│   ├── <ConversationId>/
│   │   ├── conversation.md
│   │   └── conversation.json
│   └── <ConversationId>/
│       ├── conversation.md
│       └── conversation.json
└── unfiledConversations/          # optional; omit if all conversations live in conversations/
```

This alternative avoids introducing a Project-like hierarchy before YAI Studio needs one. Choose one organizational model rather than combining both without a requirement.

## 18. YAI Studio index pattern inspired by `cogsIndex.json`

A flat global index can list all conversations while storing the immediate workspace and actual path.

Illustrative example only:

```json
{
  "conversations": [
    {
      "id": "conversation-001",
      "title": "How should I structure a product strategy?",
      "workspace": "Product Strategy",
      "path": "workspaces/Business/Product Strategy/conversation-001"
    },
    {
      "id": "conversation-002",
      "title": "Research notes on model evaluation",
      "workspace": null,
      "path": "unfiledConversations/conversation-002"
    }
  ]
}
```

The Cogmit analogy is:

| Cogmit | YAI Studio proposal |
|---|---|
| RootCog | Conversation or saved interaction object |
| ChildCogs | Possibly follow-up branches, annotations, or derived artifacts — only if YAI Studio defines them |
| Project | Workspace / collection |
| NPPCogs | Unfiled conversations |
| `rootCog.md` | `conversation.md` |
| `rootCogInfo.json` | `conversation.json` |
| `children.json` | Potentially `messages.json`, but these are not equivalent data models |
| `cogsIndex.json` | `conversationsIndex.json` |
| `deletedCogs/` | Optional archive/trash lifecycle, only after semantics are defined |

Do not mechanically equate ChildCogs with chat messages. A ChildCog is a subordinate cognition node; a chat message is an ordered event/turn in a conversation. They have different semantics and likely need different data structures.

## 19. Message-level structure: an additional YAI Studio design choice

If YAI Studio needs to preserve exact message order, role, and metadata, a structured message record could look like this:

```json
{
  "messages": [
    {
      "id": "message-001",
      "sequence": 1,
      "role": "user",
      "content": "How should I structure a product strategy?",
      "createdAt": "2026-11-18T10:00:00Z"
    },
    {
      "id": "message-002",
      "sequence": 2,
      "role": "assistant",
      "content": "Start by defining the market, customer, and strategic choices...",
      "createdAt": "2026-11-18T10:00:08Z",
      "model": "<model identifier>"
    }
  ]
}
```

This is an illustrative schema, not a Cogmit schema and not a final YAI Studio contract. Decide whether message content belongs in this JSON file or in Markdown before implementation.

---

## 20. Design constraints and failure modes to consider for YAI Studio

These are architectural considerations inferred for YAI Studio, not rules established by Cogmit:

- **Index write contention:** A single global index is convenient, but every new conversation or title/path change may update the same file. Concurrent writes can conflict.
- **Large conversation files:** Long conversations can make a single Markdown or JSON file expensive to read and rewrite. Define size thresholds and a future sharding strategy only when real usage justifies it.
- **Message append semantics:** Appending one message to a JSON array usually means rewriting the JSON file. A line-oriented format such as JSONL could be evaluated if append-heavy workloads become a problem; it is not part of Cogmit's model.
- **Dual-format drift:** Maintaining both Markdown and JSON copies of message content can cause mismatches unless one is canonical and the other is generated.
- **Sensitive content:** Private user questions and AI answers may contain sensitive information. Repository visibility, token scope, credential handling, and access control must be treated as security requirements, not merely folder-structure decisions.
- **Git history growth:** Every saved interaction can create commits and preserve previous content. This is useful for audit/history but has storage, privacy, and deletion implications. A deletion from the latest tree does not by itself erase prior Git history.
- **Deletion semantics:** Distinguish archive, soft delete, and permanent deletion. Do not import Cogmit's 57-day policy into YAI Studio without an explicit product decision.
- **Search:** A navigation index is not a full-text search engine. Searching message bodies may require a separate search strategy; do not overload the index with entire transcripts.
- **Commit granularity:** Decide whether one user save action produces one commit, whether a conversation save batches several file changes, and how failures are reported. Cogmit's exact commit strategy is deferred.
- **Atomicity:** If a conversation directory and global index are changed together, define how the app prevents an index entry from pointing to a missing/incomplete conversation after partial failure.

---

## 21. Cogmit invariants that should not be misread

1. A Project directory directly contains RootCog directories and nested Project directories; there is no `cogs/` layer.
2. NPPCogs are RootCogs with no parent Project and live under `NPPCogs/`.
3. Project names are directory names, max 57 characters.
4. RootCog titles are max 77 characters.
5. A RootCog directory contains `rootCog.md`, `rootCogInfo.json`, and `children.json`.
6. ChildCogs are kept together in one collection file in the current design.
7. `cogsIndex.json` is the sole global RootCog navigation index by default.
8. The index is flat for RootCog records; the filesystem path represents Project hierarchy.
9. `project` in an index record means immediate parent Project, not the complete hierarchy.
10. `path` is the current storage location; `id` is semantic identity.
11. The index is not the source of truth for RootCog content.
12. No separate Project-level Cog index is used by default.
13. `deletedCogs/` and the 57-day deletion lifecycle are later-sprint concepts, not earliest-sprint behavior.
14. Git provides historical versions; it does not migrate application schemas.
15. Exact schemas and many operational details remain deferred.

---

## 22. Final takeaway for YAI Studio

The strongest transferable lesson is not the names `RootCog`, `NPPCogs`, or `children.json`. It is the storage discipline behind them:

- make the directory tree represent the actual user-facing hierarchy;
- give each durable object a clear storage boundary;
- use Markdown when human-readable content and diffs are valuable;
- use JSON for structured fields that the filesystem cannot express;
- maintain one appropriately scoped navigation index rather than many duplicated indexes;
- keep stable object identity separate from its current path;
- avoid duplicating hierarchy, content, or Git history without a concrete requirement;
- specify canonical sources of truth before storing the same information in multiple formats;
- treat persistence, concurrency, security, and deletion as explicit system behaviors, not incidental consequences of folder layout.

For YAI Studio, start with the conversation as the durable unit, decide whether Markdown or structured messages are canonical, and add workspace nesting only if users need it. Cogmit provides a useful reference architecture, but YAI Studio needs its own domain model and explicit storage invariants.
