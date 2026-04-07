import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoom } from './socket';

describe('createRoom', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns roomId when response is ok', async () => {
    const roomId = 'test-room-123';
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ roomId }),
    });
    const result = await createRoom();
    expect(result).toBe(roomId);
  });

  it('throws with server message when res.ok is false', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Server overloaded' }),
    });
    await expect(createRoom()).rejects.toThrow('Server overloaded');
  });

  it('throws with body.error when message is missing', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Database error' }),
    });
    await expect(createRoom()).rejects.toThrow('Database error');
  });

  it('throws default message when body has no message or error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    });
    await expect(createRoom()).rejects.toThrow('Xona yaratib bo‘lmadi');
  });

  it('throws default message when json parse fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });
    await expect(createRoom()).rejects.toThrow('Xona yaratib bo‘lmadi');
  });
});
