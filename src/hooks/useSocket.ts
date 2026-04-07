import { useEffect, useState, useRef, useCallback } from 'react';
import { createSocket } from '../api/socket';
import type { Socket } from 'socket.io-client';

function doJoin(
  s: Socket,
  roomId: string,
  nickname: string | undefined,
  setError: (e: string | null) => void,
  setIsHost: (h: boolean) => void,
  setRoomHostId: (id: string | null) => void
) {
  const cb = (reply: { error?: string; isHost?: boolean; hostId?: string }) => {
    if (reply?.error) {
      setError(reply.error);
      return;
    }
    setError(null);
    setIsHost(!!reply?.isHost);
    if (reply?.hostId != null) setRoomHostId(reply.hostId);
  };
  if (typeof nickname === 'string' && nickname.trim()) {
    s.emit('join-room', roomId, nickname.trim(), cb);
  } else {
    s.emit('join-room', roomId, cb);
  }
}

export function useSocket(
  roomId: string | null,
  nickname: string | undefined,
  enabled = true
): {
  socket: Socket | null;
  connected: boolean;
  isHost: boolean;
  error: string | null;
  roomHostId: string | null;
  reconnecting: boolean;
  participantsMap: Record<string, string>;
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => () => void;
} {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomHostId, setRoomHostId] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [participantsMap, setParticipantsMap] = useState<Record<string, string>>({});
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;

  useEffect(() => {
    if (!roomId || enabled === false) return;
    const s = createSocket();
    setSocket(s);

    const join = () => {
      doJoin(s, roomId, nicknameRef.current, setError, setIsHost, setRoomHostId);
    };

    s.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      join();
    });

    s.on('connect_error', () => {
      setError('Connection failed');
      setReconnecting(true);
    });
    s.on('disconnect', (reason: string) => {
      setConnected(false);
      if (reason === 'io server disconnect' || reason === 'io client disconnect') setReconnecting(false);
      else setReconnecting(true);
    });
    s.on('reconnect', () => {
      setReconnecting(false);
      join();
    });
    s.on('host-changed', (newHostId: string) => {
      setRoomHostId(newHostId);
      if (s.id === newHostId) setIsHost(true);
    });
    s.on('participants', (list: { id: string; nickname?: string }[]) => {
      setParticipantsMap((prev) =>
        (Array.isArray(list) ? list : []).reduce((acc, p) => ({ ...acc, [p.id]: p.nickname || 'Guest' }), {})
      );
    });
    s.on('participant-info', ({ id, nickname: n }: { id: string; nickname?: string }) => {
      setParticipantsMap((prev) => ({ ...prev, [id]: n || 'Guest' }));
    });
    s.on('peer-left', (id: string) => {
      setParticipantsMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    return () => {
      s.disconnect();
      setSocket(null);
      setRoomHostId(null);
      setParticipantsMap({});
    };
  }, [roomId, enabled]);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socket?.emit(event, ...args);
  }, [socket]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket]);

  return { socket, connected, isHost, error, roomHostId, reconnecting, participantsMap, emit, on };
}
