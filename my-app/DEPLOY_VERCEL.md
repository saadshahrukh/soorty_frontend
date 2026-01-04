Deploy guide — Vercel (concise)

1) What this change does
- Keeps existing Express API but exposes it as a single serverless function.
- All existing routes under `/api/*` are routed to the handler.
- Added `pages/api/server.js` + `vercel.json` and `serverless-http` dependency.

2) Prepare environment
- Use MongoDB Atlas (recommended) and obtain `MONGODB_URI`.
- Required env vars to set in Vercel Project Settings > Environment Variables:
  - `MONGODB_URI` (connection string)
  - `JWT_SECRET` (same as used locally)
  - `CORS_ORIGINS` (comma-separated allowed origins)
  - Any other env var used by your app (e.g., SMTP credentials, SENTRY, etc.)

3) Commit & push
- Commit the changes and push to your Git provider (GitHub/GitLab/Bitbucket).

4) Import to Vercel
- In Vercel dashboard choose "Import Project" and select the repository/branch.
- Use the default build settings for Next.js (Vercel will detect Next).
- Ensure Environment Variables are set in the Vercel project.

5) Build & test
- Vercel will run the build and deploy.
- All requests to `/api/*` will be forwarded to the Express handler.

6) Local testing
- Install deps: `npm install` in `my-app`.
- Run frontend dev: `npm run dev` (Next dev server).
- Run Express locally (optional): `npm run server` will start `server.js` on port 3000.

Notes & troubleshooting
- Serverless limitations: long-running background jobs or WebSocket servers are not supported by this handler. Use external worker services for scheduled/long tasks.
- Set `CORS_ORIGINS` to your frontend origin in production to avoid permissive CORS.
- If you need longer function timeouts, configure Vercel function settings in dashboard (for Pro/Enterprise plans).

If you want, I can:
- Convert each Express route into native Next.js API route handlers (one file per route) instead of a single serverless wrapper.
- Add a GitHub action to auto-deploy on push.
