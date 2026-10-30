# metadatacatalogue

A research data catalogue UI: search, filter and preview datasets, plus proposals, samples, instruments, jobs and published data. It runs on built-in mock data.

## Run locally

Needs Node 22.22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Run with Docker

Only Docker is needed, nothing to build:

```bash
docker compose up
```

Open http://localhost:8080. The image is pulled from `ghcr.io/junjiequan/jcatalog`, which GitHub rebuilds on every push to `master`.

## Live site

Every push to `master` also publishes the app to GitHub Pages: https://junjiequan.github.io/jcatalog/

## Data

The UI talks only to the `CatalogApi` contract in `src/api/types.ts`. `VITE_API_MODE=mock` (default) serves the in-memory seed; `VITE_API_MODE=scicat` with `VITE_SCICAT_URL` uses the SciCat adapter in `src/api/scicat/` (endpoint map there, methods still to be filled in). Screens read through TanStack Query hooks in `src/api/hooks.ts`.

The Datasets filter panel is configured by `public/filters.yaml` (order, labels, widgets, limits, which measured properties are offered). Edit it and reload; no rebuild. Mistakes are reported in the browser console and the default is used.
