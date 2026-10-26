# OptionsCrafted Platform App (React MVP foundation)

Development: `npm install && npm run dev` from this folder. Build: `npm run build`.

## Architecture
- React + TypeScript + Vite with client-side routing
- `src/core/contracts.ts`: versionable data-provider and product contracts
- `src/data/demoProvider.ts`: replaceable demo adapter
- `src/core/access.ts`: simulated tier grants, **not real security**
- `src/core/catalog.ts`: products separate from subscription tiers
- Tools remain in `../tools/` untouched

## Commercial model
WordPress + Thrive remain the storefront, content CMS, and checkout for the initial 1–2 products. App authentication, product access, purchases and real entitlements must later be implemented through a secure backend (e.g. verified WordPress purchase events), never trusted from the frontend.

## Important
No API keys or private algorithms should be committed to this public repository. The current financial data are entirely illustrative. Do not imply a working options pricing engine exists in the new frontend yet.

## Publishing
Build to static assets, then deploy the contents of `dist` to `platform-preview/` on GitHub Pages. Vite `base` is set for that deployment directory. The React source folder itself is not directly browsable on GitHub Pages.
