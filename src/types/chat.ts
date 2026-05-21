export interface ChatMember {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: string | null;
}

export interface LatestMessage {
  content: string;
  type: MessageType;
  sender: { name: string; avatar?: string };
  createdAt: string;
}

export interface Chat {
  id: string;
  isGroupChat: boolean;
  chatWith: ChatMember | null;
  groupName: string | null;
  groupDescription?: string;
  groupAvatar?: string;
  groupAdmin: { id: string; name: string } | null;
  members: ChatMember[];
  latestMessage: LatestMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessagePreview {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  type: MessageType;
}

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';

export interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoading: boolean;
  error: string | null;
}
