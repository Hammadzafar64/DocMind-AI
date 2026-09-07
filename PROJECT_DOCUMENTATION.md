# DocMind-AI — Complete Technical Manual & Project Guide

> **Document Intelligence, Question Answering, and Smart Summarization Platform**  
> *A Comprehensive Guide to Architecture, Technologies, Workflow, and Deployment*

---

## 1. Project Overview & Problem Statement

### 1.1 The Problem
In modern academic, legal, medical, and enterprise environments, individuals and organizations deal with hundreds of pages of complex documents (PDFs, Word documents, research papers, reports, and contracts). Reading and extracting precise information from these dense files manually takes hours. 

While public AI chatbots (like standard ChatGPT) exist, they suffer from two major flaws:
1. **Hallucination:** General AI models guess or make up facts when asked about specific niche documents.
2. **Privacy & Exfiltration:** Uploading confidential business documents to public clouds creates severe security and data privacy risks.

### 1.2 The DocMind-AI Solution
DocMind-AI solves this through **Retrieval-Augmented Generation (RAG)**:
- Users upload local documents (PDF, DOCX, TXT).
- The system parses, chunks, and creates mathematical vector representations of the text.
- When a user asks a question, DocMind-AI performs semantic vector search to extract the exact relevant paragraphs from the document and feeds only that verified context to the LLM (Local Ollama or Cloud Google Gemini).
- The AI generates answers that are **100% grounded** in the document, accompanied by verifiable **source citations**.

---

## 2. Languages, Libraries & Technologies Used

DocMind-AI is built using an industry-standard, lightweight, and high-performance stack:

### 2.1 Languages & Frameworks
| Technology | Category | Purpose in DocMind-AI |
|:---|:---|:---|
| **JavaScript (ES6+)** | Core Language | Used across both Backend (Node.js) and Frontend (Vanilla JS). Ensures unified asynchronous programming (`async/await`, Promises). |
| **Node.js** | Runtime Environment | High-performance, non-blocking asynchronous event-driven JavaScript runtime running the server. |
| **Express.js (v4.21)** | Backend Web Framework | REST API routing, custom security middlewares, static file serving, and JSON request/response pipelines. |
| **HTML5** | Frontend Markup | Semantic page structure, drag-and-drop file dropzone, modal dialogs, and responsive layouts. |
| **CSS3 (Vanilla)** | Frontend Styling | Modern Glassmorphism, Google Gemini Dark Theme, custom CSS variables, ambient glowing mesh gradients, and mobile responsive design (no heavy bloated CSS frameworks). |

### 2.2 Core Backend Libraries & Modules
| Module | Version | Purpose |
|:---|:---|:---|
| `jsonwebtoken` | ^9.0.3 | Stateless authentication using cryptographic HMAC-SHA256 signed JWT tokens with embedded user roles. |
| `bcryptjs` | ^3.0.3 | One-way salted password hashing (10 salt rounds) resistant to rainbow table and brute-force attacks. |
| `multer` | ^1.4.5 | Multipart/form-data middleware for streaming and storing document uploads safely. |
| `pdf-parse` | ^1.1.1 | High-speed binary parsing and text extraction from multi-page PDF files. |
| `mammoth` | ^1.8.0 | Document parsing for Microsoft Word (`.docx`) files, extracting clean raw text and paragraph structures. |
| `mongoose` | ^9.9.1 | MongoDB Object-Document Mapper (ODM) for user accounts and documents, with automatic in-memory fallback. |
| `express-rate-limit` | ^8.6.2 | API rate limiting protecting authentication and chat endpoints against DDoS and brute-force attempts. |
| `swagger-ui-express` | ^5.0.1 | Interactive OpenAPI 3.0 documentation served at `/api/docs`. |
| `winston` | ^3.19.0 | Production-grade structured logging with console and file transports. |
| `dotenv` | ^16.6.1 | Secure environment variable loading from `.env`. |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing control. |

### 2.3 AI & Vector Engines
- **Ollama (Llama 3.2 3B):** Local, privacy-first, offline LLM inference running on `http://localhost:11434`. Completely free with zero external API costs.
- **Google Gemini API:** Fast cloud fallback model (Gemini 1.5 Flash) proxied through the server.
- **In-Memory & Persistent Vector Store:** Custom TF-IDF vectorizer and Cosine Similarity engine that indexes document chunks and computes similarity scores between questions and document paragraphs.

