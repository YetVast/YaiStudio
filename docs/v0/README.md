# YAI Studio V0 — As-Built Technical Documentation & V1 Handoff Suite

Welcome to the **YAI Studio V0 Technical Documentation Suite**. This directory contains the complete, authoritative, and technically verified **as-built** record of the YAI Studio Version 0 application, along with the transition architecture and technical handoff for Version 1 (Progressive Web Application & LiteRT-LM Local Intelligence).

---

## 1. Documentation Index

The V0 documentation suite is organized into nine specialized documents:

| Document | Title | Purpose |
| :--- | :--- | :--- |
| [`V0_AS_BUILT_DOCUMENTATION.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_AS_BUILT_DOCUMENTATION.md) | **As-Built System Record** | Exhaustive audit of the actual codebase, implemented features, verified workflows, partial implementations, and technical debt. |
| [`V0_ARCHITECTURE.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_ARCHITECTURE.md) | **Architecture Baseline & ADRs** | Detailed system architecture, component boundaries, authoritative sources of truth, responsibility matrix, and Architecture Decision Records (ADRs). |
| [`V0_DATA_MODEL_AND_STORAGE.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_DATA_MODEL_AND_STORAGE.md) | **Data Models & Storage Specification** | Complete directory layout and JSON schemas for `YVSApps_Data_YaiStudio`, optimistic concurrency (SHAs), path security, and markdown projections. |
| [`V0_AUTHENTICATION_AND_SECURITY.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_AUTHENTICATION_AND_SECURITY.md) | **Authentication & Security Architecture** | Dual-boundary security model (Yet Vast Auth vs. GitHub Storage Auth), PKCE code exchange, host-bound JWT sessions, and AES-256-GCM Credential Vault. |
| [`V0_API_REFERENCE.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_API_REFERENCE.md) | **Complete API Reference** | Formal reference for all 22 REST API endpoints across auth, storage, workspaces, conversations, memory, knowledge, activity, providers, and generation. |
| [`V0_DEPLOYMENT_AND_OPERATIONS.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_DEPLOYMENT_AND_OPERATIONS.md) | **Deployment & Operations Guide** | Vercel Serverless deployment topology, environment variable matrix, `.npmrc` GitHub Packages configuration, and operational characteristics. |
| [`V0_TESTING_AND_KNOWN_LIMITATIONS.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_TESTING_AND_KNOWN_LIMITATIONS.md) | **Testing & Technical Debt Report** | Test execution records (`vitest`, `tsc`, `next lint`, `next build`), edge-case behaviors, frontend/API payload discrepancies, and known limitations. |
| [`V0_RELEASE_BASELINE.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_RELEASE_BASELINE.md) | **Release Baseline & V1 Handoff** | Exact release manifest (commit `d4cabeb`, dependency matrix, route table) and in-depth 10-point V1 transition architecture analysis. |

---

## 2. Core Architectural Principles of V0

1. **User-Owned Data Authority:**
   YAI Studio maintains **zero central intelligence databases**. The user's private GitHub repository (`YVSApps_Data_YaiStudio`) is the sole authoritative persistence store for personal intelligence.
2. **Dual-Boundary Authentication:**
   *Yet Vast Auth* verifies who the user is (identity assertion); *GitHub Storage Authorization* grants access to read and write repository content. They are strictly decoupled.
3. **Bring Your Own Key (BYOK) Inference:**
   AI inference is executed server-side via OpenRouter (primary) and Google AI Studio (secondary). API keys are encrypted at rest with AES-256-GCM and never stored in the user repository or leaked to client bundles.
4. **Structured Memory Lifecycle:**
   Not every interaction is a permanent memory. The application separates *Activity History* (ledger), *Memory Candidates* (pending review), and *Accepted Memories* (structured JSON).
5. **Human-Readable Projections:**
   Structured `messages.json` is the content authority for chat. Human-readable Markdown (`conversation.md`) is maintained alongside it as an inspectable projection.

---

## 3. How to Use This Documentation Suite

- **For New Developers & AI Agents:** Start with [`V0_AS_BUILT_DOCUMENTATION.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_AS_BUILT_DOCUMENTATION.md) and [`V0_ARCHITECTURE.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_ARCHITECTURE.md) to understand how the system works today.
- **For Infrastructure & DevOps:** Review [`V0_DEPLOYMENT_AND_OPERATIONS.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_DEPLOYMENT_AND_OPERATIONS.md) for environment variables, secrets, and Vercel KV setup.
- **For Product Engineers Building V1:** Study [`V0_RELEASE_BASELINE.md`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/docs/v0/V0_RELEASE_BASELINE.md) for the 10-point V1 technical analysis, local storage requirements, LiteRT-LM integration boundaries, and prerequisite architecture decisions.
