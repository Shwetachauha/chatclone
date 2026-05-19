import api from './api';
import { User } from '@/types';

interface UsersResponse {
  users: unknown[];
}

interface UserResponse {
  user: unknown;
}

function normalizeUser(raw: Record<string, unknown>): User {
  return {
    id: (raw.id || raw._id) as string,
    name: raw.name as string,
    email: raw.email as string,
    avatar: raw.avatar as string | undefined,
    bio: raw.bio as string | undefined,
    isOnline: raw.isOnline as boolean | undefined,
    lastSeen: raw.lastSeen as string | null | undefined,
    createdAt: raw.createdAt as string | undefined,
  };
}

export const userService = {
  async searchUsers(query: string): Promise<User[]> {
    const response = await api.get<UsersResponse>(`/users/search?q=${encodeURIComponent(query)}`);
    return (response.data.users || []).map((u) => normalizeUser(u as Record<string, unknown>));
  },

  async getProfile(): Promise<User> {
    const response = await api.get<UserResponse>('/users/profile');
    return normalizeUser(response.data.user as Record<string, unknown>);
  },

  async updateProfile(data: { name?: string; avatar?: string; bio?: string }): Promise<User> {
    const response = await api.put<UserResponse>('/users/profile', data);
    return normalizeUser(response.data.user as Record<string, unknown>);
  },
};
