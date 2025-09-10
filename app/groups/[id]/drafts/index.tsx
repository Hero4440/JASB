import type { ExpenseDraft } from '@shared/types';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGroupDrafts } from '../../../../src/lib/api';

const DraftsList = () => {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const {
    data: drafts,
    isLoading,
    error,
  } = useGroupDrafts(groupId!, 'pending_review');

  const renderDraftItem = ({ item }: { item: ExpenseDraft }) => (
    <TouchableOpacity
      className="mx-4 mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      onPress={() => router.push(`/groups/${groupId}/drafts/${item.id}`)}
    >
      <View className="mb-2 flex-row items-start justify-between">
        <Text className="flex-1 text-lg font-semibold text-gray-900">
          {item.title}
        </Text>
        <View className="rounded bg-yellow-100 px-2 py-1">
          <Text className="text-xs font-medium text-yellow-800">
            {item.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <Text className="mb-2 text-2xl font-bold text-green-600">
        ${(item.amount_cents / 100).toFixed(2)}
      </Text>

      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-gray-600">
            Paid by: {item.paid_by_user?.name || 'Unknown'}
          </Text>
          <Text className="text-sm text-gray-600">
            Split: {item.split_type} • {item.participants.length} people
          </Text>
        </View>

        {item.source === 'llm_parsed' && (
          <View className="rounded bg-purple-100 px-2 py-1">
            <Text className="text-xs font-medium text-purple-800">
              AI PARSED
            </Text>
          </View>
        )}
      </View>

      {item.validation_warnings && item.validation_warnings.length > 0 && (
        <View className="mt-2 rounded border border-yellow-200 bg-yellow-50 p-2">
          <Text className="text-sm font-medium text-yellow-800">
            ⚠️ Needs Review
          </Text>
          <Text className="text-sm text-yellow-700">
            {item.validation_warnings.join(', ')}
          </Text>
        </View>
      )}

      <Text className="mt-2 text-xs text-gray-500">
        Created {new Date(item.created_at).toLocaleDateString()} by{' '}
        {item.created_by_user?.name}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-600">Loading drafts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-4">
          <Text className="mb-4 text-center text-red-600">
            Failed to load drafts: {error.message}
          </Text>
          <TouchableOpacity
            className="rounded bg-blue-600 px-4 py-2"
            onPress={() => router.back()}
          >
            <Text className="font-medium text-white">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-4 py-2">
        <Text className="text-xl font-bold text-gray-900">Pending Drafts</Text>
        <Text className="text-sm text-gray-600">
          {drafts?.length || 0} expense{(drafts?.length || 0) !== 1 ? 's' : ''}{' '}
          awaiting review
        </Text>
      </View>

      {!drafts || drafts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="mb-2 text-xl text-gray-600">No pending drafts</Text>
          <Text className="mb-6 text-center text-gray-500">
            All expenses have been reviewed and processed.
          </Text>
          <TouchableOpacity
            className="rounded-lg bg-blue-600 px-6 py-3"
            onPress={() => router.back()}
          >
            <Text className="font-semibold text-white">Back to Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={drafts}
          renderItem={renderDraftItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default DraftsList;
