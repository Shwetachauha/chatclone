import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Chat, LatestMessage } from '@/types';
import { chatService } from '@/services/chatService';
import { MOCK_MODE } from '@/mocks/config';
import { mockChats } from '@/mocks/mockData';

interface ChatSliceState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ChatSliceState = {
  chats: MOCK_MODE ? mockChats : [],
  activeChat: null,
  isLoading: false,
  error: null,
};

export const fetchChats = createAsyncThunk(
  'chat/fetchChats',
  async (_, { rejectWithValue, getState }) => {
    try {
      const chats = await chatService.getChats();
      const currentUserId = (getState() as { auth: { user: { id: string } | null } }).auth.user?.id;
      // Derive chatWith from members for private chats if not set
      return chats.map((chat) => {
        if (!chat.isGroupChat && (!chat.chatWith || !chat.chatWith.name) && chat.members.length > 0 && currentUserId) {
          const other = chat.members.find((m) => m.id !== currentUserId) || chat.members[0];
          return { ...chat, chatWith: other };
        }
        return chat;
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch chats');
    }
  }
);

export const createPrivateChat = createAsyncThunk(
  'chat/createPrivate',
  async (data: { userId: string; user: { id: string; name: string; avatar?: string; email?: string } }, { rejectWithValue, getState }) => {
    try {
      const chat = await chatService.createPrivateChat(data.userId);
      // Ensure chatWith is populated (some backends don't return it on create)
      if (!chat.chatWith || !chat.chatWith.name) {
        const currentUserId = (getState() as { auth: { user: { id: string } | null } }).auth.user?.id;
        // Try to derive from members first
        const otherMember = chat.members?.find((m) => m.id !== currentUserId);
        chat.chatWith = otherMember || {
          id: data.user.id,
          name: data.user.name,
          avatar: data.user.avatar,
          email: data.user.email,
        };
      }
      return chat;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to create chat');
    }
  }
);

export const createGroupChat = createAsyncThunk(
  'chat/createGroup',
  async (data: { groupName: string; members: string[]; groupAvatar?: string }, { rejectWithValue }) => {
    try {
      return await chatService.createGroupChat(data.groupName, data.members, data.groupAvatar);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to create group');
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChat(state, action: PayloadAction<Chat | null>) {
      state.activeChat = action.payload;
    },
    updateLastMessage(state, action: PayloadAction<{ chatId: string; latestMessage: LatestMessage }>) {
      const chat = state.chats.find((c) => c.id === action.payload.chatId);
      if (chat) {
        chat.latestMessage = action.payload.latestMessage;
        chat.updatedAt = new Date().toISOString();
      }
    },
    incrementUnread(state, action: PayloadAction<string>) {
      const chat = state.chats.find((c) => c.id === action.payload);
      if (chat) {
        chat.unreadCount += 1;
      }
    },
    resetUnread(state, action: PayloadAction<string>) {
      const chat = state.chats.find((c) => c.id === action.payload);
      if (chat) {
        chat.unreadCount = 0;
      }
    },
    addChat(state, action: PayloadAction<Chat>) {
      const exists = state.chats.find((c) => c.id === action.payload.id);
      if (!exists) {
        state.chats.unshift(action.payload);
      }
    },
    updateChatMembers(state, action: PayloadAction<{ chatId: string; members: Chat['members'] }>) {
      const chat = state.chats.find((c) => c.id === action.payload.chatId);
      if (chat) {
        chat.members = action.payload.members;
      }
    },
    sortChats(state) {
      state.chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    },
    updateChat(state, action: PayloadAction<Chat>) {
      const index = state.chats.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.chats[index] = { ...state.chats[index], ...action.payload };
      }
      if (state.activeChat?.id === action.payload.id) {
        state.activeChat = { ...state.activeChat, ...action.payload };
      }
    },
    updateUserInChats(state, action: PayloadAction<{ userId: string; name: string; avatar?: string }>) {
      const { userId, name, avatar } = action.payload;
      for (const chat of state.chats) {
        // Update chatWith
        if (chat.chatWith?.id === userId) {
          chat.chatWith.name = name;
          if (avatar !== undefined) chat.chatWith.avatar = avatar;
        }
        // Update members
        const member = chat.members.find((m) => m.id === userId);
        if (member) {
          member.name = name;
          if (avatar !== undefined) member.avatar = avatar;
        }
      }
      // Update active chat
      if (state.activeChat) {
        if (state.activeChat.chatWith?.id === userId) {
          state.activeChat.chatWith.name = name;
          if (avatar !== undefined) state.activeChat.chatWith.avatar = avatar;
        }
        const activeMember = state.activeChat.members.find((m) => m.id === userId);
        if (activeMember) {
          activeMember.name = name;
          if (avatar !== undefined) activeMember.avatar = avatar;
        }
      }
    },
    removeChat(state, action: PayloadAction<string>) {
      state.chats = state.chats.filter((c) => c.id !== action.payload);
      if (state.activeChat?.id === action.payload) {
        state.activeChat = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.chats = action.payload;
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createPrivateChat.fulfilled, (state, action) => {
        const exists = state.chats.find((c) => c.id === action.payload.id);
        if (!exists) {
          state.chats.unshift(action.payload);
        }
        state.activeChat = action.payload;
      })
      .addCase(createGroupChat.fulfilled, (state, action) => {
        state.chats.unshift(action.payload);
        state.activeChat = action.payload;
      });
  },
});

export const {
  setActiveChat,
  updateLastMessage,
  incrementUnread,
  resetUnread,
  addChat,
  updateChatMembers,
  updateUserInChats,
  sortChats,
  updateChat,
  removeChat,
} = chatSlice.actions;
export default chatSlice.reducer;
