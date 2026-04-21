import { useState, useEffect, useCallback } from 'react';
import { supabase, fetchProfile, updateProfile, DbProfile } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'donor' | 'organizer';
  bio?: string;
  createdAt: string;
  // Verification
  isVerified: boolean;
  verificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  // Wallet
  walletAddress?: string | null;
}

function dbProfileToUser(profile: DbProfile): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar_url ?? undefined,
    role: profile.role,
    bio: profile.bio ?? undefined,
    createdAt: profile.created_at,
    isVerified: profile.role === 'admin' ? true : (profile.is_verified ?? false),
    verificationStatus: profile.role === 'admin' ? 'approved' : (profile.verification_status ?? 'none'),
    walletAddress: profile.wallet_address ?? null,
  };
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadProfile(session.user);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadProfile(session.user);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (supabaseUser: SupabaseUser) => {
    try {
      const profile = await fetchProfile(supabaseUser.id);
      setUser(dbProfileToUser(profile));
    } catch {
      setUser({
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.name ?? supabaseUser.email?.split('@')[0] ?? 'User',
        email: supabaseUser.email ?? '',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${supabaseUser.email}`,
        role: 'donor',
        createdAt: supabaseUser.created_at,
        isVerified: false,
        verificationStatus: 'none',
      });
    }
  };

  // Expose a manual refresh so components can re-fetch after verification status changes
  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadProfile(session.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.user;
    } catch (err: any) {
      const msg = err.message ?? 'Login failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback`, 
        },
      });
      if (error) throw error;
      return data.user;
    } catch (err: any) {
      const msg = err.message ?? 'Registration failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateUserProfile = useCallback(async (updates: Partial<Pick<User, 'name' | 'bio' | 'avatar'>>) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const dbUpdates: Partial<DbProfile> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
      if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;
      const updated = await updateProfile(user.id, dbUpdates);
      setUser(dbProfileToUser(updated));
      return dbProfileToUser(updated);
    } catch (err: any) {
      setError('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile: updateUserProfile,
    refreshProfile,
    clearError: () => setError(null),
  };
};