import api from './api';
import { LoginCredentials, RegisterCredentials, User } from '@/types';

interface AuthResponse {
  message: string;
  accessToken: string;
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

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ message: string; accessToken: string; user: User }> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return {
      message: response.data.message,
      accessToken: response.data.accessToken,
      user: normalizeUser(response.data.user as Record<string, unknown>),
    };
  },

  async register(credentials: RegisterCredentials): Promise<{ message: string; accessToken: string; user: User }> {
    const { name, email, password } = credentials;
    const response = await api.post<AuthResponse>('/auth/signup', { name, email, password });
    return {
      message: response.data.message,
      accessToken: response.data.accessToken,
      user: normalizeUser(response.data.user as Record<string, unknown>),
    };
  },

  async refreshToken(): Promise<{ accessToken: string }> {
    const response = await api.post<{ accessToken: string }>('/auth/refresh-token');
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const response = await api.get<{ user: unknown }>('/users/profile');
    return normalizeUser(response.data.user as Record<string, unknown>);
  },
};
