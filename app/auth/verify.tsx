import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCreateUserProfile } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';

const VerifyScreen = () => {
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');
  const createUserProfile = useCreateUserProfile();

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        const { token, type } = params;

        if (!token || !type) {
          setStatus('error');
          setMessage('Invalid verification link');
          return;
        }

        if (type === 'signup') {
          // Handle email verification
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token as string,
            type: 'signup',
          });

          if (error) {
            setStatus('error');
            setMessage(error.message);
            return;
          }

          if (data.user) {
            // Create user profile in our database
            try {
              await createUserProfile.mutateAsync({
                id: data.user.id,
                email: data.user.email!,
                name:
                  data.user.user_metadata?.name ||
                  data.user.email!.split('@')[0],
                avatar_url: data.user.user_metadata?.avatar_url,
              });
            } catch (profileError) {
              // Profile creation failed, but user is still verified
              console.warn('Profile creation error:', profileError);
            }

            setStatus('success');
            setMessage('Your account has been verified! You can now sign in.');

            // Redirect to main app after a delay
            setTimeout(() => {
              router.replace('/');
            }, 3000);
          }
        } else if (type === 'recovery') {
          // Handle password reset
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token as string,
            type: 'recovery',
          });

          if (error) {
            setStatus('error');
            setMessage(error.message);
            return;
          }

          setStatus('success');
          setMessage(
            'Password reset verified! You can now set a new password.',
          );

          // Redirect to password update screen
          setTimeout(() => {
            router.replace('/auth/update-password');
          }, 2000);
        }
      } catch (error) {
        setStatus('error');
        setMessage(
          error instanceof Error ? error.message : 'Verification failed',
        );
      }
    };

    handleEmailVerification();
  }, [params, createUserProfile]);

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return { name: 'hourglass-outline' as const, color: '#6b7280' };
      case 'success':
        return { name: 'checkmark-circle-outline' as const, color: '#16a34a' };
      case 'error':
        return { name: 'alert-circle-outline' as const, color: '#ef4444' };
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'loading':
        return 'Verifying...';
      case 'success':
        return 'Verification Successful!';
      case 'error':
        return 'Verification Failed';
    }
  };

  const icon = getIcon();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Email Verification',
          headerShown: false,
        }}
      />

      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center">
          <View
            className={`mb-6 h-20 w-20 items-center justify-center rounded-full ${
              status === 'loading'
                ? 'bg-gray-100'
                : status === 'success'
                ? 'bg-green-100'
                : 'bg-red-100'
            }`}
          >
            <Ionicons name={icon.name} size={40} color={icon.color} />
          </View>

          <Text className="mb-4 text-center text-2xl font-bold text-gray-900">
            {getTitle()}
          </Text>

          <Text className="text-center text-lg leading-6 text-gray-600">
            {message}
          </Text>

          {status === 'success' && (
            <View className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <Text className="text-center text-sm text-green-800">
                Redirecting you to the app...
              </Text>
            </View>
          )}

          {status === 'loading' && (
            <View className="mt-6 rounded-lg bg-gray-50 p-4">
              <Text className="text-center text-sm text-gray-600">
                Please wait while we verify your email address.
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default VerifyScreen;
