<div align="center">

# 🎓 AI Tutor Platform
### *Next-Gen Personalized AI Learning & Career Acceleration Engine*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<p align="center">
  <b>An autonomous, multi-agent educational intelligence platform that models each student's unique Learning DNA, provides real-time Socratic AI tutoring, generates personalized career placement roadmaps, and indexes multi-modal course materials using RAG.</b>
</p>

[Explore Features](#-key-features) • [System Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [Deployment](#-deployment) • [API Documentation](#-api-endpoints)

---

</div>

## 🌟 Key Features

### 🧠 1. Socratic AI Tutor & Real-Time Streaming
- **Adaptive Socratic Dialogue:** Guides students through complex engineering & computer science concepts step-by-step rather than just outputting raw answers.
- **Low-Latency Streaming:** Token-by-token response generation with formatted LaTeX math equations, markdown rendering, and syntax-highlighted code blocks.
- **Conversation Memory:** Persistent multi-turn chat memory stored and indexed per student.

### 🧬 2. Dynamic "Learning DNA" Engine
- **Cognitive Profiling:** Continuously calculates retention decay rates, study consistency scores, confidence indexes, and subject-specific knowledge gaps.
- **Adaptive Difficulty:** Dynamically adjusts tutoring vocabulary, challenge complexity, and pacing based on the student's mastery level (Beginner → Intermediate → Advanced).

### 💻 3. Interactive Coding Mentor & Reviewer
- **Monaco Code Editor:** Full IDE experience in the browser with multi-language syntax support (Python, TypeScript, JavaScript, C++, Java).
- **Algorithmic Problem Generation:** Creates on-demand coding exercises tailored to the student's weak subjects.
- **Automated Code Review:** Evaluates student code for time/space complexity, edge cases, best practices, and actionable refactoring suggestions.

### 🎯 4. Career Intelligence & Placement Coach
- **Automated Skill Gap Analysis:** Compares declared skills against student career goals (e.g. Full-Stack Engineer, AI Specialist, Quant).
- **Milestone Roadmaps:** Generates actionable 4-week tactical goals and 3-month strategic milestones.

### 📚 5. Multi-Modal RAG & Knowledge Graph
- **Document Ingestion:** Processes PDF textbooks, lecture notes, slide decks, markdown, and YouTube transcripts.
- **Background Queueing:** High-performance BullMQ + Redis asynchronous worker pipeline for chunking and vector embedding generation.
- **Interactive Knowledge Graph:** Visualizes connections between prerequisite and dependent concepts.

### 🛡️ 6. Zero-Downtime Multi-Provider AI Fallback
- **Resilient AI Orchestration:** Automatically switches AI providers with zero user disruption:
  $$\text{Google Gemini} \longrightarrow \text{Grok (xAI)} \longrightarrow \text{OpenRouter} \longrightarrow \text{OpenAI} \longrightarrow \text{Local Ollama}$$

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client ["Frontend (Next.js 16 + Tailwind CSS)"]
        UI[Dashboard / Tutor UI / Code Editor]
        AuthClient[Supabase Auth & JWT Client]
    end

    subgraph Backend ["Backend API (Express + TypeScript)"]
        Router[API Gateway & Rate Limiter]
        AuthMW[JWT & RBAC Middleware]
        
        subgraph Agents ["Multi-Agent System"]
            TutorAgent[Teaching & Socratic Agent]
            CareerAgent[Career & Placement Agent]
            CodingAgent[Coding Mentor Agent]
            DNAAgent[Learning DNA & Analytics Agent]
        end

        Orchestrator[AI Provider Fallback Orchestrator]
        RAGWorker[BullMQ RAG Ingestion Worker]
    end

    subgraph Data ["Data & AI Layer"]
        Supabase[(PostgreSQL Database)]
        Redis[(Redis Cache & Queue)]
        Gemini[Google Gemini API]
        xAI[xAI Grok Fallback]
        OpenAI[OpenAI Fallback]
    end

    UI --> Router
    Router --> AuthMW --> Agents
    Agents --> Orchestrator
    Orchestrator --> Gemini
    Orchestrator -. Fallback .-> xAI
    Orchestrator -. Fallback .-> OpenAI
    Agents --> Supabase
    Router --> RAGWorker --> Redis
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Monaco Editor, Lucide Icons, Recharts |
| **Backend** | Node.js, Express.js, TypeScript, Zod, Multer, BullMQ |
| **Database & ORM** | PostgreSQL (Supabase), Prisma ORM |
| **Cache & Queue** | Redis, ioredis |
| **AI & Embeddings** | Google Gemini API (`@google/generative-ai`), OpenAI SDK, Xenova Transformers |
| **Parsing & Extraction** | `pdf-parse`, `officeparser`, `youtube-transcript` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm** or **pnpm**
- **PostgreSQL Database** (Local or Supabase)
- **Redis** (Local or Upstash)
- **Google Gemini API Key** (or OpenAI / OpenRouter key)

---

### 1. Clone the Repository
```bash
git clone https://github.com/SuhaibIqbal12/ai-tutor-platform.git
cd ai-tutor-platform
```

---

### 2. Backend Setup
```bash
# Install backend dependencies
npm install

# Configure environment variables
cp .env.example .env
```

Edit `.env` with your credentials:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL="postgresql://user:password@localhost:5432/ai_tutor_db?schema=public"
JWT_SECRET=your_jwt_secret_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

Sync database schema & run the backend:
```bash
npx prisma db push
npm run dev
```
> Backend runs at: `http://localhost:3001`

---

### 3. Frontend Setup
```bash
cd frontend

# Install frontend dependencies
npm install

# Configure frontend environment variables
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run the frontend:
```bash
npm run dev
```
> Frontend runs at: `http://localhost:3000`

---

## 📡 API Endpoints

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Register new student account | Public |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | Public |
| `POST` | `/api/auth/profile` | Update student onboarding & Learning DNA | Bearer |
| `GET`  | `/api/auth/profile` | Retrieve student profile, XP, and DNA metrics | Bearer |
| `POST` | `/api/tutor/ask` | Send question to Socratic AI Tutor | Bearer |
| `POST` | `/api/career/roadmap` | Generate tailored multi-stage career roadmap | Bearer |
| `POST` | `/api/coding/exercise` | Generate tailored coding problem | Bearer |
| `POST` | `/api/coding/review` | Submit student code for automated AI review | Bearer |
| `GET`  | `/api/rag/graph` | Fetch knowledge graph nodes & prerequisites | Bearer |
| `GET`  | `/api/diagnostics/health` | Multi-provider connectivity status report | Public |

---

## 🚢 Deployment

### 🌐 Frontend (Vercel)
1. Import repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy!

### ⚙️ Backend (Render / Railway / Fly.io)
1. Create a new Web Service pointing to this repository.
2. Build command: `npm install && npm run build`
3. Start command: `npm run start`
4. Set your production environment variables (`DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`, etc.).

---

## 🔒 Security & Privacy
- **Zero Credentials Leakage:** All secrets, `.env` files, and local build artifacts are strictly excluded via `.gitignore`.
- **Tenant Isolation:** Every table and AI query is strictly scoped by `userId`.
- **Brute-Force & Rate Protection:** Redis-backed rate limiter protects all compute-intensive AI endpoints.

---

## 👨‍💻 Author & Maintainer
- **Suhaib Iqbal** ([@SuhaibIqbal12](https://github.com/SuhaibIqbal12))
- Email: `suhaibiqbal961@gmail.com`

---

<div align="center">
  <sub>Built with ❤️ for the future of AI-driven education.</sub>
</div>
