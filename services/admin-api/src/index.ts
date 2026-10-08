export * from './types';
export * from './audit';
export * from './approvals';
export * from './service';
export * from './server';
import { createAdminApiServer } from './server';

if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8081;
  const app = createAdminApiServer(port);
  app.start().then((port: number) => {
    console.log(`[admin-api] Isolated Admin API running on port ${port}`);
    console.log(`[admin-api] Hardware MFA and Maker-Checker four-eyes engine active.`);
  });
}
