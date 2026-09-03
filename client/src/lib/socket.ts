import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Dynamically detect server host so local Wi-Fi IP (e.g. 192.168.x.x) works seamlessly
    let serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    
    if (!process.env.NEXT_PUBLIC_SOCKET_URL && typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      serverUrl = `http://${hostname}:4000`;
    }

    socket = io(serverUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log(`⚡ Connected to Socket.io backend server at ${serverUrl} [Socket ID: ${socket?.id}]`);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err);
    });
  }

  return socket;
};
