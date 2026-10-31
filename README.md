# Metadata Catalog

A research data catalogue UI: search, filter and preview datasets, plus proposals, samples, instruments, jobs and published data. It runs on built-in mock data.

## Run locally

Needs Node 22.22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:4500.

## Develop

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server on http://localhost:4500 |
| `npm run check` | types, lint and tests with a coverage floor: what CI runs (about 12 seconds) |
| `npm test` / `npm run test:watch` | about 290 tests in 7 seconds: [Vitest](https://vitest.dev) and Testing Library on happy-dom, next to the code (`*.test.ts(x)`). Pure logic is unit-tested; the pages are tested the way a person uses them, against the mock backend (`src/test/app.tsx` renders the whole app) |
| `npm run test:coverage` | the same with coverage; fails below the floor set in `vite.config.ts` (about 79% of lines today) |
| `npm run lint` | [oxlint](https://oxc.rs): correctness, React, hooks and accessibility rules (`.oxlintrc.json`) |

Where things are:

```
src/
  api/            the CatalogApi contract, the SciCat adapter, the data hooks
  components/     shared building blocks (ui/ by kind: navigation, badges, feedback, page, Table…)
  features/       one folder per area: datasets (page, detail/ tabs, filters/ widgets), proposals, catalog, settings, auth
  hooks/ lib/     small hooks and pure logic (query, filters, lineage, format) with their tests
  store/          UI state (zustand)
config/           settings read at runtime: filters.yaml, app.yaml
mock/             all dummy data, deletable (see below)
```

Lint reports 15 warnings that are left on purpose and visible: effects that set state and refs read during render, which a React Compiler would flag. They are not bugs today; fix them when touching those components.

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

General settings (how many items Recently viewed keeps) are in [`config/app.yaml`](config/app.yaml); like the filter file, it is read when the page loads, so editing it needs no rebuild.

The Datasets filter panel is configured by [`config/filters.yaml`](config/filters.yaml) (order, labels, widgets, limits, which measured properties are offered). Edit it and reload; no rebuild. Mistakes are reported in the browser console and the default is used.
