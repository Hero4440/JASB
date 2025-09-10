import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DevSignInScreen = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleDevSignIn = async () => {
    setIsLoading(true);

    try {
      // Store mock user data for development
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'alice@example.com',
        user_metadata: {
          name: 'Alice Developer',
        },
      };

      // Store in async storage to simulate authentication
      await AsyncStorage.setItem('dev_user', JSON.stringify(mockUser));

      // Navigate back to main screen
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in with development account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInWithEmail = () => {
    router.push('/auth/sign-in');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Sign In Options',
          headerBackTitle: 'Back',
        }}
      />

      <View className="flex-1 px-6 py-8">
        {/* Header */}
        <View className="mb-8 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Ionicons name="code-outline" size={32} color="#2563eb" />
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">
            Development Mode
          </Text>
          <Text className="text-center text-gray-600">
            Choose how you'd like to sign in to JASB
          </Text>
        </View>

        {/* Development Sign In (Quick Access) */}
        <TouchableOpacity
          onPress={handleDevSignIn}
          disabled={isLoading}
          className={`mb-4 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 py-4 ${
            isLoading ? 'opacity-50' : ''
          }`}
        >
          <View className="items-center">
            <Ionicons name="flash" size={24} color="#ea580c" />
            <Text className="mt-2 text-lg font-semibold text-orange-700">
              {isLoading ? 'Signing In...' : 'Quick Dev Sign In'}
            </Text>
            <Text className="mt-1 text-sm text-orange-600">
              Use pre-configured test account
            </Text>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View className="mb-6 flex-row items-center">
          <View className="h-px flex-1 bg-gray-300" />
          <Text className="px-4 text-sm text-gray-500">or</Text>
          <View className="h-px flex-1 bg-gray-300" />
        </View>

        {/* Full Authentication */}
        <TouchableOpacity
          onPress={handleSignInWithEmail}
          disabled={isLoading}
          className="mb-6 rounded-lg bg-blue-600 py-4"
        >
          <View className="items-center">
            <Ionicons name="mail" size={24} color="white" />
            <Text className="mt-2 text-lg font-semibold text-white">
              Sign In with Email
            </Text>
            <Text className="mt-1 text-sm text-blue-100">
              Full authentication with Supabase
            </Text>
          </View>
        </TouchableOpacity>

        {/* Info Box */}
        <View className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#2563eb" />
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-blue-800">
                Development Mode
              </Text>
              <Text className="mt-1 text-sm text-blue-700">
                Quick Dev Sign In bypasses Supabase authentication and uses mock
                data. Perfect for development and testing features quickly.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DevSignInScreen;
