<div align="center">

# AI Tutor Platform
### A workspace for tutoring, coding practice, and study planning

**TypeScript · Next.js · Express · Prisma · PostgreSQL · Gemini**

[Getting started](#getting-started) · [Architecture](#architecture) · [Development checks](#development-checks)

</div>

## Overview

AI Tutor Platform brings tutoring conversations, quizzes, coding exercises, career guidance, study planning, and document-based learning into a student dashboard.

The repository contains a Next.js frontend and an Express/TypeScript backend. It is an application under development; configured providers, infrastructure, and end-to-end testing determine which features are available in a given environment.

## Project areas

| Area | Source |
| --- | --- |
| Tutor conversations and streaming | `src/controllers/tutor.controller.ts`, `src/services/tutor.service.ts` |
| Coding exercises and review | `src/agents/coding.agent.ts`, frontend coding page |
| Quizzes and evaluation | `src/services/quiz.service.ts` |
| Study plans and career guidance | Planner and career agents / controllers |
| Learning profiles and analytics | DNA service, analytics agent, Prisma models |
| Document ingestion and RAG | RAG service, queue, and worker |
| Provider fallback | `src/services/ai-provider.service.ts` |

The provider service implements a configured fallback sequence across Gemini, xAI, OpenRouter, OpenAI, and local Ollama. Fallback availability depends on valid credentials, supported models, and provider responses; seamless recovery is not guaranteed.

## Architecture

| Component | Responsibility |
| --- | --- |
| `frontend/` | Next.js dashboard, authentication UI, editor, and tutor pages |
| `src/routes/`, `src/controllers/` | Express API and request handlers |
| `src/agents/`, `src/engines/` | Learning tasks and orchestration |
| `src/services/` | Tutor, quizzes, RAG, profiles, and provider logic |
| `src/middleware/` | Authentication, validation, errors, and rate limits |
| `prisma/schema.prisma` | PostgreSQL data model |
| `src/queues/`, `src/workers/` | Redis/BullMQ document processing |
| `public/` | Additional static client assets |

The frontend proxies `/api/*` to `http://localhost:3001` through `frontend/next.config.ts`.

## Getting started

### Prerequisites

- Node.js compatible with the checked-in Next.js 16 and dependency versions.
- npm.
- PostgreSQL, locally or through Supabase.
- Redis for queued RAG processing.
- Credentials for the AI providers you intend to use.
- Your own Supabase configuration for frontend authentication.

### 1. Backend

```bash
git clone https://github.com/SuhaibIqbal12/ai-tutor-platform.git
cd ai-tutor-platform
npm install
cp .env.example .env
```

On Windows, copy `.env.example` to `.env` through VS Code or PowerShell. Configure the local file with your own values:

| Variable | Purpose |
| --- | --- |
| `PORT=3001` | Matches the frontend's local API proxy |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | A long random authentication secret |
| `GEMINI_API_KEY` | Primary AI provider |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` | Supabase integration |
| `REDIS_URL` | Queue connection; add it when using the RAG worker |
| `XAI_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY` | Optional fallback providers |
| `OLLAMA_BASE_URL` | Optional local provider |

Keep credentials local. The backend defaults to port 3000 if `PORT` is absent, so explicitly set 3001 to avoid colliding with the frontend.

For a new development database:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

`prisma db push` synchronizes the schema; use a dedicated development database. Review migrations before applying database changes to existing data.

### 2. Frontend

Open a second terminal:

```bash
cd ai-tutor-platform/frontend
npm install
```

Create `frontend/.env.local` manually; a frontend `.env.example` is not included:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-project-publishable-key
```

Use your own project configuration rather than relying on source defaults.

```bash
npm run dev
```

Open http://localhost:3000. The backend should be running on http://localhost:3001.

## Development checks

Backend:

```bash
npm run build
```

Frontend:

```bash
npm run lint
npm run build
```

The root also includes `test-e2e.js`, `test-batch.js`, and `test-transformers.js`. Review their prerequisites before running them: they are development scripts, not a configured `npm test` suite. Some checks can contact AI services and require infrastructure.

## Configuration and project status

- PostgreSQL is the active Prisma provider. The checked-in `prisma/dev.db` is not the configured PostgreSQL database.
- The RAG worker is conditionally loaded when Redis configuration is present.
- Provider diagnostics and streaming depend on the active environment and quota.
- Production readiness, authorization boundaries, and data handling require validation before deployment.
- No fresh build or end-to-end pass is claimed by this documentation update.

## Maintainer

[Suhaib Iqbal](https://github.com/SuhaibIqbal12)

The backend package declares ISC. A standalone LICENSE file is not currently included.
