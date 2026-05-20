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
  ],
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

    pc.oniceconnectionstatechange = () => {
      console.log('[Call] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
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
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        dispatch(endCallAction());
        cleanupCall();
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

    // Wait briefly for offer if not yet buffered (race condition)
    let offer = getPendingOffer();
    if (!offer) {
      console.log('[Call] Offer not yet buffered, waiting...');
      await new Promise((r) => setTimeout(r, 1000));
      offer = getPendingOffer();
    }
    if (!offer) {
      console.warn('[Call] No pending offer to process — cannot accept');
      dispatch(endCallAction());
      return;
    }

    const { callerId, offer: sdpOffer } = offer;
    setPendingOffer(null);

    try {
      const callType = callState.callType || 'audio';
      await getMedia(callType);
      const pc = createPeerConnection(callerId);
      await pc.setRemoteDescription(sdpOffer);
      // Flush any buffered ICE candidates
      const candidates = clearPendingIceCandidates();
      for (const candidate of candidates) {
        await pc.addIceCandidate(candidate);
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
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
