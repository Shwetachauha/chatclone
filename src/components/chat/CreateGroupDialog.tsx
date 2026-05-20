import { useState, useRef } from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Typography,
  IconButton,
  Badge,
} from '@mui/material';
import { CameraAlt } from '@mui/icons-material';
import { AnimatedDialog } from '@/components/common/AnimatedDialog';
import { useAppDispatch, useAppSelector } from '@/hooks/useAuth';
import { setCreateGroupDialogOpen } from '@/store/slices/uiSlice';
import { createGroupChat } from '@/store/slices/chatSlice';
import { uploadService } from '@/services/uploadService';
import { userService } from '@/services/userService';
import { User } from '@/types';
import { Avatar } from '@/components/common/Avatar';
import { debounce } from '@/utils/helpers';

export function CreateGroupDialog() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.ui.createGroupDialogOpen);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupIcon, setGroupIcon] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
      const result = await uploadService.uploadFile(file);
      console.log('[GroupIcon] Upload result:', result);
      console.log('[GroupIcon] Icon URL:', result.url);
      setGroupIcon(result.url);
    } catch (err) {
      console.error('[GroupIcon] Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = debounce(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const users = await userService.searchUsers(query);
      setSearchResults(users);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, 300);

  const handleClose = () => {
    dispatch(setCreateGroupDialogOpen(false));
    setGroupName('');
    setGroupDescription('');
    setGroupIcon(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUsers([]);
  };

  const handleCreate = () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    console.log('[GroupCreate] Creating group with:', {
      groupName: groupName.trim(),
      members: selectedUsers.map((u) => u.id),
      groupAvatar: groupIcon,
    });
    dispatch(createGroupChat({
      groupName: groupName.trim(),
      members: selectedUsers.map((u) => u.id),
      ...(groupIcon && { groupAvatar: groupIcon }),
      ...(groupDescription.trim() && { description: groupDescription.trim() }),
    }));
    handleClose();
  };

  const toggleUser = (user: User) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
    // Clear search field after selecting a user
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <AnimatedDialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Group Chat</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          {/* Group Icon Upload */}
          <Box display="flex" justifyContent="center">
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, width: 28, height: 28 }}
                >
                  <CameraAlt sx={{ fontSize: 16 }} />
                </IconButton>
              }
            >
              {isUploading ? (
                <Box sx={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : groupIcon ? (
                <Box component="img" src={groupIcon} sx={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <Avatar name={groupName || 'G'} size={72} />
              )}
            </Badge>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleIconUpload} />
          </Box>

          <TextField
            label="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Group Description"
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="What's this group about?"
          />

          <TextField
            label="Search Users"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            fullWidth
            placeholder="Type to search users..."
          />

          {selectedUsers.length > 0 && (
            <Box display="flex" flexWrap="wrap" gap={0.5}>
              {selectedUsers.map((user) => (
                <Chip
                  key={user.id}
                  label={user.name}
                  onDelete={() => toggleUser(user)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          )}

          {isSearching && (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={24} />
            </Box>
          )}

          <List sx={{ maxHeight: 200, overflow: 'auto' }}>
            {searchResults.map((user) => (
              <ListItemButton
                key={user.id}
                onClick={() => toggleUser(user)}
                selected={selectedUsers.some((u) => u.id === user.id)}
              >
                <Avatar name={user.name} src={user.avatar} size={32} />
                <ListItemText primary={user.name} secondary={user.email} sx={{ ml: 1.5 }} />
              </ListItemButton>
            ))}
          </List>

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No users found
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={!groupName.trim() || selectedUsers.length === 0}
        >
          Create Group
        </Button>
      </DialogActions>
    </AnimatedDialog>
  );
}
