# Metadata Catalog

A research data catalogue UI: search, filter and preview datasets, plus proposals, samples, instruments, jobs and published data. It runs on built-in mock data.

## Run locally

Needs Node 22.22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:4500.

## Run with Docker

Only Docker is needed, nothing to build or install:

```bash
docker compose up
```

Open http://localhost:4500. Your source folder is mounted into the container, so the page reloads as you edit and save. The first start installs the dependencies (a minute); later starts are quick.

## Live site

Every push to `master` also publishes the app to GitHub Pages: https://junjiequan.github.io/jcatalog/

## Data

The UI talks only to the `CatalogApi` contract in `src/api/types.ts`. Screens read through TanStack Query hooks in `src/api/hooks.ts`.

### Dummy data: the `mock/` folder

Everything that is fake lives in [`mock/`](mock/): the seeded datasets, proposals, samples, instruments and attachments, the demo accounts and test sign-up, the mock API, the image generators and the instrument drawings. Nothing under `src/` imports it except one optional lookup in `src/api/index.ts`.

**To remove all dummy data and accounts, delete the `mock/` folder.** The app still builds and then uses the SciCat adapter in `src/api/scicat/` (set `VITE_SCICAT_URL`; its methods are still to be filled in). `VITE_API_MODE=scicat` chooses the backend even while `mock/` exists.

The Datasets filter panel is configured by [`config/filters.yaml`](config/filters.yaml) (order, labels, widgets, limits, which measured properties are offered). Edit it and reload; no rebuild. Mistakes are reported in the browser console and the default is used.
