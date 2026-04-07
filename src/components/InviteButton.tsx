import React, { useState } from 'react';
import { getRoomUrl } from '../api/rooms';
import styles from './InviteButton.module.css';

const canShare = typeof navigator !== 'undefined' && navigator.share;

interface InviteButtonProps {
  roomId: string;
}

export default function InviteButton({ roomId }: InviteButtonProps) {
  const [copied, setCopied] = useState(false);
  const [lastUrl, setLastUrl] = useState('');

  async function handleCopy() {
    const url = getRoomUrl(roomId);
    setLastUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleShare() {
    const url = getRoomUrl(roomId);
    setLastUrl(url);
    try {
      await navigator.share({
        title: 'Kinofan',
        text: 'Birga kino ko‘ramizmi?',
        url,
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') handleCopy();
    }
  }

  return (
    <>
      {canShare && (
        <button type="button" onClick={handleShare} className={styles.button} aria-label="Linkni ulashish">
          Ulashish
        </button>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className={copied ? styles.buttonCopied : styles.button}
        aria-label={copied ? 'Nusxalandi!' : 'Taklif linkini nusxalash'}
      >
        {copied ? 'Nusxalandi!' : 'Linkni nusxalash'}
      </button>
    </>
  );
}
