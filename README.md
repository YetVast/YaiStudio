# YAI Studio — Project Documentation Pack

**Product:** YAI Studio  
**Organization:** Yet Vast Solutions (YVS)  
**Repository:** `yaistudio` (the application repository already created by the owner)  
**Data repository per GitHub account:** `YVSApps_Data_YaiStudio`  
**Target:** Complete v0 web application; v1 adds installable PWA and local LiteRT-LM capability.

## Start here

1. `AGENTS.md` — mandatory instructions for AI coding agents.
2. `docs/product/PRODUCT_REQUIREMENTS.md` — product purpose, scope and user journeys.
3. `docs/architecture/ARCHITECTURE.md` — system boundaries and v0/v1 architecture.
4. `docs/auth/AUTHENTICATION_AND_GITHUB_ACCESS.md` — Yet Vast Auth, GitHub identity and repository authorization.
5. `docs/data/PERSONAL_INTELLIGENCE_DATA_MODEL.md` — user-owned GitHub repository layout and data ownership.
6. `docs/security/SECURITY_AND_PRIVACY.md` — trust boundaries and security requirements.
7. `docs/implementation/V0_BUILD_PLAN_AND_ACCEPTANCE.md` — implementation sequence and acceptance criteria.
8. `docs/decisions/ARCHITECTURE_DECISIONS.md` — locked decisions, recommendations and unresolved gates.
9. `docs/reference/` — source architecture references and current Yet Vast standards.

## Source-of-truth hierarchy

- YVS-wide standards are authoritative for organization-wide engineering and visual foundations.
- YAI-specific requirements in this pack govern YAI product behavior.
- The supplied YAI architecture discussion is the source for the central intelligence platform, YAI API/client split, cloud/local execution paths, Activity Ledger and memory distinction.
- The Cogmit storage reference is a pattern reference for filesystem hierarchy, metadata, indexes and Git history. Cogmit-specific names and domain rules are not YAI requirements.
- Current Yet Vast Auth documentation and the published SDK contract govern actual authentication integration. Do not infer SDK behavior from examples in another product.

## Important implementation status

This pack is a product initialization specification, not evidence that any feature has already been implemented. The coding agent must inspect the cloned `yaistudio` repository, identify existing files and changes, and report observed state before modifying it.

## Primary product invariants

- YAI Studio is the central Personal Intelligence platform and its management interface; it is not merely a chatbot.
- Product applications integrate through APIs and shared client contracts. They do not require the YAI Studio UI to be open.
- GitHub is the initial user-owned persistence source for YAI personal data.
- Authentication and GitHub repository authorization are separate concerns.
- No privileged GitHub token, OAuth secret, provider API key or Yet Vast Auth signing secret may reach browser code or source control.
- Activity records, memory candidates and accepted persistent memories are distinct data classes.
- V0 is cloud-capable and fully usable as a web application. V1 adds PWA installation and local LiteRT-LM execution; do not pull local model execution into v0.
- YVS visual identity and CSS Modules-only styling are mandatory for this project.
