import { Socket } from 'socket.io-client';
import { store } from '@/store';
import { ServerEvent, OnlineStatusEvent } from '@/types';
import { setUserOnline } from '@/store/slices/presenceSlice';
import { updateUserInChats, updateMemberOnline } from '@/store/slices/chatSlice';
import { setUser } from '@/store/slices/authSlice';

export function registerPresenceHandlers(socket: Socket): void {
  socket.on(ServerEvent.ONLINE_STATUS, (event: OnlineStatusEvent | OnlineStatusEvent[]) => {
    // Server may send a single object or an array of status updates
    const events = Array.isArray(event) ? event : [event];
    for (const e of events) {
      store.dispatch(setUserOnline({
        userId: e.userId,
        isOnline: e.isOnline,
        lastSeen: e.lastSeen,
      }));
      store.dispatch(updateMemberOnline({
        userId: e.userId,
        isOnline: e.isOnline,
        lastSeen: e.lastSeen,
      }));
    }
  });

  socket.on(ServerEvent.PROFILE_UPDATED, (data: { user: Record<string, unknown> }) => {
    const raw = data.user;
    if (!raw) return;
    const userId = (raw.id || raw._id) as string;
    const name = raw.name as string;
    const avatar = raw.avatar as string | undefined;

    const state = store.getState();
    const currentUser = state.auth.user;

    // If it's the current user, update auth store
    if (currentUser && currentUser.id === userId) {
      store.dispatch(setUser({ ...currentUser, name, avatar }));
    }

    // Update user info in all chats (sidebar, members, chatWith)
    store.dispatch(updateUserInChats({ userId, name, avatar }));
  });
}
