import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '../../src/lib/api';
import { resetPassword } from '../../src/lib/supabase';

const ResetPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setIsSuccess(true);
    } catch (error) {
      Alert.alert('Reset Failed', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <Stack.Screen
          options={{
            title: 'Check Your Email',
          }}
        />

        <View className="flex-1 justify-center px-6 py-8">
          <View className="mb-8 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Ionicons name="mail-outline" size={32} color="#16a34a" />
            </View>
            <Text className="mb-2 text-3xl font-bold text-gray-900">
              Check Your Email
            </Text>
            <Text className="mb-6 text-center text-gray-600">
              We've sent a password reset link to {email}. Please check your
              email and follow the instructions to reset your password.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.replace('/auth/sign-in')}
            className="mb-4 rounded-lg bg-blue-600 py-4"
          >
            <Text className="text-center text-lg font-semibold text-white">
              Back to Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsSuccess(false)}
            className="py-2"
          >
            <Text className="text-center font-medium text-blue-600">
              Try a different email
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Reset Password',
          headerBackTitle: 'Back',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="mb-8 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <Ionicons name="key-outline" size={32} color="#ea580c" />
            </View>
            <Text className="mb-2 text-3xl font-bold text-gray-900">
              Reset Password
            </Text>
            <Text className="text-center text-gray-600">
              Enter your email address and we'll send you a link to reset your
              password
            </Text>
          </View>

          {/* Form */}
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
              editable={!isLoading}
            />
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            onPress={handleResetPassword}
            disabled={isLoading}
            className={`mb-6 rounded-lg py-4 ${
              isLoading ? 'bg-blue-400' : 'bg-blue-600'
            }`}
          >
            <Text className="text-center text-lg font-semibold text-white">
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>

          {/* Back to Sign In */}
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={isLoading}
            className="py-2"
          >
            <Text className="text-center font-medium text-blue-600">
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;
