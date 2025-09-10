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
import { useAuth } from '../_layout';

const SignInScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/');
    } catch (error) {
      Alert.alert('Sign In Failed', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToSignUp = () => {
    router.push('/auth/sign-up');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Sign In',
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
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Ionicons name="wallet-outline" size={32} color="#2563eb" />
            </View>
            <Text className="mb-2 text-3xl font-bold text-gray-900">
              Welcome Back
            </Text>
            <Text className="text-center text-gray-600">
              Sign in to your JASB account to continue splitting expenses
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

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Password
            </Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 pr-12 text-gray-900"
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3"
                disabled={isLoading}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            onPress={handleSignIn}
            disabled={isLoading}
            className={`mb-4 rounded-lg py-4 ${
              isLoading ? 'bg-blue-400' : 'bg-blue-600'
            }`}
          >
            <Text className="text-center text-lg font-semibold text-white">
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push('/auth/reset-password')}
            className="mb-6"
            disabled={isLoading}
          >
            <Text className="text-center font-medium text-blue-600">
              Forgot your password?
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="mb-6 flex-row items-center">
            <View className="h-px flex-1 bg-gray-300" />
            <Text className="px-4 text-sm text-gray-500">or</Text>
            <View className="h-px flex-1 bg-gray-300" />
          </View>

          {/* Sign Up Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-600">Don't have an account? </Text>
            <TouchableOpacity onPress={navigateToSignUp} disabled={isLoading}>
              <Text className="font-medium text-blue-600">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignInScreen;
