import type { Settlement } from '@shared/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  getErrorMessage,
  useCreateSettlementRecord,
  useGroup,
  useGroupSettlements,
} from '@/lib/api';

import { useAuth } from '../../_layout';

export default function SettleUpScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: group, isLoading: groupLoading } = useGroup(groupId!);
  const { data: settlements, isLoading: settlementsLoading } =
    useGroupSettlements(groupId!);
  const createSettlementMutation = useCreateSettlementRecord();

  const [selectedSettlement, setSelectedSettlement] = useState<{
    from_user_id: string;
    to_user_id: string;
    maxAmount: number;
    fromUserName: string;
    toUserName: string;
  } | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const isAdmin =
    group?.members?.find((member) => member.user_id === user?.id)?.role ===
    'admin';

  const handleSettleUp = async () => {
    if (!selectedSettlement || !amount || parseFloat(amount) <= 0) {
      Alert.alert(
        'Error',
        'Please select a settlement and enter a valid amount',
      );
      return;
    }

    const settlementAmount = parseFloat(amount);
    if (settlementAmount > selectedSettlement.maxAmount) {
      Alert.alert(
        'Error',
        `Amount cannot exceed $${selectedSettlement.maxAmount.toFixed(2)}`,
      );
      return;
    }

    try {
      await createSettlementMutation.mutateAsync({
        groupId: groupId!,
        settlement: {
          from_user: selectedSettlement.from_user_id,
          to_user: selectedSettlement.to_user_id,
          amount_cents: Math.round(settlementAmount * 100),
          description:
            description ||
            `Settlement from ${selectedSettlement.fromUserName} to ${selectedSettlement.toUserName}`,
        },
      });

      Alert.alert(
        'Success',
        isAdmin
          ? `Successfully recorded payment of $${settlementAmount.toFixed(2)} from ${selectedSettlement.fromUserName} to ${selectedSettlement.toUserName} (Admin action)`
          : `Successfully recorded payment of $${settlementAmount.toFixed(2)} from ${selectedSettlement.fromUserName} to ${selectedSettlement.toUserName}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedSettlement(null);
              setAmount('');
              setDescription('');
              router.back();
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    }
  };

  if (groupLoading || settlementsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-600">Loading settle up options...</Text>
      </View>
    );
  }

  if (!group || !settlements || settlements.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-4 text-center text-lg text-gray-600">
          All settled up! 🎉
        </Text>
        <Text className="mb-6 text-center text-gray-500">
          No outstanding balances to settle.
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

  // Get settlements - all settlements for admin, only user's settlements for members
  const availableSettlements: Settlement[] = isAdmin
    ? settlements
    : settlements.filter(
        (s) =>
          (s.from_user ?? (s as any).from_user_id) === user?.id ||
          (s.to_user ?? (s as any).to_user_id) === user?.id,
      );

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white p-6">
        <Text className="mb-2 text-2xl font-bold text-gray-900">
          Settle Up {isAdmin && '(Admin)'}
        </Text>
        <Text className="text-gray-600">
          {isAdmin
            ? 'Record payments for any group members to settle balances'
            : 'Record payments to settle your balances'}
        </Text>
      </View>

      {/* Available Settlements */}
      <View className="mx-4 mt-4 rounded-xl bg-white p-6 shadow-sm">
        <Text className="mb-4 text-lg font-semibold text-gray-900">
          Available Settlements
        </Text>

        {availableSettlements.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-center text-gray-500">
              {isAdmin
                ? 'All settled up! No outstanding balances in this group.'
                : 'No settlements needed for you at this time.'}
            </Text>
          </View>
        ) : (
          <View className="space-y-3">
            {availableSettlements.map((settlement) => {
              const fromUserId =
                settlement.from_user ?? (settlement as any).from_user_id;
              const toUserId =
                settlement.to_user ?? (settlement as any).to_user_id;
              const fromUserName =
                settlement.from_user_details?.name ||
                (settlement as any).from_user?.name ||
                'Unknown';
              const toUserName =
                settlement.to_user_details?.name ||
                (settlement as any).to_user?.name ||
                'Unknown';
              const settlementAmount =
                (settlement.amount_cents ??
                  Math.round(((settlement as any).amount ?? 0) * 100)) / 100;
              const isUserPaying = fromUserId === user?.id;
              let settlementTitle = `${fromUserName} owes you`;
              if (isAdmin) {
                settlementTitle = `${fromUserName} owes ${toUserName}`;
              } else if (isUserPaying) {
                settlementTitle = `You owe ${toUserName}`;
              }

              let settlementSubtitle = 'Tap to record payment received';
              if (isAdmin) {
                settlementSubtitle = 'Tap to record payment';
              } else if (isUserPaying) {
                settlementSubtitle = 'Tap to pay';
              }

              let amountColorClass = 'text-green-600';
              if (isAdmin) {
                amountColorClass = 'text-blue-600';
              } else if (isUserPaying) {
                amountColorClass = 'text-red-600';
              }

              const settlementKey = `${fromUserId || 'unknown-from'}-${
                toUserId || 'unknown-to'
              }-${Math.round(settlementAmount * 100)}`;

              return (
                <TouchableOpacity
                  key={settlementKey}
                  onPress={() =>
                    setSelectedSettlement({
                      from_user_id: fromUserId || '',
                      to_user_id: toUserId || '',
                      maxAmount: settlementAmount,
                      fromUserName,
                      toUserName,
                    })
                  }
                  className={`rounded-lg border-2 p-4 ${
                    selectedSettlement?.from_user_id === fromUserId &&
                    selectedSettlement?.to_user_id === toUserId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-medium text-gray-900">
                        {settlementTitle}
                      </Text>
                      <Text className="text-sm text-gray-500">
                        {settlementSubtitle}
                      </Text>
                    </View>
                    <Text className={`text-xl font-bold ${amountColorClass}`}>
                      ${settlementAmount.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Settlement Form */}
      {selectedSettlement && (
        <View className="mx-4 mt-4 rounded-xl bg-white p-6 shadow-sm">
          <Text className="mb-4 text-lg font-semibold text-gray-900">
            {isAdmin ? 'Record Settlement (Admin)' : 'Record Settlement'}
          </Text>

          <View className="mb-4 rounded-lg bg-gray-50 p-4">
            <Text className="text-base font-medium text-gray-900">
              {selectedSettlement.fromUserName} →{' '}
              {selectedSettlement.toUserName}
            </Text>
            <Text className="text-sm text-gray-600">
              Maximum amount: ${selectedSettlement.maxAmount.toFixed(2)}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-base font-medium text-gray-700">
              Amount ($)
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-medium text-gray-700">
              Description (Optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Settlement description..."
              multiline
              numberOfLines={3}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={() => {
                setSelectedSettlement(null);
                setAmount('');
                setDescription('');
              }}
              className="flex-1 rounded-lg bg-gray-200 py-3"
            >
              <Text className="text-center font-semibold text-gray-800">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSettleUp}
              disabled={createSettlementMutation.isPending}
              className={`flex-1 rounded-lg py-3 ${
                createSettlementMutation.isPending
                  ? 'bg-gray-400'
                  : 'bg-green-600'
              }`}
            >
              <Text className="text-center font-semibold text-white">
                {createSettlementMutation.isPending
                  ? 'Recording...'
                  : 'Record Payment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
