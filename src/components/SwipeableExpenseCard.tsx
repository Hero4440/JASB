import { Ionicons } from '@expo/vector-icons';
import type { Expense } from '@shared/types';
import { useState, useRef } from 'react';
import {
  Pressable,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Alert,
  PanResponder,
} from 'react-native';

interface SwipeableExpenseCardProps {
  expense: Expense;
  onPress?: (expense: Expense) => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  showGroupName?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function SwipeableExpenseCard({
  expense,
  onPress,
  onEdit,
  onDelete,
  showGroupName,
  canEdit = false,
  canDelete = false,
}: SwipeableExpenseCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only capture horizontal swipes, not taps or vertical scrolls
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 20;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.setOffset(translateX._value);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx < 0) { // Only allow left swipe
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        translateX.flattenOffset();

        // Show actions if swiped left more than 80 pixels
        const shouldReveal = gestureState.dx < -80;

        if (shouldReveal && (canEdit || canDelete)) {
          setIsRevealed(true);
          Animated.spring(translateX, {
            toValue: canEdit && canDelete ? -192 : -96, // Show both buttons or just one (24px * 4 = 96px each)
            useNativeDriver: true,
          }).start();
        } else {
          setIsRevealed(false);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const hideActions = () => {
    setIsRevealed(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const handleEdit = () => {
    hideActions();
    if (onEdit && expense) {
      onEdit(expense);
    }
  };

  const handleDelete = () => {
    hideActions();
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

  const handleCardPress = () => {
    if (isRevealed) {
      hideActions();
    } else {
      onPress?.(expense);
    }
  };

  return (
    <View className="mb-3">
      {/* Action Buttons Background */}
      {(canEdit || canDelete) && (
        <View className="absolute right-0 top-0 h-full flex-row items-center">
          {canEdit && (
            <TouchableOpacity
              onPress={handleEdit}
              className="h-full w-24 items-center justify-center"
              style={{
                backgroundColor: '#3b82f6',
                borderTopLeftRadius: 8,
                borderBottomLeftRadius: canDelete ? 0 : 8,
                shadowColor: '#000',
                shadowOffset: { width: -2, height: 0 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="items-center justify-center rounded-full bg-white bg-opacity-20 p-2 mb-1">
                <Ionicons name="create-outline" size={24} color="white" />
              </View>
              <Text className="text-xs font-semibold text-white">Edit</Text>
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              className="h-full w-24 items-center justify-center"
              style={{
                backgroundColor: '#ef4444',
                borderTopRightRadius: 8,
                borderBottomRightRadius: 8,
                borderTopLeftRadius: canEdit ? 0 : 8,
                borderBottomLeftRadius: canEdit ? 0 : 8,
                shadowColor: '#000',
                shadowOffset: { width: 2, height: 0 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="items-center justify-center rounded-full bg-white bg-opacity-20 p-2 mb-1">
                <Ionicons name="trash-outline" size={24} color="white" />
              </View>
              <Text className="text-xs font-semibold text-white">Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Card */}
      <Animated.View
        style={{
          transform: [{ translateX }],
        }}
        {...panResponder.panHandlers}
      >
          <Pressable
            onPress={handleCardPress}
            className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
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

            {onPress && !isRevealed && (
              <View className="mt-3 flex-row items-center justify-center">
                <Ionicons name="chevron-forward" size={16} color="#6b7280" />
              </View>
            )}

            {(canEdit || canDelete) && !isRevealed && (
              <View className="mt-2 flex-row items-center justify-center">
                <Text className="text-xs text-gray-400">
                  ← Swipe left for actions
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
    </View>
  );
}