import { Socket } from 'socket.io-client';
import { store } from '@/store';
import { ServerEvent, TypingEvent, ReadReceiptEvent } from '@/types';
import { setUserTyping, removeUserTyping } from '@/store/slices/typingSlice';
import { updateReadReceipt } from '@/store/slices/messageSlice';

// Auto-clear typing after timeout if stop_typing is missed
const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const TYPING_TIMEOUT = 4000;

export function registerTypingHandlers(socket: Socket): void {
  socket.on(ServerEvent.TYPING, (event: TypingEvent) => {
    const state = store.getState();
    if (event.userId !== state.auth.user?.id) {
      store.dispatch(setUserTyping({
        chatId: event.chatId,
        userId: event.userId,
      }));

      // Reset auto-clear timer
      const key = `${event.chatId}:${event.userId}`;
      if (typingTimers[key]) {
        clearTimeout(typingTimers[key]);
      }
      typingTimers[key] = setTimeout(() => {
        store.dispatch(removeUserTyping({
          chatId: event.chatId,
          userId: event.userId,
        }));
        delete typingTimers[key];
      }, TYPING_TIMEOUT);
    }
  });

  socket.on(ServerEvent.STOP_TYPING, (event: TypingEvent) => {
    const key = `${event.chatId}:${event.userId}`;
    if (typingTimers[key]) {
      clearTimeout(typingTimers[key]);
      delete typingTimers[key];
    }
    store.dispatch(removeUserTyping({
      chatId: event.chatId,
      userId: event.userId,
    }));
  });

  socket.on(ServerEvent.READ_RECEIPT, (event: ReadReceiptEvent) => {
    console.log('[Socket] read_receipt:', event);
    const state = store.getState();
    // Don't process our own read receipts
    if (event.userId === state.auth.user?.id) return;

    const chatMessages = state.messages.messagesByChatId[event.chatId];
    if (chatMessages) {
      // Mark all messages in this chat as read by this user
      chatMessages.ids.forEach((msgId) => {
        const msg = chatMessages.entities[msgId];
        if (msg && msg.sender.id === state.auth.user?.id) {
          store.dispatch(updateReadReceipt({
            chatId: event.chatId,
            messageId: msgId,
            userId: event.userId,
          }));
        }
      });
    }
  });
}
