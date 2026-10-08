const path = require('path');
const fs = require('fs');

const distIndex = path.join(__dirname, 'dist', 'index.js');

if (fs.existsSync(distIndex)) {
  require(distIndex);
} else {
  const { createAdminApiServer } = require('./dist/server');
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8081;
  const app = createAdminApiServer(port);
  app.start().then((p) => {
    console.log(`[admin-api] Server running on port ${p}`);
  });
}
