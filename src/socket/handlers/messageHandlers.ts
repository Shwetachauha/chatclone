import { Socket } from 'socket.io-client';
import { store } from '@/store';
import { ServerEvent, Message } from '@/types';
import { addMessage, updateMessage, deleteMessage, editMessageContent } from '@/store/slices/messageSlice';
import { updateLastMessage, incrementUnread, addChat } from '@/store/slices/chatSlice';
import { normalizeChat } from '@/services/chatService';

export function registerMessageHandlers(socket: Socket): void {
  socket.on(ServerEvent.MESSAGE_RECEIVED, (rawMessage: Record<string, unknown>) => {
    // Normalize server message format (backend may use `chat`/`_id`/`sender._id` instead of `chatId`/`id`/`sender.id`)
    const rawSender = rawMessage.sender as Record<string, unknown> | undefined;
    const message: Message = {
      ...(rawMessage as unknown as Message),
      id: (rawMessage.id || rawMessage._id) as string,
      chatId: (rawMessage.chatId || rawMessage.chat) as string,
      sender: rawSender
        ? {
            id: (rawSender.id || rawSender._id) as string,
            name: rawSender.name as string,
            avatar: rawSender.avatar as string | undefined,
          }
        : (rawMessage.sender as unknown as Message['sender']),
    };

    console.log('[Socket] message_received:', { id: message.id, chatId: message.chatId, content: message.content, sender: message.sender?.name });

    if (!message.chatId) {
      console.warn('[Socket] message_received: missing chatId, skipping', rawMessage);
      return;
    }

    const state = store.getState();
    const currentUserId = state.auth.user?.id;

    // Skip own messages — already handled by optimistic update + REST confirmation
    if (message.sender?.id === currentUserId) {
      console.log('[Socket] Skipping own message:', message.id);
      return;
    }

    const activeChat = state.chat.activeChat;

    // Deduplicate: skip if already in store
    const chatMessages = state.messages.messagesByChatId[message.chatId];
    if (chatMessages?.entities[message.id]) {
      console.log('[Socket] Skipping duplicate message:', message.id);
      return;
    }

    store.dispatch(addMessage(message));

    // Update last message on chat list
    store.dispatch(updateLastMessage({
      chatId: message.chatId,
      latestMessage: {
        content: message.content,
        type: message.type,
        sender: { name: message.sender.name, avatar: message.sender.avatar },
        createdAt: message.createdAt,
      },
    }));

    // Increment unread if not the active chat
    if (activeChat?.id !== message.chatId) {
      store.dispatch(incrementUnread(message.chatId));
    }
  });

  socket.on(ServerEvent.MESSAGE_REACTION, (data: { message: Record<string, unknown> }) => {
    console.log('[Socket] message_reaction:', data);
    const raw = data.message;
    if (!raw) return;
    const chatId = (raw.chatId || raw.chat) as string;
    const messageId = (raw.id || raw._id) as string;
    if (!chatId || !messageId) return;

    const reactions = Array.isArray(raw.reactions)
      ? (raw.reactions as Array<Record<string, unknown>>).map((r) => {
          const user = r.user as Record<string, unknown> | undefined;
          return {
            emoji: r.emoji as string,
            userId: user ? (user.id || user._id) as string : r.userId as string,
            username: user ? user.name as string : r.username as string,
          };
        })
      : [];

    // Get existing message from store and merge reactions
    const state = store.getState();
    const existing = state.messages.messagesByChatId[chatId]?.entities[messageId];
    if (existing) {
      store.dispatch(updateMessage({ chatId, message: { ...existing, reactions } }));
    } else {
      // Message not in store yet — build from raw
      const rawSender = raw.sender as Record<string, unknown> | undefined;
      const message: Message = {
        ...(raw as unknown as Message),
        id: messageId,
        chatId,
        sender: rawSender
          ? { id: (rawSender.id || rawSender._id) as string, name: rawSender.name as string, avatar: rawSender.avatar as string | undefined }
          : (raw.sender as unknown as Message['sender']),
        reactions,
      };
      store.dispatch(updateMessage({ chatId, message }));
    }
  });

  socket.on(ServerEvent.MESSAGE_DELETED, (data: { chatId: string; messageId: string }) => {
    console.log('[Socket] message_deleted:', data);
    store.dispatch(deleteMessage({ chatId: data.chatId, messageId: data.messageId }));
  });

  socket.on(ServerEvent.MESSAGE_EDITED, (data: { message: Record<string, unknown> }) => {
    console.log('[Socket] message_edited:', data);
    const raw = data.message;
    if (!raw) return;
    const chatId = (raw.chatId || raw.chat) as string;
    const messageId = (raw.id || raw._id) as string;
    const content = raw.content as string;
    if (chatId && messageId) {
      store.dispatch(editMessageContent({ chatId, messageId, content }));
    }
  });

  // Handle new_chat: when first message is sent to/from a new user, add chat to sidebar
  socket.on(ServerEvent.NEW_CHAT, (data: { chat: Record<string, unknown>; message: Record<string, unknown> }) => {
    console.log('[Socket] new_chat:', data);
    const state = store.getState();
    const currentUserId = state.auth.user?.id;
    const activeChat = state.chat.activeChat;

    if (data.chat) {
      const chat = normalizeChat(data.chat);
      // Derive chatWith from members if not set
      if (!chat.isGroupChat && (!chat.chatWith || !chat.chatWith.name) && chat.members.length > 0 && currentUserId) {
        const other = chat.members.find((m) => m.id !== currentUserId) || chat.members[0];
        chat.chatWith = other;
      }

      // Set unread count based on whether this chat is currently active
      if (activeChat?.id !== chat.id) {
        chat.unreadCount = 1;
      }

      // Set latestMessage from the incoming message
      if (data.message) {
        const rawSender = data.message.sender as Record<string, unknown> | undefined;
        chat.latestMessage = {
          content: data.message.content as string,
          type: (data.message.type as string || 'TEXT') as 'TEXT' | 'IMAGE' | 'FILE',
          sender: rawSender
            ? { name: rawSender.name as string, avatar: rawSender.avatar as string | undefined }
            : { name: '' },
          createdAt: data.message.createdAt as string || new Date().toISOString(),
        };
      }

      store.dispatch(addChat(chat));
      // Join the new chat room to receive future messages
      socket.emit('join_chat', chat.id);
    }

    if (data.message) {
      const rawSender = data.message.sender as Record<string, unknown> | undefined;
      const message: Message = {
        ...(data.message as unknown as Message),
        id: (data.message.id || data.message._id) as string,
        chatId: (data.message.chatId || data.message.chat) as string,
        sender: rawSender
          ? { id: (rawSender.id || rawSender._id) as string, name: rawSender.name as string, avatar: rawSender.avatar as string | undefined }
          : (data.message.sender as unknown as Message['sender']),
      };

      if (message.chatId) {
        store.dispatch(addMessage(message));
      }
    }
  });
}
