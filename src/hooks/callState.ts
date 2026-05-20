// Shared module-level call state (avoids circular deps between useCall and callHandlers)

// ── Module-level singletons ──
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let pendingOffer: { callerId: string; offer: RTCSessionDescriptionInit } | null = null;
let pendingIceCandidates: RTCIceCandidateInit[] = [];

// ── Getters ──
export function getPeerConnection() { return peerConnection; }
export function getLocalStream() { return localStream; }
export function getRemoteStream() { return remoteStream; }
export function getPendingOffer() { return pendingOffer; }

// ── Setters ──
export function setPeerConnection(pc: RTCPeerConnection | null) { peerConnection = pc; }
export function setLocalStream(stream: MediaStream | null) { localStream = stream; }
export function setRemoteStream(stream: MediaStream | null) { remoteStream = stream; }
export function setPendingOffer(offer: { callerId: string; offer: RTCSessionDescriptionInit } | null) { pendingOffer = offer; }

export function addPendingIceCandidate(candidate: RTCIceCandidateInit) {
  pendingIceCandidates.push(candidate);
}
export function clearPendingIceCandidates(): RTCIceCandidateInit[] {
  const candidates = [...pendingIceCandidates];
  pendingIceCandidates = [];
  return candidates;
}

// ── Stream change subscribers ──
type StreamListener = () => void;
const streamListeners = new Set<StreamListener>();

export function notifyStreamChange() {
  streamListeners.forEach((fn) => fn());
}

export function onStreamChange(listener: StreamListener): () => void {
  streamListeners.add(listener);
  return () => streamListeners.delete(listener);
}

/** Clean up all WebRTC resources */
export function cleanupCall() {
  console.log('[Call] Cleaning up');
  pendingOffer = null;
  pendingIceCandidates = [];
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteStream = null;
  notifyStreamChange();
}
