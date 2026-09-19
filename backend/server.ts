import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './roomManager';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Attach RoomManager for authoritative multiplayer room handling
  const roomManager = new RoomManager(io);

  // Root and Health API endpoints
  app.get(['/', '/api/health'], (_req, res) => {
    res.json({
      status: 'online',
      service: 'EARTH // SHUKA Server',
      activeRooms: roomManager.getRoomCount(),
      timestamp: Date.now()
    });
  });

  // Serve static frontend files if present (optional single-host setup)
  const frontendDistPath = path.join(process.cwd(), '..', 'frontend', 'dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
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
