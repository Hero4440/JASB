import { Ionicons } from '@expo/vector-icons';
import type { Expense } from '@shared/types';
import { Alert, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface ExpenseDetailModalProps {
  expense: Expense | null;
  visible: boolean;
  onClose: () => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function ExpenseDetailModal({
  expense,
  visible,
  onClose,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
}: ExpenseDetailModalProps) {
  if (!expense) return null;

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Handle both old and new data formats
  const getDescription = () => {
    return expense.description || (expense as any).title || 'Untitled Expense';
  };

  const getAmount = () => {
    if (expense.amount !== undefined) {
      return expense.amount;
    }
    if ((expense as any).amount_cents !== undefined) {
      return (expense as any).amount_cents / 100;
    }
    return 0;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSplitTypeLabel = (splitType: string) => {
    switch (splitType) {
      case 'equal':
        return 'Split Equally';
      case 'exact':
        return 'Exact Amounts';
      case 'percentage':
        return 'By Percentage';
      default:
        return splitType;
    }
  };

  const handleEdit = () => {
    if (onEdit && expense) {
      onEdit(expense);
    }
  };

  const handleDelete = () => {
    if (onDelete && expense) {
      Alert.alert(
        'Delete Expense',
        'Are you sure you want to delete this expense? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDelete(expense),
          },
        ]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="border-b border-gray-200 bg-white px-6 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-semibold text-gray-900">
              Expense Details
            </Text>
            <View className="flex-row items-center space-x-2">
              {canEdit && (
                <TouchableOpacity
                  onPress={handleEdit}
                  className="rounded-full bg-blue-100 p-2"
                >
                  <Ionicons name="pencil" size={20} color="#3b82f6" />
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity
                  onPress={handleDelete}
                  className="rounded-full bg-red-100 p-2"
                >
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
              <Pressable
                onPress={onClose}
                className="rounded-full bg-gray-100 p-2"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1">
          {/* Main Info */}
          <View className="mx-4 mt-4 rounded-xl bg-white p-6 shadow-sm">
            <View className="mb-4 items-center">
              <Text className="mb-2 text-center text-2xl font-bold text-gray-900">
                {getDescription()}
              </Text>
              <Text className="text-3xl font-bold text-blue-600">
                {formatAmount(getAmount(), expense.currency_code)}
              </Text>
            </View>

            <View className="space-y-3">
              <View className="flex-row items-center">
                <Ionicons name="person-outline" size={20} color="#6b7280" />
                <Text className="ml-3 text-base text-gray-700">
                  <Text className="font-medium">Paid by:</Text>{' '}
                  {expense.payer?.name || expense.payer?.email || 'Unknown'}
                </Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                <Text className="ml-3 text-base text-gray-700">
                  <Text className="font-medium">Date:</Text>{' '}
                  {formatDate(expense.created_at)}
                </Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons name="swap-horizontal-outline" size={20} color="#6b7280" />
                <Text className="ml-3 text-base text-gray-700">
                  <Text className="font-medium">Split Type:</Text>{' '}
                  {getSplitTypeLabel(expense.split_type)}
                </Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons name="card-outline" size={20} color="#6b7280" />
                <Text className="ml-3 text-base text-gray-700">
                  <Text className="font-medium">Currency:</Text>{' '}
                  {expense.currency_code}
                </Text>
              </View>
            </View>
          </View>

          {/* Split Details */}
          <View className="mx-4 mt-4 rounded-xl bg-white shadow-sm">
            <View className="border-b border-gray-100 px-6 py-4">
              <Text className="text-lg font-semibold text-gray-900">
                Split Details ({expense.splits?.length || 0} people)
              </Text>
            </View>

            <View className="px-6 py-4">
              {expense.splits?.map((split, index) => (
                <View
                  key={split.id}
                  className={`flex-row items-center justify-between py-3 ${
                    index < (expense.splits?.length || 1) - 1
                      ? 'border-b border-gray-100'
                      : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900">
                      {split.user?.name || split.user?.email || 'Unknown User'}
                    </Text>
                    {split.user?.email && split.user?.name && (
                      <Text className="text-sm text-gray-600">
                        {split.user.email}
                      </Text>
                    )}
                  </View>

                  <View className="ml-4 items-end">
                    <Text className="text-lg font-semibold text-gray-900">
                      {formatAmount(split.amount, expense.currency_code)}
                    </Text>
                    {split.user_id === expense.paid_by && (
                      <View className="mt-1 rounded-full bg-green-100 px-2 py-1">
                        <Text className="text-xs font-medium text-green-800">
                          Paid
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}

              {(!expense.splits || expense.splits.length === 0) && (
                <View className="py-8">
                  <Text className="text-center text-gray-500">
                    No split details available
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Summary */}
          <View className="mx-4 my-4 rounded-xl bg-blue-50 p-4">
            <View className="flex-row">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#3b82f6"
                style={{ marginTop: 2 }}
              />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-medium text-blue-900">
                  Expense Summary
                </Text>
                <Text className="mt-1 text-sm text-blue-700">
                  {expense.payer?.name || 'Someone'} paid{' '}
                  {formatAmount(getAmount(), expense.currency_code)} for "{getDescription()}".{' '}
                  {expense.splits && expense.splits.length > 0 && (
                    <>
                      Each person owes{' '}
                      {formatAmount(
                        getAmount() / expense.splits.length,
                        expense.currency_code,
                      )}.
                    </>
                  )}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}