---

## 3. How DocMind-AI Works (Step-by-Step Architecture)

```
[ User Uploads PDF/DOCX ]
           │
           ▼
[ 1. Multer Upload Handler ] ──> Stores file in /uploads/
           │
           ▼
[ 2. Text Extraction Engine ] ──> pdf-parse (PDF) or mammoth (DOCX)
           │
           ▼
[ 3. Chunking Engine ] ──> Splits text into 800-character overlapping chunks
           │
           ▼
[ 4. VectorStore Indexer ] ──> Computes vector weights & stores in /storage/vectorstore.json
           │
           ▼
[ 5. User Asks Question ] ──> Vector similarity match (Cosine Similarity)
           │
           ▼
[ 6. Augmented Context Builder ] ──> Top-K relevant chunks + User Prompt + System Prompt
           │
           ▼
[ 7. LLM Generation ] ──> Local Ollama (Llama 3.2) OR Google Gemini API
           │
           ▼
[ 8. Response to User ] ──> Markdown rendered answer + Source Citations
```

### Step 1: Document Upload & Ingestion
1. The user drags a file into the dropzone or selects Browse.
2. `Multer` accepts files with extensions `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.json` up to 25MB.
3. Depending on the mime-type, `pdf-parse` extracts raw text from PDF streams, or `mammoth` extracts text from Word XML nodes.

### Step 2: Intelligent Chunking
LLMs have context window limits and perform better with focused information. DocMind-AI slices the document into chunks of approximately 800 to 1,000 characters with a 100-character overlap. This overlap ensures sentences spanning chunk boundaries are not cut in half.

### Step 3: Vector Indexing & Semantic Storage
Each chunk is assigned an ID, document reference, and calculated term-frequency vector. The resulting index is cached in memory for sub-millisecond retrieval and persisted to `storage/vectorstore.json`.

### Step 4: Semantic Query Retrieval
When the user asks: *"What is the revenue growth rate mentioned in the report?"*, DocMind-AI:
1. Vectorizes the question.
2. Calculates the **Cosine Similarity** between the question vector and every stored chunk:
   $$\text{Cosine Similarity} = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|}$$
3. Selects the top 3 to 5 chunks with the highest mathematical similarity.

### Step 5: Augmented Prompt Formulation
DocMind-AI dynamically constructs a strict system prompt:
```text
You are DocMind-AI, an expert document intelligence assistant.
Use ONLY the following extracted source context to answer the user's question.
If the answer cannot be found in the context, explicitly state that.

Source Context:
[Chunk 1 text...]
[Chunk 2 text...]

User Question: What is the revenue growth rate mentioned in the report?
```

### Step 6: Inference & Grounded Answer Delivery
The augmented prompt is dispatched to Ollama or Google Gemini. The generated answer is sent to the client, parsed with `marked.js` into formatted HTML, and displays the exact source citations.

---

## 4. Authentication vs. Authorization (Security Model)

DocMind-AI enforces strict separation between identity verification and permission checks:

| Aspect | Authentication (AuthN) | Authorization (AuthZ) |
|:---|:---|:---|
| **Core Question** | *"Who are you?"* | *"What are you allowed to do?"* |
| **Check** | Valid email, password, and JWT signature | Valid user role (`user` vs `admin`) |
| **Failure HTTP Code** | **`401 Unauthorized`** | **`403 Forbidden`** |
| **Middleware** | `requireAuth` in `src/middlewares/authMiddleware.js` | `requireRole('admin')` in `src/middlewares/authMiddleware.js` |
| **Token Claims** | Encodes `{ id, email, name, role }` | Inspected by `requireRole` on protected routes |

### Role Hierarchy
- **Standard User (`user`):** Uploads personal documents, performs Q&A, views summaries, manages personal chat history.
- **Administrator (`admin`):** All user privileges PLUS access to `/api/auth/admin/dashboard` and `/api/auth/admin/users`, live database health monitoring, and system metrics.

---

## 5. Step-by-Step Setup & Running Guide

