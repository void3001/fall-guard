import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer) {
  if (io) return io;
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    path: '/api/socket',
  });

  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('[Socket.io] Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitTelemetry(data: unknown) {
  io?.emit('telemetry-update', data);
}

export function emitAlert(data: unknown) {
  io?.emit('alert-triggered', data);
}
