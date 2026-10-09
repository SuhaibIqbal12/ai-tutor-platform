# Tutor frontend

The Next.js application provides the landing page, account setup, learning dashboard, resource library, tutor chat, practice quizzes, coding studio, career preparation, and study planner.

## Run locally

From this directory:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `BACKEND_URL` to the backend origin (for example, `http://localhost:3001`, without `/api`). Next.js proxies the frontend’s `/api` requests to this origin. Run the backend and its worker separately using the repository’s [deployment guide](../docs/DEPLOYMENT.md). Optional Supabase settings enable the configured OAuth providers; password authentication uses the backend.

Open http://localhost:3000. Dashboard figures come from the API. A failed request shows an error and retry action rather than sample activity.

## Verify changes

```bash
npm test
npm run lint
npm run build
```

The frontend tests exercise sign-in, account creation, onboarding submission, dashboard failures, session preservation during an outage, navigation, and notifications with mocked network responses. They do not verify live OAuth or generated tutor answers. Backend integration tests run from the repository root.

## Interface conventions

Shared colors, spacing, typography, focus states, and responsive layouts live in `src/app/globals.css`. Use `PageHeader` for workspace titles, `NoticeProvider` for user-visible notifications, and `CollapsiblePanel` for Markdown study material. `MindMap` renders sanitized Mermaid diagrams with strict security settings. Navigation supports desktop collapse and a keyboard-accessible mobile drawer; users can select a light or dark theme.

Check desktop and mobile layouts in a browser before releasing a visual change. A production build and DOM tests do not replace visual review.
