import { Ionicons } from '@expo/vector-icons';
import type { Expense } from '@shared/types';
import { Modal, Pressable, ScrollView, Text, View, Alert } from 'react-native';
import { SwipeableExpensesList } from './SwipeableExpensesList';

interface AllExpensesModalProps {
  expenses: Expense[] | undefined;
  isLoading: boolean;
  visible: boolean;
  onClose: () => void;
  onExpensePress?: (expense: Expense) => void;
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expense: Expense) => void;
  currentUserId?: string;
  groupCreatorId?: string;
}

export function AllExpensesModal({
  expenses,
  isLoading,
  visible,
  onClose,
  onExpensePress,
  onEditExpense,
  onDeleteExpense,
  currentUserId,
  groupCreatorId,
}: AllExpensesModalProps) {
  const handleDebugInfo = () => {
    const debugInfo = {
      totalExpenses: expenses?.length || 0,
      isLoading,
      expensesData: expenses?.map(exp => ({
        id: exp.id,
        description: exp.description || (exp as any).title,
        amount: exp.amount || (exp as any).amount_cents,
        hasDescription: !!exp.description,
        hasTitle: !!(exp as any).title,
        hasAmount: !!exp.amount,
        hasAmountCents: !!(exp as any).amount_cents,
      })) || [],
    };

    Alert.alert(
      'Debug Information',
      JSON.stringify(debugInfo, null, 2),
      [{ text: 'OK' }]
    );
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
              All Expenses
            </Text>
            <View className="flex-row items-center space-x-2">
              <Pressable
                onPress={handleDebugInfo}
                className="rounded-full bg-blue-100 p-2 mr-2"
              >
                <Ionicons name="bug-outline" size={20} color="#3b82f6" />
              </Pressable>
              <Pressable
                onPress={onClose}
                className="rounded-full bg-gray-100 p-2"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>
          </View>
          <Text className="mt-1 text-sm text-gray-600">
            {isLoading ? 'Loading...' : `${expenses?.length || 0} expenses found`}
          </Text>
        </View>

        <ScrollView className="flex-1 p-4">
          {isLoading ? (
            <View className="items-center py-8">
              <Text className="text-gray-500">Loading expenses...</Text>
            </View>
          ) : expenses && expenses.length > 0 ? (
            <View>
              <Text className="mb-4 text-lg font-semibold text-gray-900">
                Raw Data Check:
              </Text>

              {/* Debug section showing raw data */}
              <View className="mb-6 rounded-lg bg-blue-50 p-4">
                <Text className="mb-2 text-sm font-medium text-blue-900">
                  Debug Info
                </Text>
                <Text className="text-sm text-blue-700">
                  Total expenses: {expenses.length}
                </Text>
                <Text className="text-sm text-blue-700">
                  Loading state: {isLoading ? 'true' : 'false'}
                </Text>
                <Text className="text-sm text-blue-700">
                  First expense ID: {expenses[0]?.id || 'N/A'}
                </Text>
                <Text className="text-sm text-blue-700">
                  First expense description: {expenses[0]?.description || (expenses[0] as any)?.title || 'N/A'}
                </Text>
              </View>

              {/* Expense list */}
              <SwipeableExpensesList
                expenses={expenses}
                onExpensePress={onExpensePress}
                onEditExpense={onEditExpense}
                onDeleteExpense={onDeleteExpense}
                currentUserId={currentUserId}
                groupCreatorId={groupCreatorId}
                emptyMessage="No expenses found"
              />
            </View>
          ) : (
            <View className="items-center py-8">
              <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
              <Text className="mt-4 text-center text-gray-500">
                No expenses found
              </Text>
              <Text className="mt-2 text-center text-sm text-gray-400">
                This might indicate a data loading issue
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}