import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export function getDashboardSocket(): Socket {
  if (!socket) {
    socket = io(`${WS_URL}/dashboard`, {
      transports: ['websocket'],
      autoConnect: true,
      auth: (cb) => cb({ token: localStorage.getItem('token') || '' }),
    });
  }
  return socket;
}

export function resetDashboardSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
