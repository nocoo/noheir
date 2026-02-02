import { describe, expect, it, mock, vi } from 'bun:test';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();

describe('AuthContext', () => {
  const setup = async () => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost', href: '' },
      writable: true,
    });

    mock.module('../../src/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: mockGetSession,
          onAuthStateChange: mockOnAuthStateChange,
          signInWithOAuth: mockSignInWithOAuth,
          signOut: mockSignOut,
        },
      },
    }));

    return await import(`../../src/contexts/AuthContext?test=${Date.now()}`);
  };

  it('initializes session from supabase', async () => {
    const { AuthProvider, useAuth } = await setup();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.user).toBeTruthy();
    expect(result.current.loading).toBe(false);
  });

  it('signs out via supabase', async () => {
    const { AuthProvider, useAuth } = await setup();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockSignOut.mockResolvedValue({ error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signs in with google and redirects', async () => {
    const { AuthProvider, useAuth } = await setup();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'http://redirect' }, error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(window.location.href).toBe('http://redirect');
  });
});
