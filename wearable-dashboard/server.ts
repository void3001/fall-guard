// Custom Next.js server with Socket.io support
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { initSocketServer } = require('./src/lib/socket-server');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req: any, res: any) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  // Attach Socket.io to the HTTP server
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`✅ Safety Wearable Dashboard running on http://${hostname}:${port}`);
    console.log(`📡 Socket.io server attached`);
  });
});
