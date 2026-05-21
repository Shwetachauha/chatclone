import { Socket } from 'socket.io-client';
import { store } from '@/store';
import { upsertChat, removeChat } from '@/store/slices/chatSlice';
import { ServerEvent } from '@/types/socket';
import { Chat } from '@/types';
import { normalizeChat } from '@/services/chatService';

export function registerGroupHandlers(socket: Socket): void {
  socket.on(ServerEvent.GROUP_UPDATED, (data: { chat: Chat } | Chat) => {
    const raw = 'chat' in data ? data.chat : data;
    const chat = normalizeChat(raw as unknown as Record<string, unknown>);
    console.log('[GroupHandler] group_updated received:', chat);
    store.dispatch(upsertChat(chat));
  });

  socket.on(ServerEvent.MEMBER_LEFT, (data: { chatId: string; userId: string; chat: Chat }) => {
    const chat = normalizeChat(data.chat as unknown as Record<string, unknown>);
    console.log('[GroupHandler] member_left received:', { chatId: data.chatId, userId: data.userId, members: chat.members?.length });
    const currentUserId = store.getState().auth.user?.id;
    if (data.userId === currentUserId) {
      // Current user was removed — remove chat from sidebar
      store.dispatch(removeChat(data.chatId));
    } else {
      // Another member was removed — update the chat
      store.dispatch(upsertChat(chat));
    }
  });

  socket.on(ServerEvent.CHAT_DELETED, (data: { chatId: string }) => {
    console.log('[GroupHandler] chat_deleted received:', data.chatId);
    store.dispatch(removeChat(data.chatId));
  });
}
