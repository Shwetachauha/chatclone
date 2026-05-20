import { io, Socket } from 'socket.io-client';
import { store } from '@/store';
import { ServerEvent } from '@/types';
import { setConnected, setReconnecting, addToast } from '@/store/slices/uiSlice';
import { registerMessageHandlers } from './handlers/messageHandlers';
import { registerPresenceHandlers } from './handlers/presenceHandlers';
import { registerTypingHandlers } from './handlers/typingHandlers';
import { registerGroupHandlers } from './handlers/groupHandlers';
import { registerCallHandlers } from './handlers/callHandlers';
import { v4 as uuidv4 } from 'uuid';

class SocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private currentChatId: string | null = null;
  private joinedChatIds: string[] = [];

  connect(token: string): void {
    if (this.socket?.connected) {
      console.log('[Socket] Already connected, skipping');
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    console.log('[Socket] Connecting to:', socketUrl);

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    // Catch-all listener for debugging
    this.socket.onAny((event, ...args) => {
      console.log('[Socket] Event:', event, args);
    });

    this.setupConnectionHandlers();
    this.registerEventHandlers();
  }

  private setupConnectionHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected, id:', this.socket?.id);
      store.dispatch(setConnected(true));
      store.dispatch(setReconnecting(false));
      this.reconnectAttempts = 0;

      // Rejoin all chat rooms on reconnect
      if (this.joinedChatIds.length > 0) {
        this.joinAllChats(this.joinedChatIds);
      }
      if (this.currentChatId) {
        this.joinChat(this.currentChatId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected, reason:', reason);
      store.dispatch(setConnected(false));
      if (reason === 'io server disconnect') {
        // Server forced disconnect - likely auth failure
        store.dispatch(addToast({
          id: uuidv4(),
          message: 'Disconnected from server. Please re-login.',
          type: 'error',
        }));
      }
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      store.dispatch(setReconnecting(true));

      if (error.message === 'Authentication error') {
        store.dispatch(addToast({
          id: uuidv4(),
          message: 'Authentication failed. Please re-login.',
          type: 'error',
        }));
        this.disconnect();
      }
    });

    this.socket.on('reconnect_attempt', () => {
      store.dispatch(setReconnecting(true));
    });

    this.socket.on('reconnect', () => {
      store.dispatch(setConnected(true));
      store.dispatch(setReconnecting(false));
    });

    this.socket.on(ServerEvent.ERROR, (error: { message: string }) => {
      store.dispatch(addToast({
        id: uuidv4(),
        message: error.message || 'Socket error occurred',
        type: 'error',
      }));
    });
  }

  private registerEventHandlers(): void {
    if (!this.socket) return;
    registerMessageHandlers(this.socket);
    registerPresenceHandlers(this.socket);
    registerTypingHandlers(this.socket);
    registerGroupHandlers(this.socket);
    registerCallHandlers(this.socket);
  }

  joinChat(chatId: string): void {
    if (!this.socket?.connected) {
      console.log('[Socket] joinChat failed - not connected, chatId:', chatId);
      return;
    }
    this.currentChatId = chatId;
    console.log('[Socket] Joining chat:', chatId);
    this.socket.emit('join_chat', chatId);
  }

  leaveChat(chatId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('leave_chat', chatId);
    if (this.currentChatId === chatId) {
      this.currentChatId = null;
    }
  }

  /** Join multiple chat rooms at once (for receiving messages on sidebar) */
  joinAllChats(chatIds: string[]): void {
    if (!this.socket?.connected) {
      console.log('[Socket] joinAllChats failed - not connected');
      return;
    }
    this.joinedChatIds = chatIds;
    console.log('[Socket] Joining all chats:', chatIds.length);
    for (const chatId of chatIds) {
      this.socket.emit('join_chat', chatId);
    }
  }

  emit(event: string, data?: unknown): void {
    if (!this.socket?.connected) return;
    this.socket.emit(event, data);
  }

  emitWithAck(event: string, data?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }
      this.socket.emit(event, data, (response: unknown) => {
        resolve(response);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.currentChatId = null;
      store.dispatch(setConnected(false));
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getCurrentChatId(): string | null {
    return this.currentChatId;
  }
}

export const socketManager = new SocketManager();
