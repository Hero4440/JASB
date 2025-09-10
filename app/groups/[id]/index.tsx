import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useDeleteGroup, useGroup, useGroupDrafts } from '@/lib/api';

import { useAuth } from '../../_layout';

export default function GroupDetailsScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: group, isLoading, error } = useGroup(groupId!);
  const { data: pendingDrafts } = useGroupDrafts(groupId!, 'pending_review');
  const deleteGroupMutation = useDeleteGroup();

  const handleAddExpense = () => {
    router.push(`/groups/${groupId}/add-expense`);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroupMutation.mutateAsync(groupId!);
              Alert.alert('Success', 'Group deleted successfully', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete group');
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-600">Loading group details...</Text>
      </View>
    );
  }

  if (error || !group) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-4 text-center text-lg text-red-600">
          {error ? 'Error loading group' : 'Group not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-lg bg-gray-200 px-6 py-3"
        >
          <Text className="font-semibold text-gray-800">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white p-6">
        <Text className="mb-2 text-2xl font-bold text-gray-900">
          {group.name}
        </Text>
        <Text className="text-gray-600">Currency: {group.currency_code}</Text>
        <Text className="text-gray-600">
          Created: {new Date(group.created_at).toLocaleDateString()}
        </Text>
      </View>

      {/* Quick Actions */}
      <View className="mx-4 mt-4 rounded-xl bg-white p-6 shadow-sm">
        <Text className="mb-4 text-lg font-semibold text-gray-900">
          Quick Actions
        </Text>

        <TouchableOpacity
          onPress={handleAddExpense}
          className="mb-3 rounded-lg bg-blue-600 p-4"
        >
          <Text className="text-center text-base font-semibold text-white">
            Add Expense
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Coming Soon',
              'Settle up feature will be available soon!',
            )
          }
          className="mb-3 rounded-lg bg-green-600 p-4"
        >
          <Text className="text-center text-base font-semibold text-white">
            Settle Up
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Coming Soon',
              'Invite members feature will be available soon!',
            )
          }
          className="mb-3 rounded-lg bg-gray-600 p-4"
        >
          <Text className="text-center text-base font-semibold text-white">
            Invite Members
          </Text>
        </TouchableOpacity>

        {/* Drafts button with pending count */}
        <TouchableOpacity
          onPress={() => router.push(`/groups/${groupId}/drafts`)}
          className="flex-row items-center justify-between rounded-lg bg-purple-600 p-4"
        >
          <Text className="text-base font-semibold text-white">
            Review Drafts
          </Text>
          {pendingDrafts && pendingDrafts.length > 0 && (
            <View className="min-w-[24px] items-center justify-center rounded-full bg-white px-2 py-1">
              <Text className="text-xs font-bold text-purple-600">
                {pendingDrafts.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Expenses Section */}
      <View className="mx-4 mt-4 rounded-xl bg-white p-6 shadow-sm">
        <Text className="mb-4 text-lg font-semibold text-gray-900">
          Recent Expenses
        </Text>

        <View className="items-center py-8">
          <Text className="mb-4 text-center text-gray-500">
            No expenses yet. Add your first expense to get started!
          </Text>
          <TouchableOpacity
            onPress={handleAddExpense}
            className="rounded-lg border border-blue-600 px-6 py-3"
          >
            <Text className="font-semibold text-blue-600">
              Add First Expense
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Balances Section */}
      <View className="mx-4 mt-4 rounded-xl bg-white p-6 shadow-sm">
        <Text className="mb-4 text-lg font-semibold text-gray-900">
          Balances
        </Text>

        <View className="items-center py-8">
          <Text className="text-center text-gray-500">All settled up! 🎉</Text>
        </View>
      </View>

      {/* Danger Zone */}
      {group.created_by === user?.id && (
        <View className="mx-4 mb-6 mt-4 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <Text className="mb-4 text-lg font-semibold text-red-800">
            Danger Zone
          </Text>

          <TouchableOpacity
            onPress={handleDeleteGroup}
            disabled={deleteGroupMutation.isPending}
            className={`rounded-lg border-2 border-red-300 p-4 ${
              deleteGroupMutation.isPending ? 'bg-gray-100' : 'bg-red-50'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                deleteGroupMutation.isPending ? 'text-gray-500' : 'text-red-700'
              }`}
            >
              {deleteGroupMutation.isPending ? 'Deleting...' : 'Delete Group'}
            </Text>
          </TouchableOpacity>

          <Text className="mt-2 text-center text-sm text-red-600">
            This will permanently delete the group and all its expenses
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
