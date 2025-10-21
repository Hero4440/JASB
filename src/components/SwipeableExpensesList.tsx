import { Ionicons } from '@expo/vector-icons';
import type { Expense } from '@shared/types';
import { ScrollView, Text, View } from 'react-native';

import { SwipeableExpenseCard } from './SwipeableExpenseCard';

interface SwipeableExpensesListProps {
  expenses: Expense[];
  onExpensePress?: (expense: Expense) => void;
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expense: Expense) => void;
  emptyMessage?: string;
  currentUserId?: string;
  groupCreatorId?: string;
}

export function SwipeableExpensesList({
  expenses,
  onExpensePress,
  onEditExpense,
  onDeleteExpense,
  emptyMessage = 'No expenses yet',
  currentUserId,
  groupCreatorId,
}: SwipeableExpensesListProps) {
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
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Check if user can edit/delete each expense
  const canUserEditExpense = () => {
    // Anyone can edit expenses (matches ExpenseDetailModal behavior)
    return true;
  };

  const canUserDeleteExpense = (expense: Expense) => {
    // User can delete if they are the payer or if they are the group creator
    return (
      expense.paid_by === currentUserId || groupCreatorId === currentUserId
    );
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {sortedExpenses.map((expense) => (
        <SwipeableExpenseCard
          key={expense.id}
          expense={expense}
          onPress={onExpensePress}
          onEdit={onEditExpense}
          onDelete={onDeleteExpense}
          canEdit={canUserEditExpense()}
          canDelete={canUserDeleteExpense(expense)}
        />
      ))}
    </ScrollView>
  );
}

export default SwipeableExpensesList;
