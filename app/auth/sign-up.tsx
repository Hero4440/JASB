import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../_layout';
import { getErrorMessage } from '../../src/lib/api';
import { logger } from '../../src/lib/logger';

const SignUpScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp } = useAuth();

  const handleDevSignUp = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'Please enter your name and email');
      return;
    }

    setIsLoading(true);
    logger.userAction('Development signup attempted', { email: email.trim() });

    try {
      // Create mock user data for development
      const mockUser = {
        id: `dev_${Date.now()}`,
        email: email.trim().toLowerCase(),
        user_metadata: {
          name: name.trim(),
        },
      };

      // Store in async storage to simulate authentication
      await AsyncStorage.setItem('dev_user', JSON.stringify(mockUser));

      logger.auth({
        action: 'sign_up',
        email: mockUser.email,
        userId: mockUser.id,
        method: 'dev_bypass',
        success: true,
      });

      Alert.alert(
        'Account Created!',
        'Development account created successfully. You are now signed in.',
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (error) {
      logger.auth({
        action: 'sign_up',
        email: email.trim(),
        method: 'dev_bypass',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      Alert.alert('Error', 'Failed to create development account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    logger.userAction('Production signup attempted', { email: email.trim() });

    try {
      await signUp(email.trim().toLowerCase(), password, {
        name: name.trim(),
      });

      logger.auth({
        action: 'sign_up',
        email: email.trim(),
        method: 'email',
        success: true,
      });

      Alert.alert(
        'Check Your Email',
        'We sent you a confirmation link. Please check your email and click the link to verify your account.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth/sign-in'),
          },
        ]
      );
    } catch (error) {
      logger.auth({
        action: 'sign_up',
        email: email.trim(),
        method: 'email',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Show different options based on the error
      const errorMessage = getErrorMessage(error);
      const isNetworkError = errorMessage.includes('Network request failed') ||
                            errorMessage.includes('fetch');

      if (isNetworkError && __DEV__) {
        Alert.alert(
          'Sign Up Failed',
          'Network connection failed. Would you like to create a development account instead?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Create Dev Account',
              onPress: handleDevSignUp,
            },
          ]
        );
      } else {
        Alert.alert('Sign Up Failed', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToSignIn = () => {
    router.replace('/auth/sign-in');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen 
        options={{
          title: 'Create Account',
          headerBackTitle: 'Back',
        }}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="person-add-outline" size={32} color="#2563eb" />
            </View>
            <Text className="text-3xl font-bold text-gray-900 mb-2">Join JASB</Text>
            <Text className="text-gray-600 text-center">
              Create your account to start splitting expenses with friends
            </Text>
          </View>

          {/* Form */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              autoCapitalize="words"
              autoComplete="name"
              className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
              editable={!isLoading}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
              editable={!isLoading}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password (min 6 characters)"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-900"
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

          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">Confirm Password</Text>
            <View className="relative">
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
                className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-900"
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3"
                disabled={isLoading}
              >
                <Ionicons 
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color="#6b7280" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Development Quick Signup (Development Mode Only) */}
          {__DEV__ && (
            <TouchableOpacity
              onPress={handleDevSignUp}
              disabled={isLoading}
              className={`rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 py-4 mb-4 ${
                isLoading ? 'opacity-50' : ''
              }`}
            >
              <View className="items-center">
                <Ionicons name="flash" size={20} color="#ea580c" />
                <Text className="mt-1 text-sm font-semibold text-orange-700">
                  {isLoading ? 'Creating...' : 'Quick Dev Signup'}
                </Text>
                <Text className="text-xs text-orange-600">
                  Skip authentication (name & email only)
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Sign Up Button */}
          <TouchableOpacity
            onPress={handleSignUp}
            disabled={isLoading}
            className={`rounded-lg py-4 mb-6 ${
              isLoading ? 'bg-blue-400' : 'bg-blue-600'
            }`}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {/* Sign In Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-600">Already have an account? </Text>
            <TouchableOpacity onPress={navigateToSignIn} disabled={isLoading}>
              <Text className="text-blue-600 font-medium">Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUpScreen;