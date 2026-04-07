import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateRoomId } from '../api/rooms';
import { createRoom as createRoomSocket } from '../api/socket';
import { supabase } from '../api/supabase';
import styles from './Home.module.css';

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateRoom() {
    setError('');
    if (supabase) {
      const roomId = generateRoomId();
      navigate(`/room/${roomId}`);
      return;
    }
    setLoading(true);
    try {
      const roomId = await createRoomSocket();
      navigate(`/room/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xona yaratib bo‘lmadi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.dedicationSticker} aria-hidden="true">
        <span className={styles.dedicationHeart} role="img" aria-label="yurak">❤</span>
        <span className={styles.dedicationText}>Mittivoyim uchun</span>
      </div>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Kinofan</h1>
        <p className={styles.heroTagline}>
          Bir vaqtning o‘zida. Bir-biringizni ko‘ring. Chatda gapling.
        </p>
        <button
          type="button"
          className={styles.heroCta}
          onClick={handleCreateRoom}
          disabled={loading}
        >
          {loading ? 'Yuklanmoqda…' : 'Xona yaratish'}
        </button>
        {error && <p className={styles.heroError}>{error}</p>}
      </section>

      <section className={styles.features}>
        <h2 className={styles.featuresTitle}>Nima uchun Kinofan?</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="2" y1="7" x2="7" y2="7" />
                <line x1="2" y1="17" x2="7" y2="17" />
                <line x1="17" y1="17" x2="22" y2="17" />
                <line x1="17" y1="7" x2="22" y2="7" />
              </svg>
            </div>
            <h3 className={styles.featureHeading}>Sinxron kino</h3>
            <p className={styles.featureText}>
              Bitta videoni do‘stlar bilan bir vaqtda ko‘ring. Host play bosadi — hammada bir xil kadr.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <h3 className={styles.featureHeading}>Video-chat</h3>
            <p className={styles.featureText}>
              Kamerangizni yoqing — barcha ishtirokchilar bir-birini ko‘radi va his qiladi.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className={styles.featureHeading}>Chat</h3>
            <p className={styles.featureText}>
              Realtime chat orqali fikr almashing va muhokama qiling.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.howItWorks}>
        <h2 className={styles.howTitle}>Qanday ishlaydi?</h2>
        <ol className={styles.howSteps}>
          <li className={styles.howStep}>
            <span className={styles.howStepNum}>1</span>
            <span>Xona yaratish tugmasini bosing</span>
          </li>
          <li className={styles.howStep}>
            <span className={styles.howStepNum}>2</span>
            <span>Linkni do‘stlaringizga ulashing</span>
          </li>
          <li className={styles.howStep}>
            <span className={styles.howStepNum}>3</span>
            <span>Birga tomosha qiling, kamerada ko‘ring va chatda gapling</span>
          </li>
        </ol>
      </section>

      <section className={styles.ctaSection}>
        <button
          type="button"
          className={styles.heroCta}
          onClick={handleCreateRoom}
          disabled={loading}
        >
          {loading ? 'Yuklanmoqda…' : 'Hoziroq boshlang'}
        </button>
      </section>

      <footer className={styles.footer}>
        <span>Kinofan — do‘stlar bilan birga kino ko‘ring</span>
      </footer>
    </div>
  );
}
