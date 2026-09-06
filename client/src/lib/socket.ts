import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Dynamically detect server host so local Wi-Fi IP works seamlessly, and fallback to Render in production
    let serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    
    if (!serverUrl && typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');
      if (isLocal) {
        serverUrl = `http://${hostname}:4000`;
      } else {
        serverUrl = 'https://se-quiz-server.onrender.com';
      }
    } else if (!serverUrl) {
      serverUrl = 'http://localhost:4000';
    }

    socket = io(serverUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
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
