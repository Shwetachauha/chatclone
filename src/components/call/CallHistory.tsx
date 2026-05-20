import { useEffect, memo, useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CallMade,
  CallReceived,
  CallMissed,
  Phone,
  Videocam,
  Delete,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '@/hooks/useAuth';
import { fetchCallLogs, deleteCallLog } from '@/store/slices/callLogSlice';
import { CallLog } from '@/types/callLog';
import { Avatar } from '@/components/common/Avatar';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';

const MotionListItem = motion.create(ListItemButton as any);

function formatCallTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export const CallHistory = memo(function CallHistory() {
  const dispatch = useAppDispatch();
  const { logs, isLoading } = useAppSelector((state) => state.callLogs);
  const currentUser = useAppSelector((state) => state.auth.user);
  const userId = currentUser?.id || '';
  const safeLogs = Array.isArray(logs) ? logs : [];

  useEffect(() => {
    dispatch(fetchCallLogs());
  }, [dispatch]);

  if (isLoading) return <LoadingSkeleton variant="chat-list" />;

  if (safeLogs.length === 0) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" flex={1} p={3}>
        <Typography color="text.secondary" textAlign="center">
          No call history yet.<br />Start a call from any chat!
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ flex: 1, overflow: 'auto', px: 0.5, pt: 1, '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
      <AnimatePresence>
        {safeLogs.map((log) => (
          <CallLogItem key={log.id} log={log} currentUserId={userId} />
        ))}
      </AnimatePresence>
    </List>
  );
});

function CallLogItem({ log, currentUserId }: { log: CallLog; currentUserId: string }) {
  const dispatch = useAppDispatch();
  const isCaller = (log.callerId || log.caller?.id) === currentUserId;
  const otherUser = isCaller ? log.receiver : log.caller;
  const [hovered, setHovered] = useState(false);

  const getIcon = () => {
    if (log.status === 'MISSED') {
      return <CallMissed sx={{ fontSize: 18, color: '#e53935' }} />;
    }
    if (log.status === 'REJECTED') {
      return <CallMissed sx={{ fontSize: 18, color: '#ff9800' }} />;
    }
    // ANSWERED
    return isCaller
      ? <CallMade sx={{ fontSize: 18, color: '#43a047' }} />
      : <CallReceived sx={{ fontSize: 18, color: '#43a047' }} />;
  };

  const getStatusText = () => {
    if (log.status === 'MISSED') return 'Missed';
    if (log.status === 'REJECTED') return 'Declined';
    return isCaller ? 'Outgoing' : 'Incoming';
  };

  const getStatusColor = () => {
    if (log.status === 'MISSED') return '#e53935';
    if (log.status === 'REJECTED') return '#ff9800';
    return '#43a047';
  };

  return (
    <MotionListItem
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        borderRadius: '14px',
        mb: 0.5,
        mx: 0.5,
        py: 1.2,
        px: 1.5,
        '&:hover': { bgcolor: 'rgba(124,92,191,0.06)' },
      }}
    >
      <Avatar
        name={otherUser?.name || 'Unknown'}
        src={otherUser?.avatar}
        size={46}
      />

      <Box ml={1.5} flex={1} overflow="hidden">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="subtitle2"
            noWrap
            fontWeight={log.status === 'MISSED' ? 700 : 500}
            sx={{ color: '#2d1b69' }}
          >
            {otherUser?.name || 'Unknown'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.4)', flexShrink: 0, ml: 1 }}>
            {formatCallTime(log.startedAt)}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={0.5} mt={0.3}>
          {getIcon()}
          <Typography variant="body2" sx={{ color: getStatusColor(), fontSize: '0.8rem', fontWeight: 500 }}>
            {getStatusText()}
          </Typography>
          {log.type === 'VIDEO' && (
            <Videocam sx={{ fontSize: 14, color: 'rgba(0,0,0,0.4)', ml: 0.5 }} />
          )}
          {log.type === 'AUDIO' && (
            <Phone sx={{ fontSize: 14, color: 'rgba(0,0,0,0.4)', ml: 0.5 }} />
          )}
          {log.duration > 0 && (
            <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.4)', ml: 0.5 }}>
              {formatDuration(log.duration)}
            </Typography>
          )}
        </Box>
      </Box>

      {hovered && (
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              dispatch(deleteCallLog(log.id));
            }}
            sx={{ color: '#e53935', ml: 0.5 }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </MotionListItem>
  );
}
