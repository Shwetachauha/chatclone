import { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, Avatar } from '@mui/material';
import { CallEnd, Mic, MicOff, Videocam, VideocamOff } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useCall, getLocalStream, getRemoteStream, onStreamChange } from '@/hooks/useCall';

function formatDuration(startedAt: string | null): string {
  if (!startedAt) return '00:00';
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const mins = Math.floor(diff / 60).toString().padStart(2, '0');
  const secs = (diff % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function CallScreen() {
  const {
    callState,
    hangUp,
    toggleMute,
    toggleVideo,
  } = useCall();
  const [duration, setDuration] = useState('00:00');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Attach streams to video/audio elements whenever they change
  useEffect(() => {
    function syncStreams() {
      const ls = getLocalStream();
      const rs = getRemoteStream();
      if (localVideoRef.current) {
        if (localVideoRef.current.srcObject !== ls) {
          localVideoRef.current.srcObject = ls;
        }
        if (ls) localVideoRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== rs) {
          remoteVideoRef.current.srcObject = rs;
        }
        // Always call play — needed when a new video track arrives on existing stream
        if (rs) remoteVideoRef.current.play().catch(() => {});
      }
      if (remoteAudioRef.current) {
        if (remoteAudioRef.current.srcObject !== rs) {
          remoteAudioRef.current.srcObject = rs;
        }
        if (rs) remoteAudioRef.current.play().catch(() => {});
      }
    }
    // Sync immediately
    syncStreams();
    // Subscribe to future changes
    const unsub = onStreamChange(syncStreams);
    return unsub;
  }, [callState.status]);

  // Update timer every second when connected
  useEffect(() => {
    if (callState.status !== 'connected') return;
    const interval = setInterval(() => {
      setDuration(formatDuration(callState.callStartedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState.status, callState.callStartedAt]);

  if (callState.status === 'idle' || callState.status === 'incoming') return null;

  const isVideo = callState.callType === 'video';
  const statusText =
    callState.status === 'outgoing' ? 'Calling...' :
    callState.status === 'connecting' ? 'Connecting...' :
    duration;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isVideo
          ? '#000'
          : 'linear-gradient(135deg, #1a1a2e 0%, #2d1b69 50%, #1a1a2e 100%)',
      }}
    >
      {/* Hidden audio element — plays remote audio for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      {/* Remote video (full screen) — muted because audio plays via separate <audio> element */}
      {isVideo && (
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
      )}

      {/* Local video (PiP corner) */}
      {isVideo && (
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 160,
            height: 120,
            borderRadius: 2,
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 2,
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
        </Box>
      )}

      {/* Audio call center content */}
      {!isVideo && (
        <Box textAlign="center" sx={{ zIndex: 1 }}>
          <motion.div
            animate={callState.status === 'connected' ? {} : { scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Avatar
              sx={{
                width: 120,
                height: 120,
                mx: 'auto',
                mb: 3,
                fontSize: 48,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 0 40px rgba(102,126,234,0.3)',
              }}
            >
              {callState.remoteUserName?.[0]?.toUpperCase() || '?'}
            </Avatar>
          </motion.div>
          <Typography variant="h4" fontWeight={700} color="white" mb={0.5}>
            {callState.remoteUserName}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: callState.status === 'connected' ? '#22c55e' : 'rgba(255,255,255,0.6)',
              fontWeight: 500,
            }}
          >
            {statusText}
          </Typography>
        </Box>
      )}

      {/* Video call overlay info */}
      {isVideo && callState.status !== 'connected' && (
        <Box textAlign="center" sx={{ zIndex: 1 }}>
          <Typography variant="h5" fontWeight={700} color="white">
            {callState.remoteUserName}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {statusText}
          </Typography>
        </Box>
      )}

      {/* Video call connected timer */}
      {isVideo && callState.status === 'connected' && (
        <Box sx={{ position: 'absolute', top: 20, left: 20, zIndex: 2 }}>
          <Typography variant="body2" sx={{ color: '#22c55e', fontWeight: 600, bgcolor: 'rgba(0,0,0,0.5)', px: 1.5, py: 0.5, borderRadius: 1 }}>
            {duration}
          </Typography>
        </Box>
      )}

      {/* Controls */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 40,
          zIndex: 2,
          display: 'flex',
          gap: 3,
          alignItems: 'center',
        }}
      >
        {/* Mute */}
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <IconButton
            onClick={toggleMute}
            sx={{
              width: 56,
              height: 56,
              bgcolor: callState.isMuted ? '#ef4444' : 'rgba(255,255,255,0.15)',
              color: 'white',
              backdropFilter: 'blur(10px)',
              '&:hover': {
                bgcolor: callState.isMuted ? '#dc2626' : 'rgba(255,255,255,0.25)',
              },
            }}
          >
            {callState.isMuted ? <MicOff /> : <Mic />}
          </IconButton>
        </motion.div>

        {/* Hang up */}
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <IconButton
            onClick={hangUp}
            sx={{
              width: 68,
              height: 68,
              bgcolor: '#ef4444',
              color: 'white',
              '&:hover': { bgcolor: '#dc2626' },
              boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
            }}
          >
            <CallEnd fontSize="large" />
          </IconButton>
        </motion.div>

        {/* Video toggle (only for video calls) */}
        {isVideo && (
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <IconButton
              onClick={toggleVideo}
              sx={{
                width: 56,
                height: 56,
                bgcolor: callState.isVideoOff ? '#ef4444' : 'rgba(255,255,255,0.15)',
                color: 'white',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: callState.isVideoOff ? '#dc2626' : 'rgba(255,255,255,0.25)',
                },
              }}
            >
              {callState.isVideoOff ? <VideocamOff /> : <Videocam />}
            </IconButton>
          </motion.div>
        )}
      </Box>
    </Box>
  );
}
