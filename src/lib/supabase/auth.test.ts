import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithOAuth = vi
  .fn()
  .mockResolvedValue({ data: { url: 'https://oauth.test' }, error: null });
const mockSignUp = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
const mockSignInWithPassword = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
const mockUpdateUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockGetSession = vi
  .fn()
  .mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
const mockGetUser = vi
  .fn()
  .mockResolvedValue({ data: { user: { id: 'user-1', email: 'test@example.com' } }, error: null });
const mockFromSelect = vi.fn().mockReturnThis();
const mockFromEq = vi.fn().mockReturnThis();
const mockFromSingle = vi
  .fn()
  .mockResolvedValue({ data: { email: 'test@example.com' }, error: null });

vi.mock('./client', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: mockFromSelect,
      eq: mockFromEq,
      single: mockFromSingle,
    })),
  })),
}));

// Mock window.location
vi.stubGlobal('window', {
  location: { origin: 'https://example.com' },
});

import {
  signInWithGoogle,
  signInWithGitHub,
  signUpWithEmail,
  signInWithEmail,
  resetPassword,
  updatePassword,
  updateEmail,
  signOut,
  getSession,
  getUser,
  isAuthenticated,
  isAdmin,
} from './auth';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@example.com' } },
    error: null,
  });
  mockFromSelect.mockReturnThis();
  mockFromEq.mockReturnThis();
  mockFromSingle.mockResolvedValue({ data: { email: 'test@example.com' }, error: null });
});

describe('signInWithGoogle', () => {
  it('should call signInWithOAuth with google provider', async () => {
    await signInWithGoogle();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    );
  });

  it('should include redirect URL', async () => {
    await signInWithGoogle();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: 'https://example.com/api/auth/callback',
        }),
      })
    );
  });

  it('should throw on error', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: null, error: new Error('OAuth failed') });
    await expect(signInWithGoogle()).rejects.toThrow('OAuth failed');
  });
});

describe('signInWithGitHub', () => {
  it('should call signInWithOAuth with github provider', async () => {
    await signInWithGitHub();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'github' })
    );
  });

  it('should throw on error', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: null, error: new Error('GitHub failed') });
    await expect(signInWithGitHub()).rejects.toThrow('GitHub failed');
  });
});

describe('signUpWithEmail', () => {
  it('should call signUp with email and password', async () => {
    await signUpWithEmail('test@example.com', 'password123');
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        password: 'password123',
      })
    );
  });

  it('should pass metadata', async () => {
    await signUpWithEmail('test@example.com', 'password123', {
      full_name: 'John Doe',
      role: 'student',
    });
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: { full_name: 'John Doe', role: 'student' },
        }),
      })
    );
  });

  it('should throw on error', async () => {
    mockSignUp.mockResolvedValueOnce({ data: null, error: new Error('Signup failed') });
    await expect(signUpWithEmail('test@example.com', 'pwd')).rejects.toThrow('Signup failed');
  });
});

describe('signInWithEmail', () => {
  it('should call signInWithPassword', async () => {
    await signInWithEmail('test@example.com', 'password123');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should throw on error', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: null, error: new Error('Invalid') });
    await expect(signInWithEmail('test@example.com', 'wrong')).rejects.toThrow('Invalid');
  });
});

describe('resetPassword', () => {
  it('should call resetPasswordForEmail', async () => {
    await resetPassword('test@example.com');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', expect.any(Object));
  });

  it('should throw on error', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: new Error('Reset failed'),
    });
    await expect(resetPassword('bad@example.com')).rejects.toThrow('Reset failed');
  });
});

describe('updatePassword', () => {
  it('should call updateUser with new password', async () => {
    await updatePassword('newPassword123');
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newPassword123' });
  });
});

describe('updateEmail', () => {
  it('should call updateUser with new email', async () => {
    await updateEmail('new@example.com');
    expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'new@example.com' });
  });
});

describe('signOut', () => {
  it('should call auth.signOut', async () => {
    await signOut();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should throw on error', async () => {
    mockSignOut.mockResolvedValueOnce({ error: new Error('Signout failed') });
    await expect(signOut()).rejects.toThrow('Signout failed');
  });
});

describe('getSession', () => {
  it('should return session data', async () => {
    const session = await getSession();
    expect(session).toBeDefined();
  });

  it('should throw on error', async () => {
    mockGetSession.mockResolvedValueOnce({ data: {}, error: new Error('Session error') });
    await expect(getSession()).rejects.toThrow('Session error');
  });
});

describe('getUser', () => {
  it('should return user data', async () => {
    const user = await getUser();
    expect(user).toBeDefined();
    expect(user?.id).toBe('user-1');
  });
});

describe('isAuthenticated', () => {
  it('should return true when session exists', async () => {
    const result = await isAuthenticated();
    expect(result).toBe(true);
  });

  it('should return false when no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const result = await isAuthenticated();
    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    mockGetSession.mockResolvedValueOnce({ data: {}, error: new Error('Error') });
    const result = await isAuthenticated();
    expect(result).toBe(false);
  });
});

describe('isAdmin', () => {
  it('should return true for admin users', async () => {
    const result = await isAdmin();
    expect(result).toBe(true);
  });

  it('should return false for non-admin users', async () => {
    mockFromSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await isAdmin();
    expect(result).toBe(false);
  });

  it('should return false when user not found', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const result = await isAdmin();
    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    mockGetUser.mockResolvedValueOnce({ data: {}, error: new Error('Error') });
    const result = await isAdmin();
    expect(result).toBe(false);
  });
});
