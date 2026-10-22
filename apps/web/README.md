# TaskFlow web

React + TypeScript + Vite frontend for the TaskFlow API (`docs/api/openapi.yaml`).

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to http://localhost:8000
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run build      # typecheck + production build to dist/
```

The app talks only to the real API through `src/api/client.ts`. Fetch is mocked
in tests only (`src/test/fetchMock.ts`).
