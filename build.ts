// Production build for JACK.
//
// IMPORTANT: this uses the SAME programmatic Bun.build() call as server.ts.
// The Bun CLI (`bun build ...`) emits the dev JSX transform (`jsxDEV`) but
// defines NODE_ENV=production, so React's jsx-dev-runtime doesn't export
// `jsxDEV` and the bundle crashes with "jsxDEV is not a function" at runtime.
// Calling Bun.build() from a script keeps the JSX runtime and React's runtime
// consistent, producing a bundle that actually boots. Correctness over a few
// hundred KB of minification.

const result = await Bun.build({
  entrypoints: ['./src/index.tsx'],
  outdir: './public',
  naming: 'bundle.js',
  minify: false,
  sourcemap: 'external',
})

if (!result.success) {
  console.error('❌ Build failed:')
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

const bundle = result.outputs.find((o) => o.path.endsWith('bundle.js'))
const kb = bundle ? (bundle.size / 1024).toFixed(1) : '?'
console.log(`✅ Build complete — public/bundle.js (${kb} KB)`)
