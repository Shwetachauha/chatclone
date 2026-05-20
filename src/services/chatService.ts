import api from './api';
import { Chat, ChatMember } from '@/types';

interface ChatsResponse {
  chats: unknown[];
}

interface ChatResponse {
  chat: unknown;
}

// Normalize server chat format (_id → id, members._id → members.id, etc.)
function normalizeMember(raw: Record<string, unknown>): ChatMember {
  return {
    id: (raw.id || raw._id) as string,
    name: raw.name as string,
    email: raw.email as string | undefined,
    avatar: raw.avatar as string | undefined,
    isOnline: raw.isOnline as boolean | undefined,
    lastSeen: raw.lastSeen as string | null | undefined,
  };
}

export function normalizeChat(raw: Record<string, unknown>): Chat {
  const members = Array.isArray(raw.members)
    ? (raw.members as Record<string, unknown>[]).map(normalizeMember)
    : [];
  const rawGroupAdmin = raw.groupAdmin as Record<string, unknown> | string | null;
  const groupAdmin = rawGroupAdmin && typeof rawGroupAdmin === 'object'
    ? { id: (rawGroupAdmin.id || rawGroupAdmin._id) as string, name: rawGroupAdmin.name as string }
    : rawGroupAdmin && typeof rawGroupAdmin === 'string'
      ? { id: rawGroupAdmin, name: '' }
      : null;

  const rawLatest = raw.latestMessage as Record<string, unknown> | null;
  let latestMessage = null;
  if (rawLatest && typeof rawLatest === 'object') {
    const rawSender = rawLatest.sender as Record<string, unknown> | undefined;
    latestMessage = {
      content: rawLatest.content as string,
      type: (rawLatest.type || 'TEXT') as Chat['latestMessage'] extends null ? never : NonNullable<Chat['latestMessage']>['type'],
      sender: rawSender
        ? { name: rawSender.name as string, avatar: rawSender.avatar as string | undefined }
        : { name: '' },
      createdAt: rawLatest.createdAt as string,
    };
  }

  // For private chats, derive chatWith from members
  const isGroupChat = raw.isGroupChat as boolean;
  let chatWith: ChatMember | null = null;
  if (!isGroupChat && raw.chatWith && typeof raw.chatWith === 'object') {
    chatWith = normalizeMember(raw.chatWith as Record<string, unknown>);
  }

  return {
    id: (raw.id || raw._id) as string,
    isGroupChat,
    chatWith,
    groupName: (raw.groupName || null) as string | null,
    groupAvatar: raw.groupAvatar as string | undefined,
    groupAdmin,
    members,
    latestMessage,
    unreadCount: (raw.unreadCount || 0) as number,
    updatedAt: (raw.updatedAt || raw.createdAt || new Date().toISOString()) as string,
  };
}

export const chatService = {
  async getChats(): Promise<Chat[]> {
    const response = await api.get<ChatsResponse>('/chats');
    return (response.data.chats || []).map((c) => normalizeChat(c as Record<string, unknown>));
  },

  async createPrivateChat(userId: string): Promise<Chat> {
    const response = await api.post<ChatResponse>('/chats', { userId });
    return normalizeChat(response.data.chat as Record<string, unknown>);
  },

  async createGroupChat(groupName: string, members: string[], groupAvatar?: string, description?: string): Promise<Chat> {
    console.log('[ChatService] createGroupChat request:', { groupName, members, groupAvatar, description });
    const response = await api.post<ChatResponse>('/chats/group', { groupName, members, groupAvatar, ...(description && { description }) });
    console.log('[ChatService] createGroupChat response:', response.data.chat);
    return normalizeChat(response.data.chat as Record<string, unknown>);
  },

  async addGroupMember(chatId: string, userId: string): Promise<Chat> {
    const response = await api.put<ChatResponse>('/chats/group/add', { chatId, userId });
    return normalizeChat(response.data.chat as Record<string, unknown>);
  },

  async removeGroupMember(chatId: string, userId: string): Promise<Chat> {
    const response = await api.put<ChatResponse>('/chats/group/remove', { chatId, userId });
    return normalizeChat(response.data.chat as Record<string, unknown>);
  },
};
