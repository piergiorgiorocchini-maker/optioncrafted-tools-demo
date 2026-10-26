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
WordPress + Thrive remain the public marketing, editorial, SEO and communication environment. Checkout is deliberately undecided: purchases and upgrades may be initiated and completed inside the app, on WordPress, or through a hosted checkout. Subscription tiers, standalone products, add-ons and internal upgrades must be supported by a payment-provider-independent product/entitlement model. Backend verification of purchases and access rights will be required before launch.

## Important
No API keys or private algorithms should be committed to this public repository. The current financial data are entirely illustrative. Do not imply a working options pricing engine exists in the new frontend yet.

## Publishing
Build to static assets, then deploy the contents of `dist` to `platform-preview/` on GitHub Pages. Vite `base` is set for that deployment directory. The React source folder itself is not directly browsable on GitHub Pages.
