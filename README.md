# DocMind-AI

> **Enterprise-Grade AI-Powered Document Question Answering & Summarization Platform**

DocMind-AI is an intelligent document interaction platform that leverages Retrieval-Augmented Generation (RAG), local LLMs (via Ollama), and cloud AI models (Google Gemini) to provide fast, accurate document summaries and question-answering capabilities.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Authentication vs Authorization](#authentication-vs-authorization)
   - [Conceptual Distinction](#conceptual-distinction)
   - [Implementation in DocMind-AI](#implementation-in-docmind-ai)
   - [HTTP Status Codes & Semantics](#http-status-codes--semantics)
3. [API Key Handling & Secrets Security](#api-key-handling--secrets-security)
   - [Server-Side Proxy Architecture](#server-side-proxy-architecture)
   - [Environment Secrets & Git Protection](#environment-secrets--git-protection)
   - [Key Rotation Protocol](#key-rotation-protocol)
4. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
5. [Automated Security Test Suite](#automated-security-test-suite)
6. [GitHub Workflow & Version Control](#github-workflow--version-control)
7. [Installation & Quickstart](#installation--quickstart)

---

## 1. Architecture Overview

```
+-------------------------------------------------------------------------+
|                              DocMind-AI UI                              |
|         Vanilla JS / HTML5 / CSS3 Single-Page Interface                 |
+-------------------------------------------------------------------------+
                                    |
                    HTTP / JSON REST API Requests
                    [Authorization: Bearer <token>]
                                    v
+-------------------------------------------------------------------------+
|                         Express.js API Server                           |
|  +---------------------+  +--------------------+  +------------------+  |
|  |    Rate Limiting    |  |  requireAuth (401) |  | requireRole(403) |  |
|  +---------------------+  +--------------------+  +------------------+  |
+-------------------------------------------------------------------------+
       |                           |                          |
       v                           v                          v
+-------------------+   +--------------------+   +------------------------+
| User Data & RAG   |   | Local LLM (Ollama) |   | Cloud LLM (Gemini API) |
| MongoDB / Memory  |   | Llama 3.2 (Local)  |   | Server-Side Proxy      |
+-------------------+   +--------------------+   +------------------------+
```

---

## 2. Authentication vs Authorization

### Conceptual Distinction

| Metric | Authentication (AuthN) | Authorization (AuthZ) |
|:---|:---|:---|
| **Core Question** | "Who are you?" | "What are you permitted to do?" |
| **Verification Focus** | Identity validation | Access rights and privilege validation |
| **Mechanism** | Email/password, bcrypt hashing, JWT signing | Role-based evaluation (`user` vs `admin`) |
| **Failure Code** | **`401 Unauthorized`** | **`403 Forbidden`** |
| **Code Location** | `src/controllers/authController.js`<br>`requireAuth` in `src/middlewares/authMiddleware.js` | `requireRole` in `src/middlewares/authMiddleware.js` |

### Implementation in DocMind-AI

1. **Password Hashing:** Passwords are never stored in plaintext. They are salted with 10 rounds of `bcryptjs` in `src/models/User.js` (and in-memory fallback):
   ```javascript
   const salt = await bcrypt.genSalt(10);
   this.password = await bcrypt.hash(this.password, salt);
   ```
2. **Stateless JWT Tokens:** Upon successful login or registration, the server issues a signed JWT:
   ```javascript
   const token = jwt.sign(
     { id: user._id, email: user.email, name: user.name, role: user.role },
     JWT_SECRET,
     { expiresIn: '7d' }
   );
   ```
3. **Strict Authentication Guard (`requireAuth`):**
   - Validates that an `Authorization: Bearer <token>` header is present.
   - Verifies the cryptographic signature using HMAC-SHA256 and checks token expiration.
   - If missing or invalid, returns **`401 Unauthorized`**.
4. **Role Authorization Guard (`requireRole('admin')`):**
   - Ensures `req.user` is authenticated (returns `401` if unauthenticated).
   - Verifies that `req.user.role` matches the allowed role.
   - If role is insufficient (e.g., standard `user` attempting admin access), strictly returns **`403 Forbidden`**.

### HTTP Status Codes & Semantics
- **`401 Unauthorized`**: Authentication is missing, malformed, or has expired. The client must authenticate.
- **`403 Forbidden`**: The client is successfully authenticated, but does not possess the permissions required to access the target resource. Re-authenticating with the same credentials will not grant access.

---

## 3. API Key Handling & Secrets Security

### Server-Side Proxy Architecture
External AI service keys (e.g., Google Gemini API key) are **never exposed to the client browser**:
1. All client requests are sent to DocMind-AI backend endpoints (`/api/chat`, `/api/summarize`).
2. The server loads the secret from environment variables (`process.env.GEMINI_API_KEY`).
3. The server calls the Google Gemini API server-to-server.
4. When frontend settings queries configuration (`GET /api/settings`), the Gemini key is masked as `********` to prevent exfiltration.

### Environment Secrets & Git Protection
- All configuration is maintained in `.env` (excluded from version control).
- Non-sensitive defaults and configuration keys are documented in `.env.example`.
- `.gitignore` explicitly excludes all `.env` variants:
  ```gitignore
  .env
  .env.*
  !.env.example
  ```
- Git history audits confirm zero leaked credentials in commits.

### Key Rotation Protocol
If an API key or JWT secret is ever suspected of compromise:
1. Immediately generate a replacement key in the Google Cloud Console / AI Studio.
2. Update `.env` on the production server: `GEMINI_API_KEY=new_secret_key`.
3. If rotating `JWT_SECRET`, updating the secret instantly invalidates all existing active tokens, forcing all clients to re-authenticate cleanly.
4. Restart the Node.js process (`pm2 restart docmind-ai` or `npm start`).

---

## 4. Role-Based Access Control (RBAC)

DocMind-AI implements two primary roles:
- **`user`**: Standard role assigned on registration. Permitted to upload documents, perform semantic search, ask questions, and retrieve document summaries.
- **`admin`**: Privileged role assigned when supplying a secure administrative key (`ADMIN_SECRET_KEY`) during registration or managed by system administrators. Has access to system metrics, user lists, and platform health dashboards.

Protected routes example:
```javascript
// Strict Authentication
router.get('/me', requireAuth, authController.getMe);

// Role-Based Authorization
router.get('/admin/dashboard', requireAuth, requireRole('admin'), authController.getAdminDashboard);
router.get('/admin/users', requireAuth, requireRole('admin'), authController.listUsers);
```

---

## 5. Automated Security Test Suite

DocMind-AI includes an automated test suite verifying all 10 core authentication and authorization scenarios:

```bash
npm test
```

### Test Coverage

| # | Test Scenario | Expected Result | Verified Status |
|:---|:---|:---|:---|
| 1 | User registration with valid details | `201 Created` + JWT token + role | **PASS** |
| 2 | Registration with missing required fields | `400 Bad Request` | **PASS** |
| 3 | Registration with duplicate email address | `400 Bad Request` | **PASS** |
| 4 | Login with valid credentials | `200 OK` + valid JWT token | **PASS** |
| 5 | Login with invalid password | `401 Unauthorized` | **PASS** |
| 6 | Access protected route (`/api/auth/me`) with NO token | `401 Unauthorized` | **PASS** |
| 7 | Access protected route (`/api/auth/me`) with INVALID token | `401 Unauthorized` | **PASS** |
| 8 | Access admin route with regular user token | `403 Forbidden` | **PASS** |
| 9 | Access admin route with admin token | `200 OK` | **PASS** |
| 10 | Password hashing & salt verification | Stored as bcrypt hash (`$2a$`/`$2b$`), not plaintext | **PASS** |

---

## 6. GitHub Workflow & Version Control

DocMind-AI follows standard collaborative Git practices:

### Branching & Release Strategy
- **`main`**: Production-ready, stable codebase.
- **`feature/<name>`**: Isolated feature branches for development.
- **Pull Requests (PRs)**: Code review, automated test execution (`npm test`), and merge verification.

### Safe Git Command Reference
```bash
# Check status of modified and untracked files
git status

# Inspect commit history cleanly
git log --oneline -n 10

# Create and switch to a feature branch
git checkout -b feature/auth-hardening

# Stage only intentional files
git add src/ tests/ README.md

# Create meaningful, conventional commit
git commit -m "feat(auth): implement strict 401/403 separation and requireRole middleware"

# Push feature branch safely
git push origin feature/auth-hardening
```

> [!WARNING]
> Destructive commands such as `git reset --hard` and `git push --force` are strictly forbidden on shared branches.

---

## 7. Installation & Quickstart

### Prerequisites
- Node.js (v18 or higher recommended)
- Optional: MongoDB running on `mongodb://127.0.0.1:27017` (automatic in-memory fallback enabled if offline)
- Optional: Ollama running on `http://localhost:11434` for local inference

### Setup
```bash
# Clone the repository
git clone https://github.com/Hammadzafar64/DocMind-AI.git
cd DocMind-AI

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Run automated security tests
npm test

# Start development server
npm start
```

Open `http://localhost:3000` in your browser.
