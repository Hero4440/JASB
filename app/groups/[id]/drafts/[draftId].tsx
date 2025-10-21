import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getErrorMessage,
  useDeleteDraft,
  useDraft,
  useReviewDraft,
} from '../../../../src/lib/api';

const DraftReview = () => {
  const { id: groupId, draftId } = useLocalSearchParams<{
    id: string;
    draftId: string;
  }>();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: draft, isLoading, error } = useDraft(groupId!, draftId!);
  const reviewDraftMutation = useReviewDraft();
  const deleteDraftMutation = useDeleteDraft();

  const handleApprove = async () => {
    Alert.alert(
      'Approve Expense',
      'This will create a new expense from this draft. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              await reviewDraftMutation.mutateAsync({
                groupId: groupId!,
                draftId: draftId!,
                action: 'approve',
              });
              router.back();
              Alert.alert('Success', 'Draft approved and expense created!');
            } catch (caughtError) {
              Alert.alert('Error', getErrorMessage(caughtError));
            }
          },
        },
      ],
    );
  };

  const handleReject = async () => {
    try {
      await reviewDraftMutation.mutateAsync({
        groupId: groupId!,
        draftId: draftId!,
        action: 'reject',
        reason: rejectReason.trim() || undefined,
      });
      setShowRejectModal(false);
      setRejectReason('');
      router.back();
      Alert.alert('Draft Rejected', 'The expense draft has been rejected.');
    } catch (caughtError) {
      Alert.alert('Error', getErrorMessage(caughtError));
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Draft',
      'This will permanently delete this draft. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraftMutation.mutateAsync({
                groupId: groupId!,
                draftId: draftId!,
              });
              router.back();
              Alert.alert(
                'Draft Deleted',
                'The expense draft has been deleted.',
              );
            } catch (caughtError) {
              Alert.alert('Error', getErrorMessage(caughtError));
            }
          },
        },
      ],
    );
  };

  const formatSplitType = (splitType: string) => {
    switch (splitType) {
      case 'equal':
        return 'Split Equally';
      case 'exact':
        return 'Exact Amounts';
      case 'percentage':
        return 'By Percentage';
      case 'share':
        return 'By Shares';
      default:
        return splitType;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-600">Loading draft...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !draft) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-4">
          <Text className="mb-4 text-center text-red-600">
            Failed to load draft: {getErrorMessage(error) || 'Draft not found'}
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

  const isProcessing =
    reviewDraftMutation.isPending || deleteDraftMutation.isPending;
  const statusStyleMap = {
    pending_review: {
      background: 'bg-yellow-100',
      text: 'text-yellow-800',
    },
    approved: {
      background: 'bg-green-100',
      text: 'text-green-800',
    },
    rejected: {
      background: 'bg-red-100',
      text: 'text-red-800',
    },
  } as const;
  const statusStyles =
    statusStyleMap[draft.status as keyof typeof statusStyleMap] ??
    statusStyleMap.rejected;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="border-b border-gray-200 bg-white px-4 py-6">
          <View className="mb-2 flex-row items-start justify-between">
            <Text className="flex-1 text-2xl font-bold text-gray-900">
              {draft.title}
            </Text>
            <View className={`rounded px-3 py-1 ${statusStyles.background}`}>
              <Text className={`text-sm font-medium ${statusStyles.text}`}>
                {draft.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <Text className="mb-2 text-3xl font-bold text-green-600">
            ${(draft.amount_cents / 100).toFixed(2)}
          </Text>

          <View className="flex-row items-center">
            {draft.source === 'llm_parsed' && (
              <View className="mr-2 rounded bg-purple-100 px-2 py-1">
                <Text className="text-xs font-medium text-purple-800">
                  🤖 AI PARSED
                </Text>
              </View>
            )}
            <Text className="text-gray-600">
              Created {new Date(draft.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Warnings */}
        {draft.validation_warnings && draft.validation_warnings.length > 0 && (
          <View className="mx-4 mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <Text className="mb-2 font-semibold text-yellow-800">
              ⚠️ Review Required
            </Text>
            {draft.validation_warnings.map((warning: string) => (
              <Text key={warning} className="mb-1 text-sm text-yellow-700">
                • {warning}
              </Text>
            ))}
          </View>
        )}

        {/* LLM Metadata */}
        {draft.llm_metadata && (
          <View className="mx-4 mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <Text className="mb-2 font-semibold text-purple-800">
              🤖 AI Analysis
            </Text>
            {draft.llm_metadata.confidence && (
              <Text className="mb-1 text-sm text-purple-700">
                Confidence: {(draft.llm_metadata.confidence * 100).toFixed(0)}%
              </Text>
            )}
            {draft.llm_metadata.originalText && (
              <Text className="text-sm text-purple-700">
                Original: &quot;{draft.llm_metadata.originalText}&quot;
              </Text>
            )}
          </View>
        )}

        {/* Details */}
        <View className="mx-4 mt-4 rounded-lg border border-gray-200 bg-white">
          <View className="border-b border-gray-100 p-4">
            <Text className="mb-3 text-lg font-semibold text-gray-900">
              Expense Details
            </Text>

            <View className="space-y-3">
              <View>
                <Text className="text-sm font-medium text-gray-600">
                  Paid By
                </Text>
                <Text className="text-gray-900">
                  {draft.paid_by_user?.name || 'Unknown User'}
                </Text>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-600">
                  Split Method
                </Text>
                <Text className="text-gray-900">
                  {formatSplitType(draft.split_type)}
                </Text>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-600">
                  Participants
                </Text>
                <Text className="text-gray-900">
                  {draft.participants.length} people
                </Text>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-600">
                  Amount Per Person
                </Text>
                <Text className="text-gray-900">
                  $
                  {(
                    draft.amount_cents /
                    draft.participants.length /
                    100
                  ).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <View className="p-4">
            <Text className="mb-2 text-sm font-medium text-gray-600">
              Created By
            </Text>
            <Text className="text-gray-900">
              {draft.created_by_user?.name || 'Unknown User'}
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              {new Date(draft.created_at).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {draft.status === 'pending_review' && (
          <View className="mx-4 mb-8 mt-6">
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 rounded-lg bg-green-600 py-4 disabled:bg-gray-400"
                onPress={handleApprove}
                disabled={isProcessing}
              >
                <Text className="text-center text-lg font-semibold text-white">
                  {reviewDraftMutation.isPending ? 'Approving...' : '✓ Approve'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 rounded-lg bg-red-600 py-4 disabled:bg-gray-400"
                onPress={() => setShowRejectModal(true)}
                disabled={isProcessing}
              >
                <Text className="text-center text-lg font-semibold text-white">
                  ✗ Reject
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="mt-3 rounded-lg border border-gray-300 py-3 disabled:border-gray-200"
              onPress={handleDelete}
              disabled={isProcessing}
            >
              <Text className="text-center font-medium text-gray-700">
                {deleteDraftMutation.isPending ? 'Deleting...' : 'Delete Draft'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-1 p-4">
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-xl font-bold">Reject Draft</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Text className="font-medium text-blue-600">Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text className="mb-4 text-gray-600">
              Why are you rejecting this expense draft? (Optional)
            </Text>

            <TextInput
              className="h-32 rounded-lg border border-gray-300 p-3 text-gray-900"
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              className="mt-6 rounded-lg bg-red-600 py-4 disabled:bg-gray-400"
              onPress={handleReject}
              disabled={reviewDraftMutation.isPending}
            >
              <Text className="text-center text-lg font-semibold text-white">
                {reviewDraftMutation.isPending
                  ? 'Rejecting...'
                  : 'Confirm Rejection'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default DraftReview;
