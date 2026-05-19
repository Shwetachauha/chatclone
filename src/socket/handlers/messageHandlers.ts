import { Socket } from 'socket.io-client';
import { store } from '@/store';
import { ServerEvent, Message } from '@/types';
import { addMessage, addReaction, removeReaction, deleteMessage, editMessageContent } from '@/store/slices/messageSlice';
import { updateLastMessage, incrementUnread } from '@/store/slices/chatSlice';

interface ReactionEvent {
  chatId: string;
  messageId: string;
  emoji: string;
  userId: string;
  username: string;
  action: 'add' | 'remove';
}

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

  socket.on(ServerEvent.MESSAGE_REACTION, (event: ReactionEvent) => {
    const state = store.getState();
    // Skip if it's our own reaction (already applied locally)
    if (event.userId === state.auth.user?.id) return;

    if (event.action === 'add') {
      store.dispatch(addReaction({
        chatId: event.chatId,
        messageId: event.messageId,
        emoji: event.emoji,
        userId: event.userId,
        username: event.username,
      }));
    } else {
      store.dispatch(removeReaction({
        chatId: event.chatId,
        messageId: event.messageId,
        emoji: event.emoji,
        userId: event.userId,
      }));
    }
  });

  socket.on(ServerEvent.MESSAGE_DELETED, (data: { chatId: string; messageId: string }) => {
    console.log('[Socket] message_deleted:', data);
    store.dispatch(deleteMessage({ chatId: data.chatId, messageId: data.messageId }));
  });

  socket.on(ServerEvent.MESSAGE_EDITED, (data: { chatId: string; messageId: string; content: string }) => {
    console.log('[Socket] message_edited:', data);
    store.dispatch(editMessageContent({
      chatId: data.chatId,
      messageId: data.messageId,
      content: data.content,
    }));
  });
}
