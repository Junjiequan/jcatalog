// Everything that is dummy lives in this folder: the seed data, the demo accounts, the mock API and the image generators.
// The app finds it through one optional lookup (src/api/index.ts), so deleting this folder is all it takes to remove them:
// the app then talks to the SciCat backend (VITE_API_MODE=scicat).
export { mockApi } from "./api";
