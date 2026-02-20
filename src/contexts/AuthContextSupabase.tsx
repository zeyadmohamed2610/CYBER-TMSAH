import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, Database, Tables } from '@/config/supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'doctor' | 'student' | null;

export interface UserProfile extends Tables<'users'> {
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, studentId?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: { name?: string; studentId?: string }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
      
      return data as UserProfile;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
        
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        setUserProfile(profile);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        }
        throw error;
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        
        if (profile?.locked_until && new Date(profile.locked_until) > new Date()) {
          await supabase.auth.signOut();
          throw new Error('Account is locked. Please try again later.');
        }
        
        setUserProfile(profile);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to login';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile]);

  const register = useCallback(async (email: string, password: string, name: string, studentId?: string) => {
    setError(null);
    setLoading(true);

    try {
      // First sign up the user in Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            student_id: studentId,
            role: 'student'
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('This email is already registered');
        }
        throw error;
      }

      if (data.user) {
        // Create user profile in public.users table
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: email,
            name: name,
            role: 'student',
            student_id: studentId || null,
            failed_login_attempts: 0
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Continue anyway - profile might already exist
        }

        const profile = await fetchUserProfile(data.user.id);
        setUserProfile(profile);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create account';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserProfile(null);
    } catch (err: any) {
      setError(err.message || 'Failed to logout');
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
      throw err;
    }
  }, []);

  const updateProfileData = useCallback(async (data: { name?: string; studentId?: string }) => {
    if (!user) return;
    
    try {
      const updateData: Record<string, any> = {};
      
      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      
      if (data.studentId !== undefined) {
        updateData.student_id = data.studentId;
      }
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);
      
      if (error) throw error;
      
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      throw err;
    }
  }, [user, fetchUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    }
  }, [user, fetchUserProfile]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    userProfile,
    role: userProfile?.role || null,
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
    updateProfile: updateProfileData,
    refreshProfile,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
