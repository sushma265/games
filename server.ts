import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { RoomManager } from './server/roomManager';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const PORT = 3000;

  app.use(express.json());

  // Attach RoomManager for authoritative multiplayer room handling
  const roomManager = new RoomManager(io);

  // Health and diagnostic API endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'EARTH // SHUKA Server',
      activeRooms: roomManager.getRoomCount(),
      timestamp: Date.now()
    });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[EARTH // SHUKA] Full-stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[EARTH // SHUKA] Server startup error:', err);
  process.exit(1);
});
