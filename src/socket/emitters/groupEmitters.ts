import { socketManager } from '@/socket/socketManager';
import { ClientEvent } from '@/types/socket';

export const groupEmitters = {
  updateGroup(chatId: string, data: { groupName?: string; groupDescription?: string; groupAvatar?: string }) {
    console.log('[GroupEmit] group:update', { chatId, ...data });
    socketManager.emit(ClientEvent.GROUP_UPDATE, { chatId, ...data });
  },
};
