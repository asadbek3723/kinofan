import { nanoid } from 'nanoid';
import { supabase } from './supabase';

export interface RoomRow {
  id: string;
  host_id: string | null;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  nickname: string;
  text: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  from: string;
  nickname: string;
  text: string;
  at: number;
}

/**
 * Build a canonical public URL for a room.
 */
export function getRoomUrl(roomId: string): string {
  const publicUrl = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');
  return `${publicUrl}/room/${roomId}`;
}

/** Yangi xona id (Supabase rejimida darhol navigatsiya uchun) */
export function generateRoomId(): string {
  return nanoid(21);
}

/** Xona yaratish (DB ga yozish). Supabase rejimida kerak bo‘lsa sahifa ochilganda chaqiladi. */
export async function createRoom(): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const roomId = nanoid(21);
  const { error } = await supabase.from('rooms').insert({ id: roomId, host_id: null });
  if (error) throw new Error(error.message || 'Failed to create room');
  return roomId;
}

/** Xona yo‘q bo‘lsa yaratadi (bir marta). Supabase rejimida tez kirish uchun. */
export async function ensureRoom(roomId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('rooms').insert({ id: roomId, host_id: null }).select('id').single();
  if (error) {
    if (error.code === '23505' || error.status === 409) return true;
    return false;
  }
  return true;
}

export async function getRoom(roomId: string): Promise<RoomRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('rooms').select('id, host_id').eq('id', roomId).maybeSingle();
  if (error) return null;
  return data as RoomRow | null;
}

export async function updateRoomHost(roomId: string, hostId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('rooms').update({ host_id: hostId }).eq('id', roomId);
  return !error;
}

export async function sendChatMessage(roomId: string, senderId: string, nickname: string, text: string): Promise<ChatMessage | null> {
  if (!supabase) throw new Error('Supabase is not configured');
  const CHAT_MAX_LENGTH = 2000;
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed || trimmed.length > CHAT_MAX_LENGTH) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: senderId,
      nickname: nickname || 'Guest',
      text: trimmed,
    })
    .select('id, sender_id, nickname, text, created_at')
    .single();
  if (error) throw new Error(error.message || 'Failed to send message');
  const row = data as MessageRow;
  return row ? { id: row.id, from: row.sender_id, nickname: row.nickname, text: row.text, at: new Date(row.created_at).getTime() } : null;
}
