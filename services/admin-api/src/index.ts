export * from './types';
export * from './audit';
export * from './approvals';
export * from './service';
export * from './server';

if (require.main === module) {
  const { createAdminApiServer } = require('./server');
  const app = createAdminApiServer(8081);
  app.start().then((port: number) => {
    console.log(`[admin-api] Isolated Admin API running on port ${port}`);
    console.log(`[admin-api] Hardware MFA and Maker-Checker four-eyes engine active.`);
  });
}
