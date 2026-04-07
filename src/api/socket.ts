import { io, Socket } from 'socket.io-client';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '';

export function createSocket(): Socket {
  return io(BASE_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
}

export async function createRoom(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/rooms`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
    const msg = body?.message ?? body?.error;
    throw new Error(typeof msg === 'string' && msg ? msg : 'Xona yaratib bo‘lmadi');
  }
  const { roomId } = (await res.json()) as { roomId: string };
  return roomId;
}
