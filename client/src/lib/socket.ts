import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');
    if (isLocal) {
      return `http://${hostname}:4000`;
    }
    return process.env.NEXT_PUBLIC_SOCKET_URL || 'https://se-quiz-server.onrender.com';
  }
  return process.env.NEXT_PUBLIC_SOCKET_URL || 'https://se-quiz-server.onrender.com';
};

export const getSocket = (): Socket => {
  if (!socket) {
    const serverUrl = getServerUrl();

    socket = io(serverUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
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
