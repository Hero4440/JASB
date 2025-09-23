import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { logger, LogCategory } from './logger';

// Supabase configuration
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configure auth persistence based on platform
    storage:
      Platform.OS === 'web'
        ? undefined
        : require('@react-native-async-storage/async-storage').default,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper function to get current user
export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

// Helper function to get auth token
export const getAuthToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token;
};

// Auth state change listener setup
export const setupAuthListener = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string) => {
  logger.info(LogCategory.AUTH, 'Attempting email sign in', { email });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.auth({
        action: 'sign_in',
        email,
        method: 'email',
        success: false,
        error: error.message,
      });
      throw error;
    }

    logger.auth({
      action: 'sign_in',
      email,
      userId: data.user?.id,
      method: 'email',
      success: true,
    });

    return data;
  } catch (error) {
    logger.error(
      LogCategory.AUTH,
      'Sign in failed',
      error as Error,
      { email }
    );
    throw error;
  }
};

// Sign up with email and password
export const signUpWithEmail = async (
  email: string,
  password: string,
  userData?: { name?: string },
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData,
    },
  });

  if (error) throw error;
  return data;
};

// Sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Reset password
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};
