import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useDeleteGroup, useGroup, useGroupDrafts, useGroupExpenses, useGroupBalances, useGroupSettlements, useUpdateExpense, useDeleteExpense, queryKeys } from '@/lib/api';
import { ManageMembersModal } from '@/components/ManageMembersModal';
import { ExpensesList } from '@/components/ExpensesList';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';
import { AllExpensesModal } from '@/components/AllExpensesModal';
import type { Expense } from '@shared/types';

import { useAuth } from '../../_layout';

export default function GroupDetailsScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: group, isLoading, error } = useGroup(groupId!);
  const { data: pendingDrafts } = useGroupDrafts(groupId!, 'pending_review');
  const { data: expenses, isLoading: expensesLoading } = useGroupExpenses(groupId!);
  const { data: balances, isLoading: balancesLoading } = useGroupBalances(groupId!);
  const { data: settlements, isLoading: settlementsLoading } = useGroupSettlements(groupId!);
  const deleteGroupMutation = useDeleteGroup();
  const updateExpenseMutation = useUpdateExpense();
  const deleteExpenseMutation = useDeleteExpense();
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showAllExpensesModal, setShowAllExpensesModal] = useState(false);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (groupId) {
        // Invalidate and refetch all group-related queries
        queryClient.invalidateQueries({ queryKey: queryKeys.groupExpenses(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groupBalances(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groupSettlements(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groupSettlementRecords(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groupDrafts(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });

        // Force refetch to ensure fresh data
        queryClient.refetchQueries({ queryKey: queryKeys.groupExpenses(groupId) });
        queryClient.refetchQueries({ queryKey: queryKeys.groupBalances(groupId) });
        queryClient.refetchQueries({ queryKey: queryKeys.groupSettlements(groupId) });
        queryClient.refetchQueries({ queryKey: queryKeys.groupSettlementRecords(groupId) });
      }
    }, [groupId, queryClient])
  );

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

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(null);
    router.push(`/groups/${groupId}/add-expense?editId=${expense.id}`);
  };

  const handleDeleteExpense = async (expense: Expense) => {
    try {
      await deleteExpenseMutation.mutateAsync({
        expenseId: expense.id,
        groupId: groupId!,
      });
      setSelectedExpense(null);
      Alert.alert('Success', 'Expense deleted successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete expense');
    }
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
        <Text className="text-gray-600">
          Members: {group.members?.length || 0}
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
          onPress={() => router.push(`/groups/${groupId}/settle-up`)}
          className="mb-3 rounded-lg bg-green-600 p-4"
        >
          <Text className="text-center text-base font-semibold text-white">
            Settle Up
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowMembersModal(true)}
          className="mb-3 rounded-lg bg-gray-600 p-4"
        >
          <Text className="text-center text-base font-semibold text-white">
            Manage Members
          </Text>
        </TouchableOpacity>

        {/* Drafts button with pending count */}
        <TouchableOpacity
          onPress={() => router.push(`/groups/${groupId}/drafts`)}
          className="mb-3 flex-row items-center justify-between rounded-lg bg-purple-600 p-4"
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

        <TouchableOpacity
          onPress={() => setShowAllExpensesModal(true)}
          className="flex-row items-center justify-between rounded-lg bg-orange-600 p-4"
        >
          <Text className="text-base font-semibold text-white">
            View All Expenses
          </Text>
          {expenses && expenses.length > 0 && (
            <View className="min-w-[24px] items-center justify-center rounded-full bg-white px-2 py-1">
              <Text className="text-xs font-bold text-orange-600">
                {expenses.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Expenses Section */}
      <View className="mx-4 mt-4 rounded-xl bg-white shadow-sm">
        <View className="border-b border-gray-100 px-6 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-gray-900">
              Recent Expenses
            </Text>
            {expenses && expenses.length > 3 && (
              <TouchableOpacity
                onPress={() => setShowAllExpensesModal(true)}
                className="rounded-lg bg-gray-100 px-3 py-1"
              >
                <Text className="text-sm font-medium text-gray-700">
                  View All
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="px-6 py-4">
          {expensesLoading ? (
            <View className="items-center py-8">
              <Text className="text-gray-500">Loading expenses...</Text>
            </View>
          ) : expenses && expenses.length > 0 ? (
            <View>
              {/* Show available expenses up to 3 */}
              <ExpensesList
                expenses={expenses.slice(0, Math.min(expenses.length, 3))}
                onExpensePress={(expense) => {
                  setSelectedExpense(expense);
                }}
                emptyMessage="No expenses in this group yet"
              />
              {/* Show "View All" button only if there are more than 3 expenses */}
              {expenses.length > 3 && (
                <View className="mt-4 items-center">
                  <TouchableOpacity
                    onPress={() => setShowAllExpensesModal(true)}
                    className="rounded-lg bg-blue-600 px-6 py-3"
                  >
                    <Text className="font-semibold text-white">
                      View All {expenses.length} Expenses
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* Show expense count for clarity */}
              {expenses.length <= 3 && expenses.length > 1 && (
                <View className="mt-2 items-center">
                  <Text className="text-xs text-gray-500">
                    Showing all {expenses.length} expenses
                  </Text>
                </View>
              )}
            </View>
          ) : !expensesLoading && (!expenses || expenses.length === 0) ? (
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
          ) : null}
        </View>
      </View>

      {/* Balances Section */}
      <View className="mx-4 mt-4 rounded-xl bg-white p-6 shadow-sm">
        <Text className="mb-4 text-lg font-semibold text-gray-900">
          Balances
        </Text>

        {balancesLoading || settlementsLoading ? (
          <View className="items-center py-8">
            <Text className="text-gray-500">Loading balances...</Text>
          </View>
        ) : settlements && settlements.length > 0 ? (
          <View className="space-y-6">
            {/* Individual Member Breakdown */}
            <View className="space-y-4">
              <Text className="text-lg font-semibold text-gray-900">
                💰 Individual Balances
              </Text>

              {balances &&
                balances
                  .filter((balance) => Math.abs(balance.balance) > 0.01)
                  .map((balance) => {
                    const isOwed = balance.balance > 0;
                    const amount = Math.abs(balance.balance);

                    // Find settlements involving this user
                    const owesToThisPerson = settlements.filter(s => s.to_user_id === balance.user_id);
                    const thisPersonOwes = settlements.filter(s => s.from_user_id === balance.user_id);

                    return (
                      <View
                        key={balance.user_id}
                        className={`rounded-lg border-2 p-4 ${
                          isOwed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <View className="mb-3 flex-row items-center justify-between">
                          <Text className="text-lg font-bold text-gray-900">
                            {balance.user?.name || 'Unknown User'}
                          </Text>
                          <Text
                            className={`text-xl font-bold ${
                              isOwed ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {isOwed ? '+' : '-'}${amount.toFixed(2)}
                          </Text>
                        </View>

                        {/* Show who owes this person money */}
                        {isOwed && owesToThisPerson.length > 0 && (
                          <View className="space-y-2">
                            <Text className="font-semibold text-green-800">
                              💵 Gets money from:
                            </Text>
                            {owesToThisPerson.map((settlement, index) => (
                              <View
                                key={index}
                                className="flex-row items-center justify-between rounded-md bg-white p-3"
                              >
                                <Text className="text-gray-900">
                                  📤 {settlement.from_user?.name}
                                </Text>
                                <Text className="font-semibold text-green-700">
                                  ${settlement.amount.toFixed(2)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Show who this person owes money to */}
                        {!isOwed && thisPersonOwes.length > 0 && (
                          <View className="space-y-2">
                            <Text className="font-semibold text-red-800">
                              💸 Owes money to:
                            </Text>
                            {thisPersonOwes.map((settlement, index) => (
                              <View
                                key={index}
                                className="flex-row items-center justify-between rounded-md bg-white p-3"
                              >
                                <Text className="text-gray-900">
                                  📥 {settlement.to_user?.name}
                                </Text>
                                <Text className="font-semibold text-red-700">
                                  ${settlement.amount.toFixed(2)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
            </View>

            {/* Quick Settlement Guide */}
            <View className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
              <Text className="mb-3 text-lg font-semibold text-blue-900">
                ⚡ Quick Settlement Guide
              </Text>
              <Text className="mb-3 text-sm text-blue-700">
                Complete these payments to settle all debts:
              </Text>

              <View className="space-y-2">
                {settlements.map((settlement, index) => (
                  <View
                    key={index}
                    className="flex-row items-center justify-between rounded-md bg-white p-3"
                  >
                    <View className="flex-1">
                      <Text className="font-medium text-gray-900">
                        {settlement.from_user?.name} → {settlement.to_user?.name}
                      </Text>
                    </View>
                    <Text className="font-bold text-blue-700">
                      ${settlement.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : balances && balances.every((balance) => Math.abs(balance.balance) < 0.01) ? (
          <View className="items-center py-8">
            <Text className="text-center text-gray-500">All settled up! 🎉</Text>
          </View>
        ) : (
          <View className="items-center py-8">
            <Text className="text-center text-gray-500">No balances to show</Text>
          </View>
        )}
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

      {/* Members Management Modal */}
      {group && (
        <ManageMembersModal
          group={group}
          visible={showMembersModal}
          onClose={() => setShowMembersModal(false)}
        />
      )}

      {/* Expense Detail Modal */}
      <ExpenseDetailModal
        expense={selectedExpense}
        visible={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onEdit={handleEditExpense}
        onDelete={handleDeleteExpense}
        canEdit={true}
        canDelete={selectedExpense?.paid_by === user?.id || group?.created_by === user?.id}
      />

      {/* All Expenses Modal */}
      <AllExpensesModal
        expenses={expenses}
        isLoading={expensesLoading}
        visible={showAllExpensesModal}
        onClose={() => setShowAllExpensesModal(false)}
        onExpensePress={(expense) => {
          setSelectedExpense(expense);
          setShowAllExpensesModal(false);
        }}
        onEditExpense={(expense) => {
          setShowAllExpensesModal(false);
          handleEditExpense(expense);
        }}
        onDeleteExpense={(expense) => {
          setShowAllExpensesModal(false);
          handleDeleteExpense(expense);
        }}
        currentUserId={user?.id}
        groupCreatorId={group?.created_by}
      />
    </ScrollView>
  );
}
