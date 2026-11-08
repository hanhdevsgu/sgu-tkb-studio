const { createServer } = require('vite');
const path = require('path');

async function start() {
  try {
    const server = await createServer({
      configFile: path.resolve(__dirname, '../vite.config.ts'),
      server: {
        port: 3000,
        host: true,
      },
    });
    await server.listen();
    server.printUrls();
    console.log('[Dev Server] SGU TKB Studio Vite server listening reliably on port 3000');
  } catch (err) {
    console.error('[Dev Server] Fatal startup error:', err);
    process.exit(1);
  }
}

start();

