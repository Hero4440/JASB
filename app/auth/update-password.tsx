import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { getErrorMessage } from '../../src/lib/api';

const UpdatePasswordScreen = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUpdatePassword = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
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
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        Alert.alert('Update Failed', getErrorMessage(error));
        return;
      }

      Alert.alert(
        'Password Updated',
        'Your password has been successfully updated. You can now sign in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth/sign-in'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Update Failed', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen 
        options={{
          title: 'Update Password',
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
            <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="lock-closed-outline" size={32} color="#16a34a" />
            </View>
            <Text className="text-3xl font-bold text-gray-900 mb-2">Set New Password</Text>
            <Text className="text-gray-600 text-center">
              Please choose a strong password for your account
            </Text>
          </View>

          {/* Form */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">New Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your new password"
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
            <Text className="text-sm font-medium text-gray-700 mb-2">Confirm New Password</Text>
            <View className="relative">
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your new password"
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

          {/* Update Button */}
          <TouchableOpacity
            onPress={handleUpdatePassword}
            disabled={isLoading}
            className={`rounded-lg py-4 mb-6 ${
              isLoading ? 'bg-green-400' : 'bg-green-600'
            }`}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {isLoading ? 'Updating Password...' : 'Update Password'}
            </Text>
          </TouchableOpacity>

          {/* Password Requirements */}
          <View className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#2563eb" />
              <View className="ml-3 flex-1">
                <Text className="text-blue-800 font-medium text-sm">Password Requirements</Text>
                <Text className="text-blue-700 text-sm mt-1">
                  • At least 6 characters long{'\n'}
                  • Use a strong, unique password{'\n'}
                  • Consider using a password manager
                </Text>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default UpdatePasswordScreen;