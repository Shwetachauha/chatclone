import { useState, useRef } from 'react';
import {
  Drawer,
  Box,
  Avatar,
  Typography,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Button,
  Chip,
  Badge,
  CircularProgress,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import { Close, Edit, Group, Circle, CameraAlt, PersonRemove, PersonAdd, Search } from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '@/hooks/useAuth';
import { Chat, User } from '@/types';
import { groupEmitters } from '@/socket/emitters/groupEmitters';
import { uploadService } from '@/services/uploadService';
import { chatService } from '@/services/chatService';
import { userService } from '@/services/userService';
import { updateChat } from '@/store/slices/chatSlice';

interface GroupInfoPanelProps {
  open: boolean;
  chat: Chat | null;
  onClose: () => void;
}

export function GroupInfoPanel({ open, chat, onClose }: GroupInfoPanelProps) {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(chat?.groupName || '');
  const [isUploading, setIsUploading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useAppSelector((state) => state.auth.user);
  const onlineUsers = useAppSelector((state) => state.presence.onlineUsers);
  const dispatch = useAppDispatch();

  if (!chat || !chat.isGroupChat) return null;

  const isAdmin = chat.groupAdmin?.id === currentUser?.id;

  const handleSaveName = () => {
    if (newName.trim() && newName.trim() !== chat.groupName) {
      groupEmitters.updateGroup(chat.id, { groupName: newName.trim() });
    }
    setEditing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
      const result = await uploadService.uploadFile(file);
      groupEmitters.updateGroup(chat.id, { groupAvatar: result.url });
    } catch (err) {
      console.error('[GroupInfo] Avatar upload failed:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const users = await userService.searchUsers(query.trim());
      // Filter out users already in the group
      const memberIds = new Set(chat.members?.map((m) => m.id) || []);
      setSearchResults(users.filter((u) => !memberIds.has(u.id)));
    } catch {
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  const handleAddMember = async (userId: string) => {
    try {
      const updatedChat = await chatService.addGroupMember(chat.id, userId);
      dispatch(updateChat(updatedChat));
      // Remove from search results
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('[GroupInfo] Add member failed:', err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId);
    try {
      const updatedChat = await chatService.removeGroupMember(chat.id, userId);
      dispatch(updateChat(updatedChat));
    } catch (err) {
      console.error('[GroupInfo] Remove member failed:', err);
    }
    setRemovingId(null);
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 340 } }}>
      <Box sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Group Info</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>

        {/* Group avatar & name */}
        <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              isAdmin ? (
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, width: 28, height: 28 }}
                >
                  {isUploading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CameraAlt sx={{ fontSize: 16 }} />}
                </IconButton>
              ) : null
            }
          >
            <Avatar
              src={chat.groupAvatar}
              sx={{ width: 80, height: 80, mb: 0.5, bgcolor: 'primary.main' }}
            >
              {!chat.groupAvatar && <Group sx={{ fontSize: 40 }} />}
            </Avatar>
          </Badge>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={handleAvatarUpload}
          />

          {editing ? (
            <Box display="flex" gap={1} alignItems="center">
              <TextField
                size="small"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <Button size="small" variant="contained" onClick={handleSaveName}>
                Save
              </Button>
              <Button size="small" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </Box>
          ) : (
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6">{chat.groupName}</Typography>
              {isAdmin && (
                <IconButton
                  size="small"
                  onClick={() => { setNewName(chat.groupName || ''); setEditing(true); }}
                >
                  <Edit fontSize="small" />
                </IconButton>
              )}
            </Box>
          )}

          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {chat.members?.length || 0} members
          </Typography>
          {isAdmin && <Chip label="Admin" size="small" color="primary" sx={{ mt: 0.5 }} />}
        </Box>

        <Divider />

        {/* Description */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Description</Typography>
          <Typography variant="body2" color="text.secondary">
            No description set
          </Typography>
        </Box>

        <Divider />

        {/* Members */}
        <Box sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">
              Members ({chat.members?.length || 0})
            </Typography>
            {isAdmin && (
              <Tooltip title="Add member">
                <IconButton
                  size="small"
                  onClick={() => setAddingMember(!addingMember)}
                  sx={{ color: '#7c5cbf' }}
                >
                  <PersonAdd fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Add member search */}
          {addingMember && isAdmin && (
            <Box mb={2}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search users to add..."
                value={searchQuery}
                onChange={(e) => handleSearchUsers(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" sx={{ color: '#7c5cbf' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 1 }}
              />
              {isSearching && (
                <Box display="flex" justifyContent="center" py={1}>
                  <CircularProgress size={20} />
                </Box>
              )}
              {searchResults.length > 0 && (
                <List dense disablePadding sx={{ maxHeight: 150, overflow: 'auto' }}>
                  {searchResults.map((user) => (
                    <ListItem
                      key={user.id}
                      disablePadding
                      sx={{ py: 0.5 }}
                      secondaryAction={
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAddMember(user.id)}
                          sx={{ minWidth: 'auto', px: 1, fontSize: '0.7rem' }}
                        >
                          Add
                        </Button>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar src={user.avatar} sx={{ width: 32, height: 32 }}>
                          {user.name?.[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={user.name} primaryTypographyProps={{ fontSize: '0.85rem' }} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {/* Member list */}
          <List dense disablePadding>
            {chat.members?.map((member) => (
              <ListItem
                key={member.id}
                disablePadding
                sx={{ py: 0.5 }}
                secondaryAction={
                  isAdmin && member.id !== currentUser?.id && member.id !== chat.groupAdmin?.id ? (
                    <Tooltip title="Remove member">
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingId === member.id}
                        sx={{ color: '#e53935' }}
                      >
                        {removingId === member.id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <PersonRemove fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  ) : undefined
                }
              >
                <ListItemAvatar>
                  <Avatar src={member.avatar} sx={{ width: 36, height: 36 }}>
                    {member.name?.[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {member.name}
                      {member.id === currentUser?.id && (
                        <Chip label="You" size="small" sx={{ height: 18, fontSize: 10 }} />
                      )}
                      {chat.groupAdmin?.id === member.id && (
                        <Chip label="Admin" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Circle sx={{ fontSize: 8, color: onlineUsers[member.id] ? 'success.main' : 'text.disabled' }} />
                      {onlineUsers[member.id] ? 'Online' : 'Offline'}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    </Drawer>
  );
}
