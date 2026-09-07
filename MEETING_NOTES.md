# DocMind-AI — Meeting Notes & Technical Governance

---

## Meeting 1: Core Architecture, Authentication vs Authorization, and Security Hardening

- **Date:** September 7, 2026
- **Attendees:** Hammad Zafar (Lead Developer), Academic & Technical Supervisor
- **Agenda:**
  1. Deep dive into Authentication vs Authorization in DocMind-AI.
  2. Secure API Key handling for external AI providers (Gemini, Ollama).
  3. GitHub version control movement, branch discipline, and leak prevention.
  4. Security audit, automated test coverage, and role-based access control.

---

### 1. Topics Discussed

#### 1.1 Authentication vs Authorization
- **Authentication (AuthN):** Identity verification ("Who are you?"). Implemented via `bcryptjs` salted password hashing (10 salt rounds) and JSON Web Tokens (JWT) signed with HMAC-SHA256. If credentials or tokens are invalid, the API strictly returns **`401 Unauthorized`**.
- **Authorization (AuthZ):** Permission evaluation ("What are you allowed to do?"). Implemented via role-based access control (`requireRole` middleware). If an authenticated user attempts to access an administrative or restricted resource, the API returns **`403 Forbidden`**.
- Fixed architectural gap: The JWT payload previously lacked the `role` field, and no `requireRole` middleware existed. Added role persistence in `src/models/User.js`, encoded `role` in JWT payload, and implemented `requireRole('admin')`.

#### 1.2 API Key Handling & Secrets Management
- Addressed supervisor concern regarding third-party API keys (e.g., Google Gemini API key).
- External API keys are strictly maintained server-side in `.env` and loaded via `process.env`.
- Frontend never has direct access to raw API keys. All LLM calls are proxied through server routes (`/api/chat`, `/api/summarize`).
- Masking verified: In `src/controllers/settingsController.js`, when configuration is queried, the Gemini API key is masked as `********`.
- Hardened `.gitignore` with `.env` and `.env.*` rules while retaining `!.env.example` as a clean, non-sensitive template.

#### 1.3 GitHub Workflow & Repository Hygiene
- Verified Git status and commit history (`git log -n 5`, `git status`).
- Confirmed that secrets (`.env`) have never been committed to Git history.
- Established clean branching workflow: feature branch -> pull request -> code review -> squash/merge to `main`.
- Enforced zero-destructive-command policy (no `git reset --hard` or `git push --force`).

#### 1.4 Security Review & Automated Verification
- Developed a comprehensive automated security test suite (`tests/test_auth_security.js`) covering 10 distinct test scenarios.
- Resolved rate limiter conflicts for automated testing in `src/middlewares/rateLimiter.js`.

---

### 2. Supervisor Feedback & Decisions

1. **Strict HTTP Semantics:** The supervisor required unambiguous distinction between 401 (AuthN failure) and 403 (AuthZ failure). Previously, invalid tokens returned 403 in unused boilerplate. Updated to return `401 Unauthorized` for token issues and `403 Forbidden` strictly for role authorization rejections.
2. **API Key Security Protocol:** Confirmed that client browsers must never invoke Google Gemini directly. All external AI queries must traverse DocMind-AI backend middleware for auditing, token management, and prompt sanitation.
3. **Automated Verification:** Mandated repeatable automated tests to validate security regression prevention.

---

### 3. Action Items

#### Completed Items
- [x] Standardize `authMiddleware.js` with `requireAuth` (401) and `requireRole` (403).
- [x] Embed `role` attribute into JWT payloads upon registration and login.
- [x] Create protected admin endpoints (`/api/auth/admin/dashboard`, `/api/auth/admin/users`).
- [x] Audit `.gitignore`, `.env`, and `.env.example` for secret exclusion.
- [x] Implement 10-scenario automated security test suite (`npm test`).
- [x] Document Authentication vs Authorization, API Keys, and Git workflows in `README.md`.

#### In Progress Items
- [ ] Implement refresh token rotation / token invalidation blacklist for logout.
- [ ] Connect Redis cache layer for high-throughput session/rate-limit tracking in production.

#### Future Roadmap
- [ ] Multi-tenant organization support and custom permission matrices (Editor, Viewer, Auditor).
- [ ] SSO / OAuth2 integration (Google Workspace, GitHub OAuth).
- [ ] Automated CI/CD pipeline with GitHub Actions executing `npm test` on PR creation.

---

### 4. Technical Decisions Log

| Decision ID | Decision | Rationale | Alternatives Considered |
|:---|:---|:---|:---|
| **ADR-001** | Stateless JWT with embedded user role | Allows horizontal scaling without distributed session lookups on every request while enabling instant role checks in middleware. | Server-side sessions in Redis (more overhead for current single-instance deployment). |
| **ADR-002** | Separate `requireAuth` and `requireRole` middlewares | Enforces Single Responsibility Principle (SRP); separates identity verification from permission enforcement. | Monolithic auth middleware doing both checks (harder to test and maintain). |
| **ADR-003** | Server-side API key proxying | Prevents client-side exfiltration of paid API tokens; allows server to enforce rate limits and prompt safeguards. | Client-side API key injection (high security vulnerability). |
| **ADR-004** | Resilient dual-mode persistence (Mongoose + In-Memory) | Ensures development, CI test runners, and environments without active MongoDB instances can run without test failure. | Requiring external Mongo container or mocking library. |

---

### 5. Next Meeting Preparation

- **Demo Plan:**
  1. Live run of `npm test` demonstrating 10/10 automated test passes.
  2. Live Postman/curl demonstration showing regular user receiving `403 Forbidden` on `/api/auth/admin/dashboard` vs admin user receiving `200 OK`.
  3. Demonstration of masked Gemini API keys in `/api/settings`.
- **Questions for Supervisor:**
  1. Should we implement short-lived access tokens (15m) paired with refresh tokens in HTTP-only cookies for web clients?
  2. For document access authorization, should we enforce document-level ownership checks (Object-Level Authorization / BOLA protection) in the next sprint?
- **Metrics to Report:**
  - Automated test pass rate: 100% (10/10).
  - Test suite runtime: < 1.5 seconds.
  - Zero sensitive keys leaked in repository history.

---

## Future Meeting Template

```markdown
## Meeting [Number]: [Topic]

- **Date:** [YYYY-MM-DD]
- **Attendees:** [Names and Roles]
- **Agenda:**
  1. [Agenda Item 1]
  2. [Agenda Item 2]

### 1. Topics Discussed
- **[Topic 1]:** [Summary]
- **[Topic 2]:** [Summary]

### 2. Supervisor Feedback & Decisions
- [Feedback point 1]
- [Decision point 1]

### 3. Action Items
- [ ] [Task 1] (Owner: [Name], Due: [Date])
- [ ] [Task 2] (Owner: [Name], Due: [Date])

### 4. Technical Decisions Log
| Decision | Rationale | Alternatives Considered |
|:---|:---|:---|
| [Decision] | [Rationale] | [Alternatives] |

### 5. Next Meeting Preparation
- **Demo Plan:** [Items to demonstrate]
- **Questions for Supervisor:** [Questions]
- **Metrics to Report:** [Metrics]
```
