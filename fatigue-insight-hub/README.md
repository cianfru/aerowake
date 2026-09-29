# AeroWake frontend

Node 22.12+ on the Node 22 line; React 18, TypeScript, Vite, Tailwind and Recharts.

```sh
npm ci
VITE_API_URL=http://127.0.0.1:8000 npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

`VITE_API_URL` is a public build-time API origin, not a secret. Production builds inject `VERCEL_GIT_COMMIT_SHA` when available; the app footer exposes the build for support. Configure the API's CORS origins to match deployment. All routes rewrite to `index.html` (see `vercel.json`).

The public landing route loads independently of the heavy analysis view. Application hubs are `/roster`, `/report`, `/history` and `/learn`; account controls are `/account`, recovery/verification `/account-action`, and data policy `/privacy`.

Globe and flat-route views use bundled land geometry. Coordinate resolution is batched, shared between consumers and retryable; the route list remains available during errors. No third-party tile token is used.

Authentication changes remount private analysis state and clear query/draft caches. Guest access uses a random per-tab capability. Draft persistence is explicitly optional, per-tab, and removed on sign-out. Reports contain personal information: exports are controlled by the pilot.

See [deployment and release gates](../docs/LAUNCH_HARDENING.md) before publishing.
