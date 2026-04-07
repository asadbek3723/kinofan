import React, { useRef, useEffect, memo, RefObject, ChangeEvent } from 'react';
import styles from './VideoArea.module.css';

interface VideoControlPayload {
  time?: number;
  playing?: boolean;
}

interface MoviePlayerInnerProps {
  stream: MediaStream | null;
  isHost: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  onFileSelect?: (stream: MediaStream) => void;
  onPlay?: (payload: VideoControlPayload) => void;
  onPause?: (payload: VideoControlPayload) => void;
  onSeeked?: (payload: VideoControlPayload) => void;
}

function MoviePlayerInner({ stream, isHost, videoRef, onFileSelect, onPlay, onPause, onSeeked }: MoviePlayerInnerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const r = videoRef || ref;
  const objectUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadProgress, setLoadProgress] = React.useState(0);

  useEffect(() => {
    if (!r.current || !stream) return;
    if (stream instanceof MediaStream) {
      r.current.srcObject = stream;
    }
  }, [stream, r]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file || !r.current) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setLoading(true);
    setLoadProgress(0);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const video = r.current;
    video.src = url;
    video.muted = true;
    video.preload = 'auto';

    let readyCalled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const removeListeners = () => {
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('loadeddata', ready);
      video.removeEventListener('canplay', ready);
      video.removeEventListener('canplaythrough', ready);
      video.removeEventListener('playing', onPlaying);
      if (pollId != null) clearInterval(pollId);
      if (safetyTimer != null) clearTimeout(safetyTimer);
    };

    const finishAndStream = () => {
      if (readyCalled) return;
      readyCalled = true;
      if (safetyTimer != null) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      if (pollId != null) {
        clearInterval(pollId);
        pollId = null;
      }
      removeListeners();
      setLoadProgress(100);
      setLoading(false);
      try {
        if (typeof video.captureStream === 'function' && onFileSelect) {
          onFileSelect(video.captureStream());
        }
      } catch {
        // ignore
      }
    };

    const ready = () => {
      if (readyCalled) return;
      finishAndStream();
      try {
        video.play().catch(() => {});
      } catch {
        // ignore
      }
    };

    const onPlaying = () => {
      finishAndStream();
    };

    const onProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const pct = video.duration && isFinite(video.duration)
          ? Math.min(100, (bufferedEnd / video.duration) * 100)
          : 0;
        setLoadProgress((prev) => Math.max(prev, pct));
        if (pct >= 99.9) ready();
      }
    };

    const onLoadedMetadata = () => {
      onProgress();
    };

    video.addEventListener('progress', onProgress);
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    video.addEventListener('loadeddata', ready, { once: true });
    video.addEventListener('canplay', ready, { once: true });
    video.addEventListener('canplaythrough', ready, { once: true });
    video.addEventListener('playing', onPlaying, { once: true });

    pollId = setInterval(() => {
      if (video.readyState >= 2) ready();
    }, 400);

    safetyTimer = setTimeout(() => {
      if (!readyCalled) ready();
    }, 5000);

    const onError = () => {
      if (safetyTimer != null) clearTimeout(safetyTimer);
      removeListeners();
      setLoading(false);
    };
    video.addEventListener('error', onError, { once: true });

    e.target.value = '';
  };

  if (isHost) {
    return (
      <div className={styles.movieWrap}>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className={styles.fileInput}
          id="movie-file"
        />
        <label
          htmlFor="movie-file"
          className={stream ? styles.fileLabelHidden : styles.fileLabel}
          aria-label="Galereyadan video tanlash"
        >
          Galereyadan video tanlang
        </label>
        {loading && (
          <div className={styles.videoLoading} aria-live="polite">
            <span className={styles.videoLoadingText}>
              Video yuklanmoqda… {Math.round(loadProgress)}%
            </span>
            <div className={styles.videoProgressTrack}>
              <div className={styles.videoProgressBar} style={{ width: `${loadProgress}%` }} />
            </div>
          </div>
        )}
        <video
          ref={r}
          autoPlay
          playsInline
          muted
          controls
          decoding="async"
          preload="metadata"
          className={stream ? styles.video : styles.videoHidden}
          aria-label="Tanlangan video"
          title="Tanlangan video"
          onPlay={() => onPlay?.({ time: r.current?.currentTime ?? 0, playing: true })}
          onPause={() => onPause?.({ time: r.current?.currentTime ?? 0, playing: false })}
          onSeeked={() => onSeeked?.({ time: r.current?.currentTime ?? 0, playing: !r.current?.paused })}
        />
      </div>
    );
  }

  const refToUse = videoRef || ref;
  return (
    <div className={styles.movieWrap}>
      {stream ? (
        <video
          ref={refToUse}
          autoPlay
          playsInline
          decoding="async"
          className={styles.video}
          aria-label="Host videosi"
          title="Host videosi"
        />
      ) : (
        <div className={styles.moviePlaceholder} aria-hidden="true">
          <span>Host hali video tanlamadi</span>
        </div>
      )}
    </div>
  );
}

interface WebcamTileInnerProps {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
}

function WebcamTileInner({ stream, label, muted = true }: WebcamTileInnerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current || !stream) return;
    ref.current.srcObject = stream;
  }, [stream]);
  if (!stream) return null;
  return (
    <div className={styles.tile}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        decoding="async"
        className={styles.tileVideo}
        aria-label={`${label} kamerasi`}
      />
      <span className={styles.tileLabel}>{label}</span>
    </div>
  );
}

export const MoviePlayer = memo(MoviePlayerInner);
export const WebcamTile = memo(WebcamTileInner);