### 5.1 System Prerequisites
- **Node.js:** v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **NPM:** Bundled with Node.js
- *(Optional)* **MongoDB:** Running locally on port 27017 (if not installed, DocMind-AI automatically falls back to its resilient built-in memory store).
- *(Optional)* **Ollama:** Installed from [ollama.ai](https://ollama.ai) with `llama3.2:3b` pulled (`ollama run llama3.2:3b`).

### 5.2 Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/Hammadzafar64/DocMind-AI.git
cd DocMind-AI

# 2. Install all dependencies
npm install

# 3. Setup Environment Variables
# Copy the template file to .env
cp .env.example .env
```

### 5.3 Configure `.env` File
Open `.env` and verify the settings:
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/docmind_ai
JWT_SECRET=docmind_ai_super_secret_jwt_key_2026
ADMIN_SECRET_KEY=docmind_admin_key_2026
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
GEMINI_API_KEY=your_optional_gemini_api_key_here
NODE_ENV=development
```

### 5.4 Run Automated Security Test Suite
Before starting the server, run the automated test suite to ensure all 10 security scenarios pass:
```bash
npm test
```
*Expected output: `🎉 ALL 10 SECURITY SCENARIOS PASSED SUCCESSFULLY (10/10)!`*

### 5.5 Start the Application
```bash
# Production start
npm start

# Development start (auto-reloads on file changes)
npm run dev
```

### 5.6 Accessing the Application
- **Main Web Interface:** Open [http://localhost:3000](http://localhost:3000)
- **Interactive Swagger API Docs:** Open [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## 6. Complete API Endpoints Reference

| Method | Endpoint | Auth Required | Role | Description |
|:---|:---|:---|:---|:---|
| `POST` | `/api/auth/register` | No | Public | Register new account (assigns `admin` if `adminSecret` matches) |
| `POST` | `/api/auth/login` | No | Public | Authenticate user, returns JWT token with embedded role |
| `GET` | `/api/auth/me` | **Yes (401)** | Any | Fetch currently logged-in user profile |
| `GET` | `/api/auth/admin/dashboard` | **Yes (401)** | **Admin (403)** | Get system health, DB mode, and user metrics |
| `GET` | `/api/auth/admin/users` | **Yes (401)** | **Admin (403)** | List registered system user accounts |
| `POST` | `/api/upload` | Soft/Optional | Any | Upload and vector-embed PDF, DOCX, or TXT document |
| `GET` | `/api/documents` | Soft/Optional | Any | Retrieve list of uploaded documents and metadata |
| `POST` | `/api/chat` | Soft/Optional | Any | Ask question over documents (RAG similarity retrieval) |
| `POST` | `/api/summarize` | Soft/Optional | Any | Generate bullet, TL;DR, or executive document summary |
| `GET` | `/api/settings` | No | Public | Retrieve active AI settings (API keys masked with `********`) |
| `GET` | `/api/docs` | No | Public | Interactive Swagger / OpenAPI documentation UI |
| `GET` | `/api/docs.json` | No | Public | Raw OpenAPI 3.0 JSON specification schema |

---

## 7. Supervisor & Viva Examination FAQ

**Q1: Why did you use RAG instead of fine-tuning an AI model?**  
*Answer:* Fine-tuning is expensive, slow, and permanently alters model weights. When documents change or new PDFs are uploaded, a fine-tuned model requires full re-training. RAG decouples knowledge from model weights: the document is indexed dynamically in seconds, completely preventing hallucinations because the LLM is strictly instructed to answer from the provided context chunks.

**Q2: How does DocMind-AI prevent API key leakage?**  
*Answer:* The client browser never communicates directly with Google Gemini. All requests are proxied server-side. The backend loads `GEMINI_API_KEY` from `process.env`. When the client views system settings, keys are masked as `********`. In addition, `.gitignore` excludes all `.env` files from GitHub commits.

**Q3: What is the difference between 401 Unauthorized and 403 Forbidden?**  
*Answer:* `401 Unauthorized` means authentication failed—the client provided no token or an invalid/expired token ("Who are you?"). `403 Forbidden` means authentication succeeded, but the user's role does not possess permission to access the resource ("You are not an admin").

**Q4: How does password security work?**  
*Answer:* We use `bcryptjs` with 10 salt rounds. Before saving to the database, a random cryptographic salt is generated and combined with the password to generate a secure one-way hash. Passwords are never stored in plaintext.

---

## 8. Git & Project Governance

- **Repository:** [https://github.com/Hammadzafar64/DocMind-AI](https://github.com/Hammadzafar64/DocMind-AI)
- **CI/CD:** Automated GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push to validate tests.
- **Meeting Log:** Full meeting notes, technical decision records (ADRs), and future templates are maintained in `MEETING_NOTES.md`.
