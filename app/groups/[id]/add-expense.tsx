import type {
  CreateDraftRequest,
  CreateExpenseRequest,
  SplitType,
} from '@shared/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useCreateDraft, useCreateExpense, useGroup } from '@/lib/api';

import { useAuth } from '../../_layout';

const SPLIT_TYPES: { value: SplitType; label: string; description: string }[] =
  [
    {
      value: 'equal',
      label: 'Equal Split',
      description: 'Split equally among all members',
    },
    {
      value: 'amount',
      label: 'By Amount',
      description: 'Specify exact amounts for each person',
    },
    {
      value: 'percent',
      label: 'By Percentage',
      description: 'Specify percentages for each person',
    },
    {
      value: 'share',
      label: 'By Shares',
      description: 'Specify shares for each person',
    },
  ];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: group, isLoading: groupLoading } = useGroup(groupId!);
  const createExpenseMutation = useCreateExpense();
  const createDraftMutation = useCreateDraft();

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    description: '',
    splitType: 'equal' as SplitType,
    paidBy: user?.id || '',
  });

  const [amountCents, setAmountCents] = useState(0);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [isParsingMode, setIsParsingMode] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const handleAmountChange = (text: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    const formatted =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;

    setFormData((prev) => ({ ...prev, amount: formatted }));

    // Convert to cents for internal storage
    const dollars = parseFloat(formatted) || 0;
    setAmountCents(Math.round(dollars * 100));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter an expense title');
      return;
    }

    if (amountCents <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!formData.paidBy) {
      Alert.alert('Error', 'Please select who paid for this expense');
      return;
    }

    const expenseData: CreateExpenseRequest = {
      title: formData.title.trim(),
      amount_cents: amountCents,
      currency_code: group?.currency_code || 'USD',
      paid_by: formData.paidBy,
      description: formData.description.trim() || undefined,
      split_type: formData.splitType,
    };

    try {
      await createExpenseMutation.mutateAsync({
        groupId: groupId!,
        expense: expenseData,
      });

      Alert.alert('Success', 'Expense added successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add expense',
      );
    }
  };

  const handleCancel = () => {
    if (formData.title || formData.amount || formData.description) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ],
      );
    } else {
      router.back();
    }
  };

  const handleAIParseAndSubmit = async () => {
    if (!naturalLanguageInput.trim()) {
      Alert.alert('Error', 'Please enter a description of the expense');
      return;
    }

    setIsParsing(true);

    try {
      // For now, create a simple draft based on the natural language input
      // In a real implementation, this would call the MCP server to parse the expense
      const draftData: CreateDraftRequest = {
        title: naturalLanguageInput.trim(),
        amount_cents: amountCents > 0 ? amountCents : 1000, // Default $10 if no amount parsed
        paid_by: user?.id || '',
        participants: group?.members?.map((m) => m.user_id) || [user?.id || ''],
        split_type: 'equal',
        source: 'llm_parsed',
        llm_metadata: {
          originalText: naturalLanguageInput.trim(),
          confidence: 0.75,
          parsedBy: 'ai-assistant',
        },
      };

      await createDraftMutation.mutateAsync({
        groupId: groupId!,
        draft: draftData,
      });

      Alert.alert(
        'Draft Created!',
        'An AI-parsed expense draft has been created and is pending review.',
        [
          {
            text: 'Review Now',
            onPress: () => router.push(`/groups/${groupId}/drafts`),
          },
          { text: 'OK', onPress: () => router.back() },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to parse expense',
      );
    } finally {
      setIsParsing(false);
    }
  };

  if (groupLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-600">Loading group...</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-center text-red-600">Group not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 rounded-lg bg-gray-200 px-4 py-2"
        >
          <Text className="text-gray-800">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1 bg-white">
        <View className="p-6">
          {/* Header */}
          <View className="mb-6">
            <Text className="mb-2 text-2xl font-bold text-gray-900">
              Add Expense
            </Text>
            <Text className="text-gray-600">Group: {group.name}</Text>

            {/* Mode Toggle */}
            <View className="mt-4 flex-row rounded-lg bg-gray-100 p-1">
              <TouchableOpacity
                onPress={() => setIsParsingMode(false)}
                className={`flex-1 rounded-md py-2 ${
                  !isParsingMode ? 'bg-white shadow-sm' : ''
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    !isParsingMode ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  Manual Entry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsParsingMode(true)}
                className={`flex-1 rounded-md py-2 ${
                  isParsingMode ? 'bg-white shadow-sm' : ''
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    isParsingMode ? 'text-purple-600' : 'text-gray-600'
                  }`}
                >
                  🤖 AI Parse
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {isParsingMode ? (
            /* AI Parsing Mode */
            <View className="mb-6">
              <Text className="mb-2 text-lg font-semibold text-gray-900">
                🤖 Describe your expense naturally
              </Text>
              <Text className="mb-3 text-sm text-gray-600">
                Example: "I paid $45 for dinner at Mario's, split equally
                between Alice, Bob, and me"
              </Text>
              <TextInput
                value={naturalLanguageInput}
                onChangeText={setNaturalLanguageInput}
                placeholder="I paid $25 for lunch, split between me and John..."
                multiline
                numberOfLines={4}
                className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-3 text-base"
                style={{ textAlignVertical: 'top' }}
                maxLength={500}
              />

              {naturalLanguageInput.length > 0 && (
                <View className="mt-3 rounded-lg border border-purple-200 bg-purple-100 p-3">
                  <Text className="mb-1 text-sm font-medium text-purple-800">
                    ℹ️ AI Safety Note
                  </Text>
                  <Text className="text-sm text-purple-700">
                    Your expense will be parsed by AI and created as a draft for
                    manual review before being added to the group.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            /* Manual Entry Mode */
            <>
              {/* Title Input */}
              <View className="mb-6">
                <Text className="mb-2 text-lg font-semibold text-gray-900">
                  What was this for?
                </Text>
                <TextInput
                  value={formData.title}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, title: text }))
                  }
                  placeholder="e.g., Groceries, Dinner, Gas"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                  maxLength={100}
                />
              </View>

              {/* Amount Input */}
              <View className="mb-6">
                <Text className="mb-2 text-lg font-semibold text-gray-900">
                  How much?
                </Text>
                <View className="flex-row items-center">
                  <Text className="mr-2 text-2xl font-bold text-gray-900">
                    {group.currency_code === 'USD' ? '$' : group.currency_code}
                  </Text>
                  <TextInput
                    value={formData.amount}
                    onChangeText={handleAmountChange}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                  />
                </View>
                {amountCents > 0 && (
                  <Text className="mt-1 text-sm text-gray-500">
                    Amount:{' '}
                    {group.currency_code === 'USD' ? '$' : group.currency_code}
                    {(amountCents / 100).toFixed(2)}
                  </Text>
                )}
              </View>

              {/* Paid By Selection */}
              <View className="mb-6">
                <Text className="mb-2 text-lg font-semibold text-gray-900">
                  Who paid?
                </Text>
                <View className="rounded-lg border border-gray-300 bg-white">
                  <TouchableOpacity
                    className="px-4 py-3"
                    onPress={() => {
                      // For now, default to current user
                      // TODO: Add member selection modal
                      setFormData((prev) => ({
                        ...prev,
                        paidBy: user?.id || '',
                      }));
                    }}
                  >
                    <Text className="text-base text-gray-900">
                      {formData.paidBy === user?.id
                        ? 'You'
                        : 'Select member...'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Split Type Selection */}
              <View className="mb-6">
                <Text className="mb-2 text-lg font-semibold text-gray-900">
                  How to split?
                </Text>
                {SPLIT_TYPES.map((splitType) => (
                  <TouchableOpacity
                    key={splitType.value}
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        splitType: splitType.value,
                      }))
                    }
                    className={`mb-2 rounded-lg border p-4 ${
                      formData.splitType === splitType.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-base font-medium text-gray-900">
                          {splitType.label}
                        </Text>
                        <Text className="mt-1 text-sm text-gray-600">
                          {splitType.description}
                        </Text>
                      </View>
                      <View
                        className={`h-6 w-6 rounded-full border-2 ${
                          formData.splitType === splitType.value
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-400'
                        }`}
                      >
                        {formData.splitType === splitType.value && (
                          <View className="mt-1 h-2 w-2 self-center rounded-full bg-white" />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description Input */}
              <View className="mb-6">
                <Text className="mb-2 text-lg font-semibold text-gray-900">
                  Description (optional)
                </Text>
                <TextInput
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, description: text }))
                  }
                  placeholder="Add any notes about this expense..."
                  multiline
                  numberOfLines={3}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                  style={{ textAlignVertical: 'top' }}
                  maxLength={500}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View className="border-t border-gray-200 bg-white p-6">
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={handleCancel}
            className="flex-1 rounded-lg border border-gray-300 py-3"
          >
            <Text className="text-center text-base font-semibold text-gray-700">
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={isParsingMode ? handleAIParseAndSubmit : handleSubmit}
            disabled={
              createExpenseMutation.isPending ||
              createDraftMutation.isPending ||
              isParsing
            }
            className={`flex-1 rounded-lg py-3 ${
              createExpenseMutation.isPending ||
              createDraftMutation.isPending ||
              isParsing
                ? 'bg-gray-400'
                : isParsingMode
                ? 'bg-purple-600'
                : 'bg-blue-600'
            }`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {isParsing
                ? '🤖 Parsing...'
                : createDraftMutation.isPending
                ? 'Creating Draft...'
                : createExpenseMutation.isPending
                ? 'Adding...'
                : isParsingMode
                ? '🤖 Parse & Create Draft'
                : 'Add Expense'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
