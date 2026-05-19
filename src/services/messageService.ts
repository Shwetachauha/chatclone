import api from './api';
import { Message, PaginationParams } from '@/types';

interface MessagesResponse {
  messages: unknown[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface SendMessageResponse {
  message: unknown;
}

// Normalize server message format (_id → id, chat → chatId, sender._id → sender.id)
function normalizeMessage(raw: Record<string, unknown>): Message {
  const rawSender = raw.sender as Record<string, unknown> | undefined;
  return {
    ...(raw as unknown as Message),
    id: (raw.id || raw._id) as string,
    chatId: (raw.chatId || raw.chat) as string,
    sender: rawSender
      ? {
          id: (rawSender.id || rawSender._id) as string,
          name: rawSender.name as string,
          avatar: rawSender.avatar as string | undefined,
        }
      : (raw.sender as unknown as Message['sender']),
  };
}

export const messageService = {
  async getMessages(params: PaginationParams): Promise<{ messages: Message[]; hasMore: boolean; cursor: string | null }> {
    const { chatId, cursor, limit = 50 } = params;
    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (cursor) queryParams.append('cursor', cursor);

    const response = await api.get<MessagesResponse>(
      `/messages/${chatId}?${queryParams.toString()}`
    );
    return {
      messages: (response.data.messages || []).map((m) => normalizeMessage(m as Record<string, unknown>)),
      hasMore: response.data.hasMore,
      cursor: response.data.nextCursor,
    };
  },

  async sendMessage(formData: FormData, onProgress?: (progress: number) => void): Promise<Message> {
    const response = await api.post<SendMessageResponse>('/messages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(pct);
        }
      },
    });
    return normalizeMessage(response.data.message as Record<string, unknown>);
  },

  async markRead(chatId: string): Promise<void> {
    await api.put(`/messages/read/${chatId}`);
  },

  async deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/messages/${messageId}`);
  },
};
