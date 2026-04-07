import { describe, it, expect } from 'vitest';
import { getRoomUrl, generateRoomId } from './rooms';

describe('getRoomUrl', () => {
  it('returns URL with roomId and /room/ path', () => {
    const url = getRoomUrl('abc123');
    expect(url).toContain('/room/');
    expect(url).toContain('abc123');
  });

  it('returns absolute URL', () => {
    const url = getRoomUrl('xyz');
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toEndWith('/room/xyz');
  });
});

describe('generateRoomId', () => {
  it('returns a string', () => {
    const id = generateRoomId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns different ids on each call', () => {
    const a = generateRoomId();
    const b = generateRoomId();
    expect(a).not.toBe(b);
  });

  it('returns id of expected length (21)', () => {
    const id = generateRoomId();
    expect(id).toHaveLength(21);
  });
});
