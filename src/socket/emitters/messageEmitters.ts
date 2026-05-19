import { socketManager } from '../socketManager';
import { ClientEvent } from '@/types';

export const messageEmitters = {
  markRead(chatId: string): void {
    socketManager.emit(ClientEvent.MARK_READ, { chatId });
  },

  deleteMessage(messageId: string): void {
    console.log('[MessageEmit] delete_message', { messageId });
    socketManager.emit(ClientEvent.DELETE_MESSAGE, { messageId });
  },

  editMessage(messageId: string, content: string): void {
    console.log('[MessageEmit] message:edit', { messageId, content });
    socketManager.emit(ClientEvent.EDIT_MESSAGE, { messageId, content });
  },

  reactMessage(messageId: string, emoji: string): void {
    socketManager.emit(ClientEvent.REACT_MESSAGE, { messageId, emoji });
  },
};
