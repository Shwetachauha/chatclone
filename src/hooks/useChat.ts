import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './useAuth';
import { setActiveChat, resetUnread } from '@/store/slices/chatSlice';
import { fetchMessages } from '@/store/slices/messageSlice';
import { selectSortedChats, selectActiveChat } from '@/store/selectors/chatSelectors';
import { Chat } from '@/types';
import { useSocket } from './useSocket';
import { messageEmitters } from '@/socket/emitters/messageEmitters';
import { messageService } from '@/services/messageService';

export function useChat() {
  const dispatch = useAppDispatch();
  const chats = useAppSelector(selectSortedChats);
  const activeChat = useAppSelector(selectActiveChat);
  const isLoading = useAppSelector((state) => state.chat.isLoading);
  const { joinChat } = useSocket();

  const openChat = useCallback(
    (chat: Chat) => {
      if (activeChat?.id === chat.id) return;

      // Set active chat (no need to leave other rooms — we stay joined to all for notifications)
      dispatch(setActiveChat(chat));
      dispatch(resetUnread(chat.id));

      // Join chat room (ensures we're in it even if it's new)
      joinChat(chat.id);

      // Fetch messages if not loaded
      dispatch(fetchMessages({ chatId: chat.id, limit: 50 }));

      // Mark messages as read (socket + REST)
      messageEmitters.markRead(chat.id);
      messageService.markRead(chat.id).catch(() => {});
    },
    [activeChat, dispatch, joinChat]
  );

  const closeChat = useCallback(() => {
    dispatch(setActiveChat(null));
  }, [dispatch]);

  return {
    chats,
    activeChat,
    isLoading,
    openChat,
    closeChat,
  };
}
