import { useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/hooks/useAuth';
import {
  startOutgoingCall,
  setConnecting,
  setConnected,
  endCall as endCallAction,
  toggleMute,
  toggleVideo,
  CallType,
} from '@/store/slices/callSlice';
import { addToast } from '@/store/slices/uiSlice';
import { callEmitters } from '@/socket/emitters/callEmitters';
import {
  getLocalStream,
  getRemoteStream,
  setPeerConnection,
  setLocalStream,
  setRemoteStream,
  setPendingOffer,
  getPendingOffer,
  clearPendingIceCandidates,
  notifyStreamChange,
  cleanupCall,
} from '@/hooks/callState';

// Re-export for CallScreen and callHandlers
export { getLocalStream, getRemoteStream, onStreamChange, cleanupCall } from '@/hooks/callState';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'e8dd65b92af0d3e29db795ff',
      credential: '5VoqgsxMgasTkRqY',
    },
    {
      urls: 'turn:a.relay.metered.ca:80?transport=tcp',
      username: 'e8dd65b92af0d3e29db795ff',
      credential: '5VoqgsxMgasTkRqY',
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'e8dd65b92af0d3e29db795ff',
      credential: '5VoqgsxMgasTkRqY',
    },
    {
      urls: 'turns:a.relay.metered.ca:443?transport=tcp',
      username: 'e8dd65b92af0d3e29db795ff',
      credential: '5VoqgsxMgasTkRqY',
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useCall() {
  const dispatch = useAppDispatch();
  const callState = useAppSelector((state) => state.call);

  // Get user media (with video fallback to audio-only if camera fails)
  const getMedia = useCallback(async (callType: CallType): Promise<MediaStream> => {
    console.log('[Call] Getting media for', callType);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
    } catch (err) {
      if (callType === 'video') {
        console.warn('[Call] Camera access failed, falling back to audio-only:', err);
        dispatch(addToast({ id: Date.now().toString(), message: 'Camera unavailable — connected with audio only. Another app may be using the camera.', type: 'warning' }));
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } else {
        throw err;
      }
    }
    setLocalStream(stream);
    notifyStreamChange();
    return stream;
  }, []);

  // Create peer connection with ICE handling
  const createPeerConnection = useCallback((targetUserId: string): RTCPeerConnection => {
    console.log('[Call] Creating peer connection');
    const pc = new RTCPeerConnection(ICE_SERVERS);
    setPeerConnection(pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        callEmitters.sendIceCandidate(targetUserId, event.candidate.toJSON());
      }
    };

    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

    pc.oniceconnectionstatechange = () => {
      console.log('[Call] ICE state:', pc.iceConnectionState);

      // Clear any pending disconnect timer on state change
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }

      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        dispatch(setConnected());
        // Fallback: if remote stream wasn't set by ontrack, get it from receivers
        if (!getRemoteStream()) {
          const receivers = pc.getReceivers();
          if (receivers.length > 0) {
            const tracks = receivers.map((r) => r.track).filter(Boolean);
            if (tracks.length > 0) {
              console.log('[Call] Fallback: building remote stream from receivers');
              const stream = new MediaStream(tracks);
              setRemoteStream(stream);
              notifyStreamChange();
            }
          }
        } else {
          // Notify again so video element gets a play() kick after connection
          notifyStreamChange();
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        // Disconnected is transient — wait before ending (it can recover)
        console.warn('[Call] ICE disconnected — waiting 5s before ending...');
        disconnectTimer = setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.error('[Call] ICE did not recover, ending call');
            dispatch(endCallAction());
            cleanupCall();
          }
        }, 5000);
      } else if (pc.iceConnectionState === 'failed') {
        // Attempt ICE restart before giving up
        console.warn('[Call] ICE failed — attempting ICE restart...');
        try {
          pc.restartIce();
        } catch (e) {
          console.error('[Call] ICE restart not supported, ending call');
          dispatch(endCallAction());
          cleanupCall();
        }
        // Give ICE restart 8 seconds to recover
        disconnectTimer = setTimeout(() => {
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            console.error('[Call] ICE restart did not recover, ending call');
            dispatch(endCallAction());
            cleanupCall();
          }
        }, 8000);
      }
    };

    pc.ontrack = (event) => {
      console.log('[Call] Remote track received:', event.track.kind);
      let stream: MediaStream;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else {
        // Fallback: create a new stream from the track
        console.warn('[Call] ontrack: no streams, creating one from track');
        const existing = getRemoteStream();
        if (existing) {
          existing.addTrack(event.track);
          stream = existing;
        } else {
          stream = new MediaStream([event.track]);
        }
      }
      setRemoteStream(stream);
      notifyStreamChange();
    };

    // Add local tracks
    const ls = getLocalStream();
    if (ls) {
      ls.getTracks().forEach((track) => {
        pc.addTrack(track, ls);
      });
    }

    return pc;
  }, [dispatch]);

  // Initiate an outgoing call
  const initiateCall = useCallback(async (targetUserId: string, targetUserName: string, callType: CallType) => {
    console.log('[Call] Initiating', callType, 'call to', targetUserName);
    try {
      dispatch(startOutgoingCall({ targetUserId, targetUserName, callType }));
      await getMedia(callType);
      const pc = createPeerConnection(targetUserId);
      callEmitters.initiateCall(targetUserId, callType);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      callEmitters.sendOffer(targetUserId, offer);
    } catch (err) {
      console.error('[Call] Failed to initiate call:', err);
      dispatch(endCallAction());
      cleanupCall();
    }
  }, [createPeerConnection, dispatch, getMedia]);

  // Accept an incoming call — process buffered offer now
  const acceptCall = useCallback(async () => {
    if (!callState.remoteUserId) return;
    console.log('[Call] Accepting call from', callState.remoteUserName);
    dispatch(setConnecting());

    // Wait for offer with multiple retries (different machines have network latency)
    let offer = getPendingOffer();
    if (!offer) {
      console.log('[Call] Offer not yet buffered, waiting...');
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 500));
        offer = getPendingOffer();
        if (offer) break;
      }
    }
    if (!offer) {
      console.warn('[Call] No pending offer after 3s — cannot accept');
      dispatch(endCallAction());
      return;
    }

    const { callerId, offer: sdpOffer } = offer;
    setPendingOffer(null);

    try {
      const callType = callState.callType || 'audio';

      // Get media — if video fails completely, fallback to audio to keep call alive
      let stream: MediaStream | null = null;
      try {
        stream = await getMedia(callType);
      } catch (mediaErr) {
        console.error('[Call] getMedia failed for', callType, mediaErr);
        if (callType === 'video') {
          // Last resort: try audio-only so call doesn't drop
          console.warn('[Call] Video media failed entirely, trying audio-only as last resort');
          try {
            stream = await getMedia('audio');
          } catch (audioErr) {
            console.error('[Call] Even audio failed:', audioErr);
            throw audioErr;
          }
        } else {
          throw mediaErr;
        }
      }

      console.log('[Call] Media acquired, creating peer connection...');
      const pc = createPeerConnection(callerId);

      console.log('[Call] Setting remote description (offer)...');
      await pc.setRemoteDescription(sdpOffer);

      // Flush any buffered ICE candidates
      const candidates = clearPendingIceCandidates();
      console.log('[Call] Flushing', candidates.length, 'buffered ICE candidates');
      for (const candidate of candidates) {
        await pc.addIceCandidate(candidate);
      }

      console.log('[Call] Creating answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('[Call] Sending answer to caller');
      callEmitters.sendAnswer(callerId, answer);
    } catch (err) {
      console.error('[Call] Error accepting call:', err);
      dispatch(endCallAction());
      cleanupCall();
    }
  }, [callState.remoteUserId, callState.remoteUserName, callState.callType, createPeerConnection, dispatch, getMedia]);

  const rejectCall = useCallback(() => {
    if (!callState.remoteUserId) return;
    console.log('[Call] Rejecting call from', callState.remoteUserName);
    setPendingOffer(null);
    callEmitters.rejectCall(callState.remoteUserId);
    dispatch(endCallAction());
    cleanupCall();
  }, [callState.remoteUserId, callState.remoteUserName, dispatch]);

  const hangUp = useCallback(() => {
    if (!callState.remoteUserId) return;
    console.log('[Call] Hanging up');
    callEmitters.endCall(callState.remoteUserId);
    dispatch(endCallAction());
    cleanupCall();
  }, [callState.remoteUserId, dispatch]);

  const handleToggleMute = useCallback(() => {
    const ls = getLocalStream();
    if (ls) {
      const audioTrack = ls.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = callState.isMuted; // will flip
      }
    }
    dispatch(toggleMute());
  }, [callState.isMuted, dispatch]);

  const handleToggleVideo = useCallback(() => {
    const ls = getLocalStream();
    if (ls) {
      const videoTrack = ls.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = callState.isVideoOff; // will flip
      }
    }
    dispatch(toggleVideo());
  }, [callState.isVideoOff, dispatch]);

  return {
    callState,
    initiateCall,
    acceptCall,
    rejectCall,
    hangUp,
    toggleMute: handleToggleMute,
    toggleVideo: handleToggleVideo,
  };
}
