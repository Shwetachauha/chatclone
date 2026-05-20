import { useState, useMemo, memo } from 'react';
import {
  Box,
  TextField,
  List,
  Typography,
  IconButton,
  InputAdornment,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import { Search, GroupAdd, ChatBubble, PersonSearch, People, Person, Forum, Phone } from '@mui/icons-material';
import { useChat } from '@/hooks/useChat';
import { useAppDispatch, useAppSelector } from '@/hooks/useAuth';
import { setCreateGroupDialogOpen } from '@/store/slices/uiSlice';
import { clearAuth } from '@/store/slices/authSlice';
import { ChatListItem } from './ChatListItem';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { UserSearchDialog } from './UserSearchDialog';
import { CallHistory } from '@/components/call/CallHistory';
import { MyProfileDialog } from './MyProfileDialog';
import { Avatar } from '@/components/common/Avatar';

export const ChatList = memo(function ChatList() {
  const { chats, activeChat, isLoading, openChat } = useChat();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const isConnected = useAppSelector((state) => state.ui.isConnected);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const filteredChats = useMemo(() => {
    let filtered = chats;

    // Filter by tab
    if (activeTab === 1) {
      filtered = filtered.filter((chat) => !chat.isGroupChat);
    } else if (activeTab === 2) {
      filtered = filtered.filter((chat) => chat.isGroupChat);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((chat) => {
        const name = chat.isGroupChat ? (chat.groupName || '') : (chat.chatWith?.name || '');
        return name.toLowerCase().includes(query);
      });
    }

    return filtered;
  }, [chats, searchQuery, activeTab]);

  if (isLoading) return <LoadingSkeleton variant="chat-list" />;

  return (
    <Box display="flex" flexDirection="column" height="100%" sx={{ bgcolor: '#f3eefa' }}>
      {/* Header */}
      <Box
        sx={{
          background: '#e8dff5',
          px: 2.5,
          py: 2,
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1.2}>
            <Tooltip title="My Profile">
              <IconButton
                onClick={() => setProfileOpen(true)}
                sx={{ p: 0 }}
              >
                <Avatar
                  name={currentUser?.name || 'User'}
                  src={currentUser?.avatar}
                  size={40}
                  online={isConnected}
                />
              </IconButton>
            </Tooltip>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#2d1b69', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                Chats
              </Typography>
              <Typography variant="caption" sx={{ color: '#7c5cbf', fontSize: 11 }}>
                {currentUser?.name}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={0.5}>
            <Tooltip title="Search Users">
              <IconButton
                onClick={() => setUserSearchOpen(true)}
                size="small"
                sx={{
                  color: '#7c5cbf',
                  bgcolor: 'rgba(124,92,191,0.1)',
                  '&:hover': { bgcolor: 'rgba(124,92,191,0.2)' },
                }}
              >
                <PersonSearch fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="New Group">
              <IconButton
                onClick={() => dispatch(setCreateGroupDialogOpen(true))}
                size="small"
                sx={{
                  color: '#7c5cbf',
                  bgcolor: 'rgba(124,92,191,0.1)',
                  '&:hover': { bgcolor: 'rgba(124,92,191,0.2)' },
                }}
              >
                <GroupAdd fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <TextField
          fullWidth
          size="small"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" sx={{ color: '#7c5cbf' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '14px',
              bgcolor: '#ffffff',
              color: '#1a1a2e',
              '& fieldset': { borderColor: 'rgba(124,92,191,0.2)' },
              '& input::placeholder': { color: 'rgba(0,0,0,0.4)', opacity: 1 },
            },
          }}
        />
      </Box>

      {/* Tabs */}
      <Box px={1.5} pt={1.5}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 38,
            bgcolor: 'rgba(124,92,191,0.08)',
            borderRadius: '12px',
            p: 0.5,
            '& .MuiTabs-indicator': {
              height: '100%',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              zIndex: 0,
            },
            '& .MuiTab-root': {
              minHeight: 34,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: '#7c5cbf',
              zIndex: 1,
              transition: 'color 0.2s',
              '&.Mui-selected': { color: 'white' },
            },
          }}
        >
          <Tab icon={<ChatBubble sx={{ fontSize: 16 }} />} iconPosition="start" label="All" />
          <Tab icon={<Person sx={{ fontSize: 16 }} />} iconPosition="start" label="Direct" />
          <Tab icon={<People sx={{ fontSize: 16 }} />} iconPosition="start" label="Groups" />
          <Tab icon={<Phone sx={{ fontSize: 16 }} />} iconPosition="start" label="Calls" />
        </Tabs>
      </Box>

      {/* Call history tab */}
      {activeTab === 3 ? (
        <CallHistory />
      ) : (
      /* Chat list */
      <List sx={{ flex: 1, overflow: 'auto', px: 0.5, pt: 1, '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
        {filteredChats.length === 0 ? (
          <EmptyState variant="no-chats" />
        ) : (
          filteredChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={activeChat?.id === chat.id}
              onSelect={openChat}
            />
          ))
        )}
      </List>
      )}

      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
      />

      <MyProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={() => {
          setProfileOpen(false);
          dispatch(clearAuth());
        }}
      />
    </Box>
  );
});
