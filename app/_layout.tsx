import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NativeWindStyleSheet } from 'nativewind';
import React, { useEffect, useState } from 'react';

import { setupDeepLinking } from '../src/lib/linking';
import { getCurrentUser, setupAuthListener } from '../src/lib/supabase';

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

NativeWindStyleSheet.setOutput({
  default: 'native',
});

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
    },
  },
});

// Auth Context
interface AuthContextType {
  user: any;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    userData?: { name?: string },
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // In development, first check for dev user
        if (__DEV__) {
          const devUser = await AsyncStorage.getItem('dev_user');
          if (devUser) {
            setUser(JSON.parse(devUser));
            setIsLoading(false);
            return;
          }
        }

        // Check for existing Supabase session
        const user = await getCurrentUser();
        setUser(user);
        setIsLoading(false);
      } catch (error) {
        console.log('Auth initialization error:', error);
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes (Supabase)
    const { data: authListener } = setupAuthListener((user) => {
      setUser(user);
      setIsLoading(false);
    });

    // Set up deep linking for email verification
    const cleanupDeepLinking = setupDeepLinking();

    return () => {
      authListener.subscription.unsubscribe();
      cleanupDeepLinking();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { signInWithEmail } = await import('../src/lib/supabase');
    await signInWithEmail(email, password);
  };

  const signUp = async (
    email: string,
    password: string,
    userData?: { name?: string },
  ) => {
    const { signUpWithEmail } = await import('../src/lib/supabase');
    const result = await signUpWithEmail(email, password, userData);

    // After successful signup, create user profile in our database
    if (result.user && !result.user.email_confirmed_at) {
      // User needs to confirm email - profile will be created after confirmation
      return result;
    }

    if (result.user) {
      // Create user profile immediately if email confirmation is not required
      const { useCreateUserProfile } = await import('../src/lib/api');
      // Note: In production, this should be handled by a webhook or server-side trigger
      // For now, we'll handle it client-side
    }

    return result;
  };

  const signOut = async () => {
    // Clear dev user if in development
    if (__DEV__) {
      await AsyncStorage.removeItem('dev_user');
    }

    // Also sign out from Supabase
    const { signOut: supabaseSignOut } = await import('../src/lib/supabase');
    await supabaseSignOut();

    // Clear user state
    setUser(null);
  };

  const value = {
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function Layout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate loading
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#f8fafc', // bg-slate-50
            },
            headerTintColor: '#1e293b', // text-slate-800
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'My Groups',
              headerLargeTitle: true,
            }}
          />
          <Stack.Screen
            name="groups/[id]/index"
            options={{
              title: 'Group Details',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="groups/[id]/add-expense"
            options={{
              title: 'Add Expense',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="auth/sign-in"
            options={{
              title: 'Sign In',
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="auth/sign-up"
            options={{
              title: 'Sign Up',
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="auth/reset-password"
            options={{
              title: 'Reset Password',
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="auth/dev-sign-in"
            options={{
              title: 'Development Sign In',
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="auth/verify"
            options={{
              title: 'Email Verification',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="auth/update-password"
            options={{
              title: 'Update Password',
              headerShown: false,
            }}
          />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
