import { useEffect } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { setIsMobile } from '@/store/slices/uiSlice';
import { fetchChats } from '@/store/slices/chatSlice';
import { Sidebar } from './Sidebar';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { MOCK_MODE } from '@/mocks/config';import { socketManager } from '@/socket';
export function MainLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();

  // Initialize socket connection
  useSocket();

  useEffect(() => {
    dispatch(setIsMobile(isMobile));
  }, [isMobile, dispatch]);

  // Fetch chats and join all rooms for real-time sidebar updates
  const chats = useAppSelector((state) => state.chat.chats);
  const isConnected = useAppSelector((state) => state.ui.isConnected);

  useEffect(() => {
    if (!MOCK_MODE) {
      dispatch(fetchChats());
    }
  }, [dispatch]);

  // Join all chat rooms once chats are loaded and socket is connected
  useEffect(() => {
    if (!MOCK_MODE && isConnected && chats.length > 0) {
      const chatIds = chats.map((c) => c.id);
      socketManager.joinAllChats(chatIds);
    }
  }, [isConnected, chats.length]);

  return (
    <Box display="flex" height="100vh" overflow="hidden" sx={{ bgcolor: '#1a1a2e' }}>
      <Sidebar />
      <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
        <Outlet />
      </Box>
      <CreateGroupDialog />
    </Box>
  );
}
