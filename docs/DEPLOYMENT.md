# Deployment and verification

The repository has two frontends: legacy Express `public/` and Next.js `frontend/`. Deploying the repository root as an Express function serves the legacy UI. For the Next dashboard, set the Vercel project Root Directory to `frontend`, framework Next.js, and `BACKEND_URL` to your persistent HTTPS backend origin. The proxy routes `/api/:path*` to that origin. Never put database credentials or model keys in `NEXT_PUBLIC_*`.

## Backend and worker

Run these on a persistent Node host/container (Node 22 LTS recommended), with PostgreSQL and Redis reachable from both processes. BullMQ workers and embedding downloads cannot rely on short-lived serverless functions.

1. `npm ci`
2. Copy `.env.example` to `.env` locally, or set the variables in the host's environment settings.
3. Set `DATABASE_URL` to the PostgreSQL connection string from your database provider. Add TLS parameters if the provider requires them. This implementation stores validated vectors as JSON text in `DocumentChunk.embedding`; it does **not** require pgvector or Chroma.
4. Set `REDIS_URL` to the Redis provider's connection string, including authentication. Use `rediss://` when TLS is required.
5. Generate a unique `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and set the result privately. Minimum length: 32 characters.
6. Set at least one provider key: `GEMINI_API_KEY` (Google AI Studio), `XAI_API_KEY` (xAI console), `OPENROUTER_API_KEY` (OpenRouter keys), or `OPENAI_API_KEY` (OpenAI Platform API keys). Alternatively set `OLLAMA_BASE_URL` to an accessible Ollama server with the configured model installed. The existing fallback order is Gemini → xAI → OpenRouter → OpenAI → Ollama. A configured key is not proof of successful API access.
7. Set `FRONTEND_ORIGIN` to the deployed frontend HTTPS origin. Set `TRUST_PROXY=true` only when exactly one trusted reverse proxy fronts the backend.
8. Back up the database, then run `npx prisma migrate deploy`. Do not use `migrate reset` on production. An existing database created with `db push` may require migration baselining before deploy; review its migration history first.
9. `npm run build`
10. Start API process: `npm start`.
11. Start a separate persistent worker process: `npm run worker`, with the same database/Redis/provider configuration. Keep `RAG_WORKER_ENABLED=false`. For local development only, `RAG_WORKER_ENABLED=true npm run dev` can run both together.
12. Give the worker disk/RAM and outbound HTTPS access to download `Xenova/all-MiniLM-L6-v2`. Set `EMBEDDING_CACHE_DIR` to a writable persistent cache directory if needed.

`/health` is liveness only. `/ready` requires database, Redis, at least one registered worker, auth configuration and at least one configured provider. It does not make a paid model request, so it cannot certify provider connectivity or answer quality.

## Existing data and accounts

The additive migration preserves old document rows and marks them `NEEDS_REINDEX`. Run `npm run reindex` to rebuild only those rows using retained extracted text and the shared pipeline. This does not need a Gemini key for embeddings; optional enrichment may be unavailable. Old records did not retain reliable page metadata: re-upload originals when page-level citations matter. Empty/invalid retained text requires re-upload. Do not run the script while another worker is processing the same documents.

Old mock accounts have no valid password hash. Do not give them a shared password or silently create a password at login. Verified Supabase OAuth can recover an existing account with the same confirmed email. Otherwise a verified account recovery flow still needs implementation; contact the operator before registering another identity and splitting data ownership.

## Next frontend and optional OAuth

In `frontend` run `npm ci`. Set server-side `BACKEND_URL=https://YOUR_BACKEND_ORIGIN` before `npm run build`. Missing/invalid origin fails production build. Deploy with this environment variable available at build time.

Optional Supabase OAuth:
- Backend: `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase project settings.
- Frontend: matching `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public publishable/anon key only).
- Enable Google/GitHub providers in Supabase Auth and configure their credentials there.
- Allow `https://YOUR_FRONTEND/login` as an Auth redirect URL, plus your local test URL.
- If using the account-deletion webhook, set a private `SUPABASE_WEBHOOK_SECRET` and configure the webhook to send the same value as `x-webhook-secret`. Without this setting the deletion endpoint is disabled.

## Optional material extraction

Text PDFs and Office files use local parsers. Scanned PDFs currently require a text/OCR version. Images require Gemini and a supported JPEG/PNG/WebP file.

YouTube uses `youtube-transcript` with preserved caption offsets. For caption fallback, install `python3 -m pip install yt-dlp` on the worker and set `YOUTUBE_FALLBACK_ENABLED=true`, `PYTHON_BIN=python3`. Audio fallback additionally requires ffmpeg, `GEMINI_API_KEY`, and `YOUTUBE_AUDIO_FALLBACK_ENABLED=true`. It is bounded to 10 minutes/10MB and has no verified timestamps. These external extraction paths still require live smoke testing.

## Release checks

Run `TEST_REDIS_URL=redis://127.0.0.1:6379 npm test` with a test Redis instance. Tests use isolated PGlite PostgreSQL-compatible storage, real local embeddings and stubs for paid generation. They do not use the production database. Run `npm run test:rag-eval`; the related-but-absent case explicitly requires live generation review.

Run `cd frontend && npm run lint && BACKEND_URL=http://localhost:3001 npm run build`.

After deployment, test in desktop and mobile browsers: register/login, OAuth if enabled, upload a real PDF, watch durable stages through READY, ask direct/paraphrased/multi-page questions, check quoted facts and page citations, ask related and unrelated absent questions, follow up, switch source and account, generate/submit MCQ and written quizzes, inspect analytics. Also smoke-test coding, ATS/resume, interview, planner and roadmap with real models. The automated suite is not a substitute for these release gates.

## One-command localhost stack

With Docker Desktop running, copy `.env.example` to `.env`, set a URL-safe random `LOCAL_DB_PASSWORD`, a random `JWT_SECRET` of at least 32 characters, and one valid model-provider key. Then run:

```bash
docker compose up --build -d
```

Open http://localhost:3000. The API is http://localhost:3001; `/ready` reports whether the database, Redis, worker, authentication and provider configuration are ready. Compose runs migrations before the API and worker, retains database/Redis/model-cache volumes, and binds ports to your computer's loopback interface. Keep this local stack private; it is not a production hosting service. Stop with `docker compose down` without `--volumes` to retain data. Docker images still require a real provider smoke test and must be verified on a Docker-enabled host before release.
