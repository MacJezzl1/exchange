const fs = require('fs');

const services = [
  'api-gateway',
  'identity',
  'kyc',
  'ledger',
  'trading',
  'market-data',
  'settlement',
  'chain-watcher',
  'custody-fiat',
  'risk',
  'compliance',
  'notifications',
  'admin-api'
];

services.forEach(svc => {
  const pkg = {
    name: `@exchange/${svc}`,
    version: '0.1.0',
    private: true,
    main: './dist/index.js',
    scripts: {
      build: 'tsc -b',
      start: 'node ./dist/index.js',
      dev: 'node ./dist/index.js',
      test: `echo "Test scaffold for ${svc}"`
    },
    dependencies: {
      '@exchange/shared-types': 'workspace:*'
    },
    devDependencies: {
      '@exchange/config': 'workspace:*',
      typescript: '^5.6.3'
    }
  };
  fs.writeFileSync(`services/${svc}/package.json`, JSON.stringify(pkg, null, 2));

  const tsconfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
      composite: true
    },
    include: ['src/**/*']
  };
  fs.writeFileSync(`services/${svc}/tsconfig.json`, JSON.stringify(tsconfig, null, 2));

  if (!fs.existsSync(`services/${svc}/src`)) {
    fs.mkdirSync(`services/${svc}/src`, { recursive: true });
  }
  fs.writeFileSync(
    `services/${svc}/src/index.ts`,
    `// Service: ${svc}\nexport const SERVICE_NAME = '${svc}';\nconsole.log('[${svc}] Service scaffold ready.');\n`
  );
});

console.log('All 13 TypeScript services scaffolded with package.json, tsconfig.json, and src/index.ts.');
