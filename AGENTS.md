# Repository Guidelines

## Project Structure

- `src/` contains the React + TypeScript interface and responsive styles.
- `public/` contains the PWA manifest, icons, and service worker.
- `server/` contains the Node.js/Express backend scaffold.
- `vite.config.ts` configures the frontend dev server and `/api` proxy.
- Keep provider integrations in backend modules; do not put secrets in browser code.

## Development Commands

Run commands from the project root:

- `npm install` installs the declared dependencies.
- `npm run dev` starts Vite and the Node.js backend together.
- `npm run build` type-checks the frontend and builds production assets.
- `npm run preview` serves the production build locally.

The frontend is available at `http://127.0.0.1:5173`; the backend health endpoint is `/api/health` on port 3001.

## Style & Naming

Use TypeScript for browser code and modern JavaScript modules for the backend. Keep React components in PascalCase, variables and functions in camelCase, and filenames descriptive. Prefer small components and backend services grouped by responsibility. Keep responsive rules in `src/styles.css` and preserve accessible labels and keyboard focus states.

## Testing & Changes

No test framework is configured yet. When adding one, document its command and name test files consistently. Before a pull request, describe user-visible changes and note the validation performed. There is no Git history available in this checkout to establish a commit convention.

## Security & Integrations

Do not add API keys to `src/`, `VITE_*` variables, or committed environment files. Keep credentials on the backend. The current UI is a scaffold: do not represent placeholder actions as completed AI generation or Google Flow integration.
