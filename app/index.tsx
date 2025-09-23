import { Ionicons } from '@expo/vector-icons';
import type { Group } from '@shared/types';
import { router, Stack } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage, useCreateGroup, useGroups } from '../src/lib/api';
import { useAuth } from './_layout';

// Group Card Component
function GroupCard({ group }: { group: Group }) {
  const memberCount = group.members?.length || 0;

  const handlePress = () => {
    router.push(`/groups/${group.id}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      className="mx-4 mb-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
      style={({ pressed }) => ({
        opacity: pressed ? 0.95 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View className="mb-2 flex-row items-start justify-between">
        <Text className="mr-3 flex-1 text-lg font-semibold text-gray-900">
          {group.name}
        </Text>
        <View className="rounded-full bg-gray-100 px-2 py-1">
          <Text className="text-xs font-medium text-gray-600">
            {group.currency_code}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center">
        <Ionicons name="people-outline" size={16} color="#6b7280" />
        <Text className="ml-1 text-sm text-gray-600">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
    </Pressable>
  );
}

// Create Group Modal Component
function CreateGroupButton() {
  const createGroupMutation = useCreateGroup();

  const handleCreateGroup = () => {
    Alert.prompt(
      'Create New Group',
      'Enter a name for your expense group:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Create',
          onPress: (groupName) => {
            if (groupName?.trim()) {
              createGroupMutation.mutate(
                { name: groupName.trim() },
                {
                  onSuccess: (newGroup) => {
                    router.push(`/groups/${newGroup.id}`);
                  },
                  onError: (error) => {
                    Alert.alert('Error', getErrorMessage(error));
                  },
                },
              );
            }
          },
        },
      ],
      'plain-text',
      '',
      'default',
    );
  };

  return (
    <Pressable
      onPress={handleCreateGroup}
      disabled={createGroupMutation.isPending}
      className="mx-4 mb-6 rounded-xl bg-blue-600 p-4"
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View className="flex-row items-center justify-center">
        <Ionicons name="add" size={20} color="white" />
        <Text className="ml-2 font-semibold text-white">
          {createGroupMutation.isPending ? 'Creating...' : 'Create New Group'}
        </Text>
      </View>
    </Pressable>
  );
}

// Main Groups List Screen
const GroupsListScreen = () => {
  const { user, isLoading: authLoading, signOut, refreshAuth } = useAuth();
  const { data: groups, isLoading, error, refetch } = useGroups();

  // Show loading state
  if (authLoading || isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-600">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show auth required state
  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="log-in-outline" size={64} color="#6b7280" />
          <Text className="mb-2 mt-4 text-xl font-semibold text-gray-900">
            Welcome to JASB
          </Text>
          <Text className="mb-6 text-center text-gray-600">
            Sign in to start splitting expenses with your friends and roommates.
          </Text>
          <Pressable
            className="mb-3 rounded-lg bg-blue-600 px-6 py-3"
            onPress={() => router.push('/auth/dev-sign-in')}
          >
            <Text className="font-semibold text-white">Sign In</Text>
          </Pressable>

          {__DEV__ && (
            <Pressable
              className="rounded-lg bg-orange-500 px-6 py-3"
              onPress={async () => {
                const AsyncStorage = (
                  await import('@react-native-async-storage/async-storage')
                ).default;
                const mockUser = {
                  id: '550e8400-e29b-41d4-a716-446655440001',
                  email: 'alice@example.com',
                  user_metadata: { name: 'Alice Developer' },
                };
                await AsyncStorage.setItem(
                  'dev_user',
                  JSON.stringify(mockUser),
                );
                // Refresh auth state to pick up the dev user
                await refreshAuth();
              }}
            >
              <Text className="font-semibold text-white">Quick Dev Login</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="mb-2 mt-4 text-xl font-semibold text-gray-900">
            Something went wrong
          </Text>
          <Text className="mb-6 text-center text-gray-600">
            {getErrorMessage(error)}
          </Text>
          <Pressable
            className="rounded-lg bg-blue-600 px-6 py-3"
            onPress={() => refetch()}
          >
            <Text className="font-semibold text-white">Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: 'My Groups',
          headerRight: () => (
            <Pressable onPress={() => signOut()} className="p-2">
              <Ionicons name="log-out-outline" size={20} color="#6b7280" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1">
        {/* Header Section */}
        <View className="p-6 pb-4">
          <Text className="mb-2 text-2xl font-bold text-gray-900">
            Hello, {user.user_metadata?.name || user.email}
          </Text>
          <Text className="text-gray-600">
            Manage your shared expenses and settle up with friends.
          </Text>
        </View>

        {/* Create Group Button */}
        <CreateGroupButton />

        {/* Groups List */}
        {groups && groups.length > 0 ? (
          <View className="pb-6">
            <Text className="mb-3 px-4 text-lg font-semibold text-gray-900">
              Your Groups
            </Text>
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </View>
        ) : (
          <View className="mt-12 flex-1 items-center justify-center p-6">
            <Ionicons name="people-outline" size={64} color="#6b7280" />
            <Text className="mb-2 mt-4 text-xl font-semibold text-gray-900">
              No groups yet
            </Text>
            <Text className="mb-6 text-center text-gray-600">
              Create your first group to start splitting expenses with friends.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default GroupsListScreen;
