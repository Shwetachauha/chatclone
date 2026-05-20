import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, LoginCredentials, RegisterCredentials, User } from '@/types';
import { authService } from '@/services/authService';
import { MOCK_MODE } from '@/mocks/config';
import { mockUser } from '@/mocks/mockData';

// Persist/restore auth from localStorage
function loadAuthFromStorage(): { user: User | null; accessToken: string | null } {
  try {
    const stored = localStorage.getItem('auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { user: parsed.user || null, accessToken: parsed.accessToken || null };
    }
  } catch {
    // corrupted storage
  }
  return { user: null, accessToken: null };
}

function saveAuthToStorage(user: User | null, accessToken: string | null) {
  if (user && accessToken) {
    localStorage.setItem('auth', JSON.stringify({ user, accessToken }));
  } else {
    localStorage.removeItem('auth');
  }
}

const persisted = MOCK_MODE ? { user: mockUser, accessToken: 'mock-token' } : loadAuthFromStorage();

const initialState: AuthState = {
  user: persisted.user,
  accessToken: persisted.accessToken,
  isAuthenticated: !!(persisted.user && persisted.accessToken),
  isLoading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (credentials: RegisterCredentials, { rejectWithValue }) => {
    try {
      const response = await authService.register(credentials);
      return response;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Registration failed');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.refreshToken();
      return response;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Token refresh failed');
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      saveAuthToStorage(state.user, action.payload);
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      saveAuthToStorage(action.payload, state.accessToken);
    },
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.error = null;
      saveAuthToStorage(null, null);
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        saveAuthToStorage(action.payload.user, action.payload.accessToken);
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.isAuthenticated = true;
        saveAuthToStorage(state.user, action.payload.accessToken);
      })
      .addCase(refreshToken.rejected, (state, action) => {
        // Only clear auth if the error indicates token is truly invalid
        // Network errors should NOT log out the user
        const payload = action.payload as string | undefined;
        if (payload?.includes('401') || payload?.includes('403') || payload?.includes('expired') || payload?.includes('invalid')) {
          state.user = null;
          state.accessToken = null;
          state.isAuthenticated = false;
          saveAuthToStorage(null, null);
        }
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
        saveAuthToStorage(null, null);
      });
  },
});

export const { setAccessToken, setUser, clearAuth, clearError } = authSlice.actions;
export default authSlice.reducer;
