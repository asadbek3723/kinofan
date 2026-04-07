import React, { useState, useRef, useEffect, useCallback, memo, FormEvent } from 'react';
import styles from './Chat.module.css';
import type { ChatMessage } from '../api/rooms';

function formatTime(at: number | undefined): string {
  if (!at) return '';
  try {
    return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const MessageItem = memo(function MessageItem({ m, isMe }: { m: ChatMessage; isMe: boolean }) {
  return (
    <div className={isMe ? styles.msgMe : styles.msgOther}>
      <span className={styles.msgMeta}>
        {m.nickname || m.from?.slice(-6)}
        {m.at ? ` · ${formatTime(m.at)}` : ''}
      </span>
      <span className={styles.msgText}>{m.text}</span>
    </div>
  );
});

interface ChatProps {
  messages?: ChatMessage[];
  onSend: (text: string) => void;
  disabled?: boolean;
  mySocketId?: string;
}

function Chat({ messages = [], onSend, disabled, mySocketId }: ChatProps) {
  const list = Array.isArray(messages) ? messages : [];
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [list.length]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || disabled) return;
      onSend(text);
      setInput('');
    },
    [input, disabled, onSend]
  );

  return (
    <div className={styles.container}>
      <div
        ref={listRef}
        className={styles.messages}
        role="log"
        aria-live="polite"
        aria-label="Chat xabarlari"
      >
        {list.length === 0 && (
          <div className={styles.placeholder}>Xabar yo‘q. Salom yozing!</div>
        )}
        {list.map((m) => (
          <MessageItem
            key={m.id ?? `${m.from}-${m.at}`}
            m={m}
            isMe={m.from === mySocketId}
          />
        ))}
      </div>
      <form onSubmit={handleSubmit} className={styles.form} aria-label="Chat xabar yuborish">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Xabar yozing..."
          disabled={disabled}
          className={styles.input}
          aria-label="Xabar matni"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className={styles.send}
          aria-label="Yuborish"
        >
          Yuborish
        </button>
      </form>
    </div>
  );
}

export default memo(Chat);
