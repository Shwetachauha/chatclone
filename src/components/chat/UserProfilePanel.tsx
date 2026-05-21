import {
  Drawer,
  Box,
  Avatar,
  Typography,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import { Close, Email, Phone, Info, Circle } from '@mui/icons-material';
import { useAppSelector } from '@/hooks/useAuth';
import { Chat } from '@/types';

interface UserProfilePanelProps {
  open: boolean;
  userId: string | null;
  onClose: () => void;
}

export function UserProfilePanel({ open, userId, onClose }: UserProfilePanelProps) {
  const chats = useAppSelector((state) => state.chat.chats);
  const onlineUsers = useAppSelector((state) => state.presence.onlineUsers);

  // Find user info from chats
  const user = userId
    ? chats
        .filter((c: Chat) => !c.isGroupChat && c.chatWith)
        .map((c: Chat) => c.chatWith!)
        .find((p) => p.id === userId)
    : null;

  if (!user) return null;

  const isOnline = userId ? !!onlineUsers[userId] : false;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 320 } }}>
      <Box sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Profile</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>

        {/* Avatar & Name */}
        <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
          <Avatar
            src={user.avatar}
            sx={{ width: 100, height: 100, mb: 1.5, fontSize: 40 }}
          >
            {user.name?.[0] || user.id[0]}
          </Avatar>
          <Typography variant="h6">{user.name || 'Unknown User'}</Typography>
          <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
            <Circle sx={{ fontSize: 10, color: isOnline ? 'success.main' : 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              {isOnline ? 'Online' : 'Offline'}
            </Typography>
          </Box>
        </Box>

        <Divider />

        {/* Info */}
        <List>
          <ListItem>
            <ListItemIcon><Info /></ListItemIcon>
            <ListItemText
              primary="About"
              secondary={user.bio || 'Hey there! I\'m using ChatApp.'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Email /></ListItemIcon>
            <ListItemText
              primary="Email"
              secondary={user.email || 'Not available'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Phone /></ListItemIcon>
            <ListItemText
              primary="Phone"
              secondary="+1 (555) 000-0000"
            />
          </ListItem>
        </List>

        <Divider />

        {/* Shared groups */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Shared Groups
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={0.5}>
            {chats
              .filter((c: Chat) => c.isGroupChat && c.members?.some((p) => p.id === userId))
              .map((c: Chat) => (
                <Chip key={c.id} label={c.groupName || 'Group'} size="small" variant="outlined" />
              ))}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
