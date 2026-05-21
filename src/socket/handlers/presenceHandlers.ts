import { Socket } from 'socket.io-client';
import { store } from '@/store';
import { ServerEvent, OnlineStatusEvent } from '@/types';
import { setUserOnline } from '@/store/slices/presenceSlice';
import { updateUserInChats, updateMemberOnline } from '@/store/slices/chatSlice';
import { setUser } from '@/store/slices/authSlice';

// Debounce offline status to avoid flickering
const offlineTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const OFFLINE_DELAY = 5000; // 5 seconds before marking offline

export function registerPresenceHandlers(socket: Socket): void {
  socket.on(ServerEvent.ONLINE_STATUS, (event: OnlineStatusEvent | OnlineStatusEvent[]) => {
    const events = Array.isArray(event) ? event : [event];
    for (const e of events) {
      if (e.isOnline) {
        // User came online — clear any pending offline timer and update immediately
        if (offlineTimers[e.userId]) {
          clearTimeout(offlineTimers[e.userId]);
          delete offlineTimers[e.userId];
        }
        store.dispatch(setUserOnline({
          userId: e.userId,
          isOnline: true,
          lastSeen: e.lastSeen,
        }));
        store.dispatch(updateMemberOnline({
          userId: e.userId,
          isOnline: true,
          lastSeen: e.lastSeen,
        }));
      } else {
        // User went offline — delay the update to avoid flicker on reconnect
        if (offlineTimers[e.userId]) {
          clearTimeout(offlineTimers[e.userId]);
        }
        offlineTimers[e.userId] = setTimeout(() => {
          delete offlineTimers[e.userId];
          store.dispatch(setUserOnline({
            userId: e.userId,
            isOnline: false,
            lastSeen: e.lastSeen,
          }));
          store.dispatch(updateMemberOnline({
            userId: e.userId,
            isOnline: false,
            lastSeen: e.lastSeen,
          }));
        }, OFFLINE_DELAY);
      }
    }
  });

  socket.on(ServerEvent.PROFILE_UPDATED, (data: { user: Record<string, unknown> }) => {
    const raw = data.user;
    if (!raw) return;
    const userId = (raw.id || raw._id) as string;
    const name = raw.name as string;
    const avatar = raw.avatar as string | undefined;
    const bio = raw.bio as string | undefined;

    const state = store.getState();
    const currentUser = state.auth.user;

    // If it's the current user, update auth store
    if (currentUser && currentUser.id === userId) {
      store.dispatch(setUser({ ...currentUser, name, avatar }));
    }

    // Update user info in all chats (sidebar, members, chatWith)
    store.dispatch(updateUserInChats({ userId, name, avatar, bio }));
  });
}
