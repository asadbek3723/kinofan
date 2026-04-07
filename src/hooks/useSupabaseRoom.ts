import React, { useEffect, useState, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '../api/supabase';
import { getRoom, updateRoomHost, sendChatMessage, ensureRoom } from '../api/rooms';
import type { ChatMessage } from '../api/rooms';

const CHANNEL_PREFIX = 'room:';
const CLIENT_ID_KEY = 'kinofan_client_id';

function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return nanoid();
  const stored = localStorage.getItem(CLIENT_ID_KEY);
  if (stored && stored.length > 0) return stored;
  const id = nanoid();
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

interface UseSupabaseRoomOptions {
  enabled?: boolean;
}

export default function useSupabaseRoom(
  roomId: string | null,
  nickname: string | undefined,
  options: UseSupabaseRoomOptions = {}
) {
  const { enabled = true } = options;
  const clientIdRef = useRef(getOrCreateClientId());
  const clientId = clientIdRef.current;

  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomHostId, setRoomHostId] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [participantsMap, setParticipantsMap] = useState<Record<string, string>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const channelRef = useRef<any>(null);
  const messagesChannelRef = useRef<any>(null);
  const presenceKeysRef = useRef(new Set<string>());
  const handlersRef = useRef<Record<string, ((...args: unknown[]) => void)[]>>({});
  const roomHostIdRef = useRef<string | null>(null);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    const ch = channelRef.current;
    if (!ch) return;
    const payload = args[0];
    ch.send({
      type: 'broadcast',
      event: event,
      payload: (payload && typeof payload === 'object') ? { from: clientId, ...payload } : { from: clientId, data: payload },
    });
  }, [clientId]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    if (!handlersRef.current[event]) handlersRef.current[event] = [];
    handlersRef.current[event].push(handler);
    return () => {
      handlersRef.current[event] = (handlersRef.current[event] || []).filter((h) => h !== handler);
    };
  }, []);

  const fire = useCallback((event: string, ...args: any[]) => {
    (handlersRef.current[event] || []).forEach((h: (...args: any[]) => void) => {
      try {
        h(...args);
      } catch (e) {
        console.error('useSupabaseRoom handler error', e);
      }
    });
  }, []);

  useEffect(() => {
    if (!roomId || !supabase || enabled === false) return;

    setError(null);
    let channel: ReturnType<typeof supabase.channel>;
    const channelName = CHANNEL_PREFIX + roomId;

    (async () => {
      let room = await getRoom(roomId);
      if (!room) {
        const created = await ensureRoom(roomId);
        if (!created) {
          setError('Room not found');
          return;
        }
        room = { id: roomId, host_id: null };
      }

      channel = supabase.channel(channelName, {
        config: {
          presence: { key: clientId },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const nextMap: Record<string, string> = {};
          const currentKeys = new Set<string>();
          Object.entries(state).forEach(([key, presences]) => {
            currentKeys.add(key);
            const p = Array.isArray(presences) ? presences[0] : presences;
            nextMap[key] = (p as { nickname?: string })?.nickname || 'Guest';
          });
          setParticipantsMap(nextMap);

          currentKeys.forEach((key) => {
            if (!presenceKeysRef.current.has(key) && key !== clientId) {
              fire('peer-joined', key);
            }
          });
          presenceKeysRef.current.forEach((key) => {
            if (!currentKeys.has(key)) {
              fire('peer-left', key);
              if (key === roomHostIdRef.current) {
                const remaining = Object.keys(nextMap).filter((k) => k !== key);
                if (remaining.length > 0) {
                  const newHost = remaining[0];
                  updateRoomHost(roomId, newHost).then((ok) => {
                    if (ok) {
                      setRoomHostId(newHost);
                      roomHostIdRef.current = newHost;
                      channel.send({ type: 'broadcast', event: 'host-changed', payload: { newHostId: newHost } });
                    }
                  });
                }
              }
            }
          });
          presenceKeysRef.current = currentKeys;
        })
        .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
          const leftKey = key;
          presenceKeysRef.current.delete(leftKey);
          setParticipantsMap((prev: Record<string, string>) => {
            const next = { ...prev };
            delete next[leftKey];
            return next;
          });
          fire('peer-left', leftKey);
          if (leftKey === roomHostIdRef.current) {
            const state = channel.presenceState();
            const remaining = Object.keys(state).filter((k) => k !== leftKey);
            if (remaining.length > 0) {
              const newHost = remaining[0];
              updateRoomHost(roomId, newHost).then((ok) => {
                if (ok) {
                  setRoomHostId(newHost);
                  roomHostIdRef.current = newHost;
                  channel.send({ type: 'broadcast', event: 'host-changed', payload: { newHostId: newHost } });
                }
              });
            }
          }
        })
        .on('broadcast', { event: 'signal' }, ({ payload }: { payload: unknown }) => {
          if (payload && typeof payload === 'object' && (payload as { from?: string }).from !== clientId) fire('signal', payload);
        })
        .on('broadcast', { event: 'video-control' }, ({ payload }: { payload: unknown }) => {
          if (payload && typeof payload === 'object' && (payload as { from?: string }).from !== clientId) fire('video-control', payload);
        })
        .on('broadcast', { event: 'host-changed' }, ({ payload }: { payload?: { newHostId?: string } }) => {
          if (payload?.newHostId != null) {
            setRoomHostId(payload.newHostId);
            roomHostIdRef.current = payload.newHostId;
            setIsHost(payload.newHostId === clientId);
          }
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            setConnected(true);
            setReconnecting(false);
            await channel.track({ clientId, nickname: nickname || 'Guest' });

            const roomAgain = await getRoom(roomId);
            if (roomAgain) {
              if (roomAgain.host_id == null || roomAgain.host_id === '') {
                const ok = await updateRoomHost(roomId, clientId);
                if (ok) {
                  setRoomHostId(clientId);
                  setIsHost(true);
                  roomHostIdRef.current = clientId;
                  channel.send({ type: 'broadcast', event: 'host-changed', payload: { newHostId: clientId } });
                } else {
                  const r = await getRoom(roomId);
                  setRoomHostId(r?.host_id ?? null);
                  roomHostIdRef.current = r?.host_id ?? null;
                  setIsHost(r?.host_id === clientId);
                }
              } else {
                setRoomHostId(roomAgain.host_id);
                roomHostIdRef.current = roomAgain.host_id;
                setIsHost(roomAgain.host_id === clientId);
              }
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnected(false);
            setReconnecting(true);
          } else if (status === 'CLOSED') {
            setConnected(false);
          }
        });

      channelRef.current = channel;

      const changesChannel = supabase!
        .channel(`messages:${roomId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new;
            if (row) {
              setChatMessages((prev: ChatMessage[]) => {
                if (prev.some((m: ChatMessage) => m.id === row.id)) return prev;
                return [
                  ...prev,
                  {
                    id: row.id as string,
                    from: row.sender_id as string,
                    nickname: (row.nickname as string) || 'Guest',
                    text: row.text as string,
                    at: new Date(row.created_at as string).getTime(),
                  },
                ];
              });
            }
          }
        )
        .subscribe();
      messagesChannelRef.current = changesChannel;

      const { data: initialMessages } = await supabase!
        .from('messages')
        .select('id, sender_id, nickname, text, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (Array.isArray(initialMessages)) {
        setChatMessages(
          initialMessages.map((m: any) => ({
            id: m.id as string,
            from: m.sender_id as string,
            nickname: (m.nickname as string) || 'Guest',
            text: m.text as string,
            at: new Date(m.created_at as string).getTime(),
          }))
        );
      }
    })();

    return () => {
      const ch = channelRef.current;
      const msgCh = messagesChannelRef.current;
      if (ch) {
        ch.unsubscribe();
        channelRef.current = null;
      }
      if (msgCh) {
        msgCh.unsubscribe();
        messagesChannelRef.current = null;
      }
      setConnected(false);
      setRoomHostId(null);
      setParticipantsMap({});
      presenceKeysRef.current = new Set();
    };
  }, [roomId, clientId, nickname, fire, enabled]);

  const handleSendChat = useCallback(
    (text: string) => {
      if (!roomId) return;
      sendChatMessage(roomId, clientId, nickname || '', text)
        .then((msg) => {
          if (msg) setChatMessages((prev: ChatMessage[]) => [...prev, msg]);
        })
        .catch((e) => {
          console.error('Send chat error', e);
        });
    },
    [roomId, clientId, nickname]
  );

  const socket = { id: clientId };

  return {
    socket,
    connected,
    isHost,
    error,
    roomHostId,
    reconnecting,
    participantsMap,
    emit,
    on,
    chatMessages,
    setChatMessages,
    handleSendChat,
  };
}
