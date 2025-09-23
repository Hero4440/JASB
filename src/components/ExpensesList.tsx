import { Ionicons } from '@expo/vector-icons';
import type { Expense } from '@shared/types';
import { Pressable, ScrollView, Text, View } from 'react-native';

interface ExpensesListProps {
  expenses: Expense[];
  onExpensePress?: (expense: Expense) => void;
  showGroupName?: boolean;
  emptyMessage?: string;
}

interface ExpenseCardProps {
  expense: Expense;
  onPress?: (expense: Expense) => void;
  showGroupName?: boolean;
}

function ExpenseCard({ expense, onPress, showGroupName }: ExpenseCardProps) {
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
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getSplitInfo = () => {
    if (!expense.splits || expense.splits.length === 0) {
      return 'No splits';
    }

    const splitCount = expense.splits.length;
    const splitAmount = formatAmount(
      getAmount() / splitCount,
      expense.currency_code,
    );

    return `${splitCount} people • ${splitAmount} each`;
  };

  return (
    <Pressable
      onPress={() => onPress?.(expense)}
      className="mb-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
      style={({ pressed }) => ({
        opacity: pressed ? 0.95 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="mb-1 text-base font-semibold text-gray-900">
            {getDescription()}
          </Text>

          <View className="mb-2 flex-row items-center">
            <Ionicons name="person-outline" size={14} color="#6b7280" />
            <Text className="ml-1 text-sm text-gray-600">
              Paid by {expense.payer?.name || 'Unknown'}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={14} color="#6b7280" />
            <Text className="ml-1 text-sm text-gray-600">
              {getSplitInfo()}
            </Text>
          </View>

          <Text className="mt-2 text-xs text-gray-500">
            {formatDate(expense.created_at)}
          </Text>
        </View>

        <View className="ml-4 items-end">
          <Text className="text-lg font-bold text-gray-900">
            {formatAmount(getAmount(), expense.currency_code)}
          </Text>

          <View className="mt-1 rounded-full bg-gray-100 px-2 py-1">
            <Text className="text-xs font-medium text-gray-600">
              {expense.split_type}
            </Text>
          </View>
        </View>
      </View>

      {onPress && (
        <View className="mt-3 flex-row items-center justify-center">
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </View>
      )}
    </Pressable>
  );
}

export function ExpensesList({
  expenses,
  onExpensePress,
  showGroupName = false,
  emptyMessage = 'No expenses yet',
}: ExpensesListProps) {
  if (!expenses || expenses.length === 0) {
    return (
      <View className="items-center py-8">
        <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
        <Text className="mt-4 text-center text-gray-500">{emptyMessage}</Text>
      </View>
    );
  }

  // Sort expenses by creation date (newest first)
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {sortedExpenses.map((expense) => (
        <ExpenseCard
          key={expense.id}
          expense={expense}
          onPress={onExpensePress}
          showGroupName={showGroupName}
        />
      ))}
    </ScrollView>
  );
}

export default ExpensesList;