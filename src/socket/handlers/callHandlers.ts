import { Socket } from 'socket.io-client';
import { store } from '@/store';
import { ServerEvent } from '@/types/socket';
import { setIncomingCall, endCall } from '@/store/slices/callSlice';
import { CallType } from '@/store/slices/callSlice';
import { prependCallLog, updateCallLog } from '@/store/slices/callLogSlice';
import { CallLog } from '@/types/callLog';
import {
  cleanupCall,
  setPendingOffer,
  getPeerConnection,
  addPendingIceCandidate,
  clearPendingIceCandidates,
} from '@/hooks/callState';

interface CallIncomingEvent {
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
}

interface CallOfferEvent {
  callerId: string;
  offer: RTCSessionDescriptionInit;
}

interface CallAnswerEvent {
  calleeId: string;
  answer: RTCSessionDescriptionInit;
}

interface CallIceCandidateEvent {
  from: string;
  candidate: RTCIceCandidateInit;
}

interface CallEndedEvent {
  by: string;
}

export function registerCallHandlers(socket: Socket): void {
  socket.on(ServerEvent.CALL_INCOMING, (event: CallIncomingEvent) => {
    console.log('[CallHandler] call:incoming', event);
    const state = store.getState();
    const currentUserId = state.auth.user?.id;
    const callStatus = state.call.status;
    if (event.callerId === currentUserId) {
      console.log('[CallHandler] Ignoring call:incoming — we are the caller');
      return;
    }
    if (callStatus !== 'idle') {
      console.log('[CallHandler] Ignoring call:incoming — already in a call:', callStatus);
      return;
    }
    store.dispatch(setIncomingCall({
      callerId: event.callerId,
      callerName: event.callerName,
      callType: event.callType as CallType,
    }));
  });

  socket.on(ServerEvent.CALL_OFFER, (event: CallOfferEvent) => {
    console.log('[CallHandler] call:offer received');
    const currentUserId = store.getState().auth.user?.id;
    if (event.callerId === currentUserId) {
      console.log('[CallHandler] Ignoring call:offer — we sent it');
      return;
    }
    // Buffer the offer until the callee accepts
    console.log('[CallHandler] Buffering offer from', event.callerId);
    setPendingOffer({ callerId: event.callerId, offer: event.offer });
  });

  socket.on(ServerEvent.CALL_ANSWER, async (event: CallAnswerEvent) => {
    console.log('[CallHandler] call:answer received');
    // Only process if our PC is waiting for an answer (we are the caller)
    const pc = getPeerConnection();
    if (!pc) {
      console.warn('[CallHandler] No peerConnection when answer arrived');
      return;
    }
    // Guard: only the caller's PC should be in 'have-local-offer' state
    if (pc.signalingState !== 'have-local-offer' || pc.remoteDescription) {
      console.log('[CallHandler] Ignoring call:answer — PC not in have-local-offer state:', pc.signalingState);
      return;
    }
    try {
      await pc.setRemoteDescription(event.answer);
      // Flush any buffered ICE candidates
      const candidates = clearPendingIceCandidates();
      for (const candidate of candidates) {
        await pc.addIceCandidate(candidate);
      }
    } catch (err) {
      console.error('[CallHandler] Error processing answer:', err);
    }
  });

  socket.on(ServerEvent.CALL_ICE_CANDIDATE, async (event: CallIceCandidateEvent) => {
    const currentUserId = store.getState().auth.user?.id;
    if (event.from === currentUserId) {
      return;
    }
    try {
      const pc = getPeerConnection();
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(event.candidate);
      } else {
        // Buffer if remote description not set yet
        console.log('[CallHandler] Buffering ICE candidate (no remote desc yet)');
        addPendingIceCandidate(event.candidate);
      }
    } catch (err) {
      console.error('[CallHandler] Error adding ICE candidate:', err);
    }
  });

  socket.on(ServerEvent.CALL_REJECTED, (event: CallEndedEvent) => {
    console.log('[CallHandler] call:rejected by', event.by);
    const callStatus = store.getState().call.status;
    if (callStatus === 'idle') return;
    // Don't end if we are the one who rejected (we handle that locally)
    const currentUserId = store.getState().auth.user?.id;
    if (event.by === currentUserId) return;
    store.dispatch(endCall());
    cleanupCall();
  });

  socket.on(ServerEvent.CALL_ENDED, (event: CallEndedEvent) => {
    console.log('[CallHandler] call:ended by', event.by);
    const callStatus = store.getState().call.status;
    if (callStatus === 'idle') return;
    // Don't end if we are the one who hung up (we handle that locally)
    const currentUserId = store.getState().auth.user?.id;
    if (event.by === currentUserId) return;
    store.dispatch(endCall());
    cleanupCall();
  });

  // Call log events
  socket.on(ServerEvent.CALL_LOG_CREATED, (event: { callLog: CallLog }) => {
    console.log('[CallHandler] call_log_created', event.callLog);
    store.dispatch(prependCallLog(event.callLog));
  });

  socket.on(ServerEvent.CALL_LOG_UPDATED, (event: { callLog: CallLog }) => {
    console.log('[CallHandler] call_log_updated', event.callLog);
    store.dispatch(updateCallLog(event.callLog));
  });
}
