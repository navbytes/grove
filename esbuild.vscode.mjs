import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      }
      console.log('[watch] build finished');
    });
  },
};

// Extension host bundle (Node.js / CJS)
const extensionCtx = await esbuild.context({
  entryPoints: ['src/vscode/extension.ts'],
  bundle: true,
  outfile: 'dist/vscode/extension.cjs',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !production,
  sourcesContent: false,
  minify: production,
  logLevel: 'warning',
  plugins: [esbuildProblemMatcherPlugin],
});

// Webview bundle (browser / IIFE)
const webviewCtx = await esbuild.context({
  entryPoints: ['src/vscode/views/dashboard/main.ts'],
  bundle: true,
  outfile: 'dist/vscode/views/dashboard/main.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: !production,
  sourcesContent: false,
  minify: production,
  logLevel: 'warning',
});

if (watch) {
  await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
} else {
  await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
  await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
}
