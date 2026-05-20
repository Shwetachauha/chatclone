import { useState, useRef } from 'react';
import {
  Drawer,
  Box,
  Avatar,
  Typography,
  IconButton,
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
import { Close, Edit, Group, CameraAlt, PersonRemove, PersonAdd, Search } from '@mui/icons-material';
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
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 360, bgcolor: '#f5f6fa', overflow: 'hidden' } }}>
      {/* Header with gradient */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          pt: 1.5,
          pb: 5,
          px: 2.5,
          position: 'relative',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, letterSpacing: 0.5 }}>
            Group Info
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.15)' } }}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Avatar card overlapping header */}
      <Box
        sx={{
          mx: 2.5,
          mt: -4,
          mb: 1.5,
          bgcolor: 'white',
          borderRadius: 3,
          boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
          py: 2.5,
          px: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            isAdmin ? (
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                sx={{
                  bgcolor: '#667eea',
                  color: 'white',
                  '&:hover': { bgcolor: '#5a6fd6' },
                  width: 30,
                  height: 30,
                  boxShadow: '0 2px 8px rgba(102,126,234,0.4)',
                }}
              >
                {isUploading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CameraAlt sx={{ fontSize: 16 }} />}
              </IconButton>
            ) : null
          }
        >
          <Avatar
            src={chat.groupAvatar}
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'linear-gradient(135deg, #667eea, #764ba2)',
              background: !chat.groupAvatar ? 'linear-gradient(135deg, #667eea, #764ba2)' : undefined,
              boxShadow: '0 4px 14px rgba(102,126,234,0.25)',
              fontSize: 34,
            }}
          >
            {!chat.groupAvatar && <Group sx={{ fontSize: 38 }} />}
          </Avatar>
        </Badge>
        <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleAvatarUpload} />

        {editing ? (
          <Box display="flex" gap={1} alignItems="center" mt={2}>
            <TextField
              size="small"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Button size="small" variant="contained" onClick={handleSaveName} sx={{ borderRadius: 2, textTransform: 'none' }}>
              Save
            </Button>
            <Button size="small" onClick={() => setEditing(false)} sx={{ borderRadius: 2, textTransform: 'none' }}>
              Cancel
            </Button>
          </Box>
        ) : (
          <Box display="flex" alignItems="center" gap={0.5} mt={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a2e' }}>
              {chat.groupName}
            </Typography>
            {isAdmin && (
              <IconButton
                size="small"
                onClick={() => { setNewName(chat.groupName || ''); setEditing(true); }}
                sx={{ color: '#667eea' }}
              >
                <Edit fontSize="small" />
              </IconButton>
            )}
          </Box>
        )}

        <Typography variant="caption" sx={{ color: '#8e8ea0', mt: 0.3, fontSize: '0.78rem' }}>
          {chat.members?.length || 0} members
        </Typography>
        {isAdmin && (
          <Chip
            label="Admin"
            size="small"
            sx={{
              mt: 0.8,
              height: 22,
              fontSize: '0.68rem',
              bgcolor: 'rgba(102,126,234,0.08)',
              color: '#667eea',
              fontWeight: 600,
              border: '1px solid rgba(102,126,234,0.15)',
            }}
          />
        )}
      </Box>

      {/* Description section */}
      <Box
        sx={{
          mx: 2.5,
          mb: 1.5,
          bgcolor: 'white',
          borderRadius: 2.5,
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          px: 2.5,
          py: 2,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
          Description
        </Typography>
        <Typography variant="body2" sx={{ color: '#8e8ea0', mt: 0.5, fontSize: '0.82rem', lineHeight: 1.5 }}>
          {(chat as any).description || 'No description set'}
        </Typography>
      </Box>

      {/* Members section */}
      <Box
        sx={{
          mx: 2.5,
          mb: 2,
          bgcolor: 'white',
          borderRadius: 2.5,
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          px: 2.5,
          py: 2,
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
            Members ({chat.members?.length || 0})
          </Typography>
          {isAdmin && (
            <Button
              size="small"
              startIcon={<PersonAdd sx={{ fontSize: 16 }} />}
              onClick={() => setAddingMember(!addingMember)}
              sx={{
                borderRadius: 5,
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                px: 1.5,
                py: 0.4,
                bgcolor: addingMember ? '#667eea' : 'rgba(102,126,234,0.08)',
                color: addingMember ? 'white' : '#667eea',
                '&:hover': { bgcolor: addingMember ? '#5a6fd6' : 'rgba(102,126,234,0.15)' },
              }}
            >
              Add
            </Button>
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
                    <Search fontSize="small" sx={{ color: '#667eea' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.5,
                  bgcolor: '#f8f9fc',
                  '&:hover fieldset': { borderColor: '#667eea' },
                  '&.Mui-focused fieldset': { borderColor: '#667eea' },
                },
              }}
            />
            {isSearching && (
              <Box display="flex" justifyContent="center" py={1}>
                <CircularProgress size={20} sx={{ color: '#667eea' }} />
              </Box>
            )}
            {searchResults.length > 0 && (
              <List dense disablePadding sx={{ maxHeight: 150, overflow: 'auto' }}>
                {searchResults.map((user) => (
                  <ListItem
                    key={user.id}
                    disablePadding
                    sx={{
                      py: 0.5,
                      px: 1,
                      borderRadius: 2,
                      '&:hover': { bgcolor: '#f8f9fc' },
                    }}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleAddMember(user.id)}
                        sx={{
                          minWidth: 'auto',
                          px: 1.5,
                          fontSize: '0.7rem',
                          borderRadius: 2,
                          textTransform: 'none',
                          bgcolor: '#667eea',
                          boxShadow: 'none',
                          '&:hover': { bgcolor: '#5a6fd6', boxShadow: 'none' },
                        }}
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
                    <ListItemText primary={user.name} primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Member list */}
        <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
          {chat.members?.map((member) => (
            <ListItem
              key={member.id}
              disablePadding
              sx={{
                py: 0.8,
                px: 1.2,
                borderRadius: 2,
                mb: 0.3,
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: 'rgba(102,126,234,0.04)' },
              }}
              secondaryAction={
                isAdmin && member.id !== currentUser?.id && member.id !== chat.groupAdmin?.id ? (
                  <Tooltip title="Remove member" arrow>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={removingId === member.id}
                      sx={{
                        color: '#ff4757',
                        bgcolor: 'rgba(255,71,87,0.06)',
                        borderRadius: '50%',
                        width: 28,
                        height: 28,
                        '&:hover': { bgcolor: 'rgba(255,71,87,0.14)', transform: 'scale(1.1)' },
                      }}
                    >
                      {removingId === member.id ? (
                        <CircularProgress size={13} />
                      ) : (
                        <PersonRemove sx={{ fontSize: 15 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                ) : undefined
              }
            >
              <ListItemAvatar sx={{ minWidth: 48 }}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                  sx={{
                    '& .MuiBadge-badge': {
                      bgcolor: onlineUsers[member.id] ? '#4caf50' : '#bdbdbd',
                      boxShadow: '0 0 0 2px white',
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                    },
                  }}
                >
                  <Avatar
                    src={member.avatar}
                    sx={{ width: 36, height: 36, fontSize: '0.85rem', border: '2px solid #f0f0f5' }}
                  >
                    {member.name?.[0]}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={0.5} flexWrap="nowrap">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a1a2e', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {member.name}
                    </Typography>
                    {member.id === currentUser?.id && (
                      <Chip
                        label="You"
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(102,126,234,0.1)',
                          color: '#667eea',
                          '& .MuiChip-label': { px: 0.6 },
                        }}
                      />
                    )}
                    {chat.groupAdmin?.id === member.id && (
                      <Chip
                        label="Admin"
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(255,165,0,0.1)',
                          color: '#f5a623',
                          '& .MuiChip-label': { px: 0.6 },
                        }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Typography variant="caption" sx={{ color: onlineUsers[member.id] ? '#4caf50' : '#8e8ea0', fontSize: '0.7rem' }}>
                    {onlineUsers[member.id] ? 'Online' : 'Offline'}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}
