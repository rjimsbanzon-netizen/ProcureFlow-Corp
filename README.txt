ProcureFlow Global Search — TypeScript build fix

Replace src/pages/GlobalSearchPage.tsx in your project with the file in this archive.
Then run: npm run build
No backend change or D1 migration is required.

Fixes two TypeScript TS2345 errors caused by calling Map.get() with an optional key.
The behavior of search and permissions is otherwise unchanged.
