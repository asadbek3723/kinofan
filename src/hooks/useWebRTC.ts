import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseWebRTCOptions {
  socket: { id: string } | null;
  connected: boolean;
  isHost: boolean;
  webcamStream?: MediaStream | null;
  movieStream?: MediaStream | null;
  on: (event: string, handler: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => void;
}

export type RemoteStreamsMap = Record<string, { movie?: MediaStream; webcam?: MediaStream }>;

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

function createPeerConnection(onTrack: (stream: MediaStream, label: string) => void, label: string): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.ontrack = (e: RTCTrackEvent) => {
    let stream = e.streams?.[0];
    if (!stream) {
      stream = new MediaStream([e.track]);
    }
    onTrack(stream, label);
  };

  return pc;
}

export function useWebRTC({
  socket,
  connected,
  isHost,
  webcamStream,
  movieStream,
  on,
  emit,
}: UseWebRTCOptions): { remoteStreams: RemoteStreamsMap; closePeer: (remoteId: string) => void; webrtcError: string | null } {
  const peerRef = useRef(new Map<string, RTCPeerConnection>());
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamsMap>({});
  const [webrtcError, setWebrtcError] = useState<string | null>(null);
  const socketIdRef = useRef<string | null>(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const getOrCreatePc = useCallback((remoteId: string, label: string) => {
    const key = `${remoteId}-${label}`;
    let pc = peerRef.current.get(key);
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
        if (e.candidate) {
          emitRef.current?.('signal', { to: remoteId, type: 'ice', label, candidate: e.candidate });
        }
      };

      pc.ontrack = (e: RTCTrackEvent) => {
        const stream = e.streams[0] || new MediaStream([e.track]);
        setRemoteStreams((prev: RemoteStreamsMap) => {
          const next = { ...prev };
          next[remoteId] = { ...next[remoteId], [label as 'movie' | 'webcam']: stream };
          return next;
        });
      };

      peerRef.current.set(key, pc);
    }
    return pc;
  }, []);

  const closePeer = useCallback((remoteId: string) => {
    setRemoteStreams((prev: RemoteStreamsMap) => {
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
    for (const key of peerRef.current.keys()) {
      if (key.startsWith(`${remoteId}-`)) {
        peerRef.current.get(key)?.close();
        peerRef.current.delete(key);
      }
    }
  }, []);

  useEffect(() => {
    if (!connected) {
      setRemoteStreams({});
      setWebrtcError(null);
      peerRef.current.forEach((pc: RTCPeerConnection) => pc.close());
      peerRef.current.clear();
    }
  }, [connected]);

  // Signaling logic
  useEffect(() => {
    if (!connected || !socket || !on || !emit) return;
    socketIdRef.current = socket.id;

    const createOfferTo = async (peerId: string, label: string, stream: MediaStream) => {
      if (!stream) return;
      const pc = getOrCreatePc(peerId, label);

      // Remove old tracks if any (though usually Mesh creates new PC for each peer)
      pc.getSenders().forEach((sender: RTCRtpSender) => pc.removeTrack(sender));
      stream.getTracks().forEach((track: MediaStreamTrack) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emit('signal', { to: peerId, type: 'offer', label, sdp: offer });
    };

    const unsubPeerJoined = on('peer-joined', (peerId: string) => {
      console.log('[WebRTC] Peer joined:', peerId);
      // Only initiate if our ID is "smaller" to avoid glare
      if (socket.id < peerId) {
        if (webcamStream) createOfferTo(peerId, 'webcam', webcamStream);
        if (isHost && movieStream) createOfferTo(peerId, 'movie', movieStream);
      }
    });

    const unsubSignal = on('signal', async (payload: any) => {
      const { from, type, label, sdp, candidate } = payload;
      if (from === socket.id) return;

      const pc = getOrCreatePc(from, label || 'webcam');

      try {
        if (type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          // Add local tracks if needed
          if (label === 'webcam' && webcamStream) {
            webcamStream.getTracks().forEach((track: MediaStreamTrack) => pc.addTrack(track, webcamStream));
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emit('signal', { to: from, type: 'answer', label, sdp: answer });
        } else if (type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } else if (type === 'ice' && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('[WebRTC] Signaling error:', err);
        setWebrtcError('Ulanishda xato yuz berdi');
      }
    });

    const unsubPeerLeft = on('peer-left', (peerId: string) => {
      console.log('[WebRTC] Peer left:', peerId);
      closePeer(peerId);
    });

    return () => {
      unsubPeerJoined();
      unsubSignal();
      unsubPeerLeft();
    };
  }, [connected, socket?.id, isHost, webcamStream, movieStream, on, emit, getOrCreatePc, closePeer]);

  // If movie stream changes, update existing peer connections (Host only)
  useEffect(() => {
    if (!isHost || !movieStream || !connected || !socket) return;

    // For each already connected peer, if we don't have a 'movie' PC or tracks are different, re-offer
    // Simple way: just trigger movie offer to everyone
    // But better: check if they are in remoteStreams or peerRef
    for (const key of peerRef.current.keys()) {
      if (key.endsWith('-movie')) {
        // Already has movie PC, maybe update tracks?
        // For Mesh, we'll keep it simple for now. 
      }
    }
  }, [movieStream, isHost, connected, socket]);

  return { remoteStreams, closePeer, webrtcError };
}
