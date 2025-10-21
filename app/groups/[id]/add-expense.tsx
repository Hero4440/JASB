import { Ionicons } from '@expo/vector-icons';
import type {
  CreateDraftRequest,
  CreateExpenseRequest,
  SplitType,
  UpdateExpenseRequest,
} from '@shared/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { MemberSelectionModal } from '@/components/MemberSelectionModal';
import {
  useCreateDraft,
  useCreateExpense,
  useExpense,
  useGroup,
  useUpdateExpense,
} from '@/lib/api';

import { useAuth } from '../../_layout';

const SPLIT_TYPES: { value: SplitType; label: string; description: string }[] =
  [
    {
      value: 'equal',
      label: 'Equal Split',
      description: 'Split equally among all members',
    },
    {
      value: 'exact',
      label: 'By Amount',
      description: 'Specify exact amounts for each person',
    },
    {
      value: 'percentage',
      label: 'By Shares',
      description: 'Specify shares for each person (proportional split)',
    },
  ];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { id: groupId, editId } = useLocalSearchParams<{
    id: string;
    editId?: string;
  }>();
  const { user } = useAuth();
  const isEditMode = !!editId;

  const { data: group, isLoading: groupLoading } = useGroup(groupId!);
  const { data: existingExpense, isLoading: expenseLoading } = useExpense(
    editId || '',
  );
  const createExpenseMutation = useCreateExpense();
  const updateExpenseMutation = useUpdateExpense();
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
  const [showMemberSelection, setShowMemberSelection] = useState(false);
  const [memberAmounts, setMemberAmounts] = useState<Record<string, string>>(
    {},
  );
  const [memberShares, setMemberShares] = useState<Record<string, string>>({});

  // Pre-fill form data when editing an existing expense
  useEffect(() => {
    if (isEditMode && existingExpense) {
      const existingExpenseAmountCents =
        existingExpense.amount_cents ??
        Math.round((existingExpense.amount ?? 0) * 100);
      const amountDollars = existingExpenseAmountCents / 100;

      let uiSplitType: SplitType;
      if (existingExpense.split_type === 'amount') {
        uiSplitType = 'exact';
      } else if (existingExpense.split_type === 'share') {
        uiSplitType = 'percentage';
      } else {
        uiSplitType = existingExpense.split_type;
      }

      setFormData({
        title: existingExpense.title || existingExpense.description || '',
        amount: amountDollars.toString(),
        description: existingExpense.description || '',
        splitType: uiSplitType,
        paidBy: existingExpense.paid_by,
      });
      setAmountCents(existingExpenseAmountCents);

      if (uiSplitType === 'exact') {
        if (existingExpense.member_amounts) {
          setMemberAmounts(existingExpense.member_amounts);
        } else if (existingExpense.splits) {
          const amounts: Record<string, string> = {};
          existingExpense.splits.forEach((split) => {
            const splitAmountCents =
              split.amount_cents ?? Math.round((split.amount ?? 0) * 100);
            amounts[split.user_id] = (splitAmountCents / 100).toString();
          });
          setMemberAmounts(amounts);
        }
      }

      if (uiSplitType === 'percentage') {
        if (existingExpense.member_shares) {
          setMemberShares(existingExpense.member_shares);
        } else if (existingExpense.splits) {
          const shares: Record<string, string> = {};
          existingExpense.splits.forEach((split) => {
            const splitAmountCents =
              split.amount_cents ?? Math.round((split.amount ?? 0) * 100);
            const sharePercentage =
              existingExpenseAmountCents > 0
                ? (splitAmountCents / existingExpenseAmountCents) * 100
                : 0;
            shares[split.user_id] = Math.round(sharePercentage).toString();
          });
          setMemberShares(shares);
        }
      }
    }
  }, [isEditMode, existingExpense]);

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

  const getSelectedMemberName = () => {
    if (!formData.paidBy) return 'Select member...';

    if (formData.paidBy === user?.id) {
      return 'You';
    }

    const member = group?.members?.find((m) => m.user_id === formData.paidBy);
    return member?.user?.name || member?.user?.email || 'Unknown Member';
  };

  const handleMemberAmountChange = (userId: string, text: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    const formatted =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;

    setMemberAmounts((prev) => ({
      ...prev,
      [userId]: formatted,
    }));
  };

  const calculateTotalFromMemberAmounts = () => {
    const total = Object.values(memberAmounts).reduce((sum, amount) => {
      return sum + (parseFloat(amount) || 0);
    }, 0);
    return total;
  };

  const calculateRemainingAmount = () => {
    const originalAmount = parseFloat(formData.amount) || 0;
    const totalFromMembers = calculateTotalFromMemberAmounts();
    return originalAmount - totalFromMembers;
  };

  const handleMemberShareChange = (userId: string, text: string) => {
    // Allow only whole numbers for shares
    const cleaned = text.replace(/[^0-9]/g, '');

    setMemberShares((prev) => ({
      ...prev,
      [userId]: cleaned,
    }));
  };

  const calculateTotalShares = () => {
    const total = Object.values(memberShares).reduce((sum, shares) => {
      return sum + (parseInt(shares, 10) || 0);
    }, 0);
    return total;
  };

  const calculateAmountFromShares = (userId: string) => {
    const totalAmount = parseFloat(formData.amount) || 0;
    const userShares = parseInt(memberShares[userId] ?? '0', 10) || 0;
    const totalShares = calculateTotalShares();

    if (totalShares === 0) return 0;

    return (totalAmount * userShares) / totalShares;
  };

  const getTotalCentsFromMembers = () => {
    return Math.round(calculateTotalFromMemberAmounts() * 100);
  };

  const getMemberDisplayName = (member: any) => {
    if (member.user_id === user?.id) {
      return 'You';
    }
    return member.user?.name || member.user?.email || 'Unknown User';
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter an expense title');
      return;
    }

    // Validate amount based on split type
    let finalAmountCents = amountCents;
    if (formData.splitType === 'exact') {
      finalAmountCents = getTotalCentsFromMembers();
      if (finalAmountCents <= 0) {
        Alert.alert('Error', 'Please enter valid amounts for all members');
        return;
      }

      // Auto-fill empty amounts with $0 and validate
      const hasInvalidAmounts = group?.members?.some((member) => {
        const amount = memberAmounts[member.user_id] || '0';
        return Number.isNaN(parseFloat(amount));
      });

      if (hasInvalidAmounts) {
        Alert.alert('Error', 'Please enter valid amounts for all members');
        return;
      }

      // Auto-fill any missing amounts with 0
      const updatedMemberAmounts = { ...memberAmounts };
      group?.members?.forEach((member) => {
        if (
          !updatedMemberAmounts[member.user_id] ||
          updatedMemberAmounts[member.user_id] === ''
        ) {
          updatedMemberAmounts[member.user_id] = '0';
        }
      });
      setMemberAmounts(updatedMemberAmounts);
    } else if (formData.splitType === 'percentage') {
      // For shares, validate that there are shares entered
      if (finalAmountCents <= 0) {
        Alert.alert('Error', 'Please enter a valid total amount');
        return;
      }

      const totalShares = calculateTotalShares();
      if (totalShares <= 0) {
        Alert.alert(
          'Error',
          'Please enter valid shares for at least one member',
        );
        return;
      }

      // Auto-fill empty shares with 0 and validate
      const hasInvalidShares = group?.members?.some((member) => {
        const shares = memberShares[member.user_id] || '0';
        return Number.isNaN(parseInt(shares, 10));
      });

      if (hasInvalidShares) {
        Alert.alert('Error', 'Please enter valid shares for all members');
        return;
      }

      // Auto-fill any missing shares with 0
      const updatedMemberShares = { ...memberShares };
      group?.members?.forEach((member) => {
        if (
          !updatedMemberShares[member.user_id] ||
          updatedMemberShares[member.user_id] === ''
        ) {
          updatedMemberShares[member.user_id] = '0';
        }
      });
      setMemberShares(updatedMemberShares);
    } else if (finalAmountCents <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!formData.paidBy) {
      Alert.alert('Error', 'Please select who paid for this expense');
      return;
    }

    try {
      if (!groupId) {
        throw new Error('Group ID is required');
      }

      if (isEditMode && editId) {
        // Update existing expense
        const updateData: UpdateExpenseRequest = {
          title: formData.title.trim(),
          amount_cents: finalAmountCents,
          currency_code: group?.currency_code || 'USD',
          paid_by: formData.paidBy,
          description: formData.description.trim() || undefined,
          split_type: formData.splitType,
          // Add member splits for exact split type
          ...(formData.splitType === 'exact' && {
            member_amounts: memberAmounts,
          }),
          // Add member shares for shares split type
          ...(formData.splitType === 'percentage' && {
            member_shares: memberShares,
          }),
        };

        await updateExpenseMutation.mutateAsync({
          expenseId: editId,
          groupId,
          expense: updateData,
        });

        setTimeout(() => {
          Alert.alert('Success', 'Expense updated successfully!', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }, 100);
      } else {
        // Create new expense
        const expenseData: CreateExpenseRequest = {
          title: formData.title.trim(),
          amount_cents: finalAmountCents,
          currency_code: group?.currency_code || 'USD',
          paid_by: formData.paidBy,
          description: formData.description.trim() || undefined,
          split_type: formData.splitType,
          // Add member splits for exact split type
          ...(formData.splitType === 'exact' && {
            member_amounts: memberAmounts,
          }),
          // Add member shares for shares split type
          ...(formData.splitType === 'percentage' && {
            member_shares: memberShares,
          }),
        };

        await createExpenseMutation.mutateAsync({
          groupId,
          expense: expenseData,
        });

        setTimeout(() => {
          Alert.alert('Success', 'Expense added successfully!', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }, 100);
      }
    } catch (error) {
      const actionVerb = isEditMode ? 'update' : 'add';
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : `Failed to ${actionVerb} expense`,
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
      const draftTotalCents = amountCents > 0 ? amountCents : 1000; // Default $10
      const draftSplits = group?.members?.map((member) => ({
        user_id: member.user_id,
        amount_cents: Math.round(
          draftTotalCents / (group?.members?.length || 1),
        ),
      })) || [
        {
          user_id: user?.id || '',
          amount_cents: draftTotalCents,
        },
      ];

      const draftData: CreateDraftRequest = {
        title: naturalLanguageInput.trim(),
        description: naturalLanguageInput.trim(),
        amount_cents: draftTotalCents,
        amount: draftTotalCents / 100,
        paid_by: user?.id || '',
        split_type: 'equal',
        participants: group?.members?.map((member) => member.user_id) || [
          user?.id || '',
        ],
        source: 'manual',
        splits: draftSplits,
      };

      if (!groupId) {
        throw new Error('Group ID is required');
      }

      await createDraftMutation.mutateAsync({
        groupId,
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

  const isAnyMutationPending =
    createExpenseMutation.isPending ||
    updateExpenseMutation.isPending ||
    createDraftMutation.isPending ||
    isParsing;

  let primaryButtonColorClass = 'bg-blue-600';
  if (isAnyMutationPending) {
    primaryButtonColorClass = 'bg-gray-400';
  } else if (isParsingMode) {
    primaryButtonColorClass = 'bg-purple-600';
  }

  let primaryButtonLabel = isEditMode ? 'Update Expense' : 'Add Expense';
  if (isParsing) {
    primaryButtonLabel = '🤖 Parsing...';
  } else if (createDraftMutation.isPending) {
    primaryButtonLabel = 'Creating Draft...';
  } else if (createExpenseMutation.isPending) {
    primaryButtonLabel = 'Adding...';
  } else if (updateExpenseMutation.isPending) {
    primaryButtonLabel = 'Updating...';
  } else if (isParsingMode) {
    primaryButtonLabel = '🤖 Parse & Create Draft';
  }

  if (groupLoading || (isEditMode && expenseLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-600">
          {isEditMode ? 'Loading expense...' : 'Loading group...'}
        </Text>
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
              {isEditMode ? 'Edit Expense' : 'Add Expense'}
            </Text>
            <Text className="text-gray-600">Group: {group.name}</Text>

            {/* Mode Toggle - Hide in edit mode */}
            {!isEditMode && (
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
            )}
          </View>

          {isParsingMode && !isEditMode ? (
            /* AI Parsing Mode */
            <View className="mb-6">
              <Text className="mb-2 text-lg font-semibold text-gray-900">
                🤖 Describe your expense naturally
              </Text>
              <Text className="mb-3 text-sm text-gray-600">
                Example: I paid $45 for dinner at Mario&apos;s, split equally
                between Alice, Bob, and me
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
                <TouchableOpacity
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3"
                  onPress={() => setShowMemberSelection(true)}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-base ${
                        formData.paidBy ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {getSelectedMemberName()}
                    </Text>
                    <View className="ml-2">
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#9ca3af"
                      />
                    </View>
                  </View>
                </TouchableOpacity>
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

              {/* Member Amounts Section (for exact split) */}
              {formData.splitType === 'exact' && group?.members && (
                <View className="mb-6">
                  <Text className="mb-2 text-lg font-semibold text-gray-900">
                    Amount for each member
                  </Text>
                  <Text className="mb-4 text-sm text-gray-600">
                    Enter the exact amount each person owes for this expense
                    (leave blank or enter $0.00 if someone owes nothing)
                  </Text>

                  {group.members.map((member) => (
                    <View key={member.user_id} className="mb-4">
                      <Text className="mb-2 text-base font-medium text-gray-900">
                        {getMemberDisplayName(member)}
                        {member.user?.email && (
                          <Text className="text-sm text-gray-600">
                            {' '}
                            ({member.user.email})
                          </Text>
                        )}
                      </Text>
                      <View className="flex-row items-center">
                        <Text className="mr-2 text-xl font-bold text-gray-900">
                          {group.currency_code === 'USD'
                            ? '$'
                            : group.currency_code}
                        </Text>
                        <TextInput
                          value={memberAmounts[member.user_id] || ''}
                          onChangeText={(text) =>
                            handleMemberAmountChange(member.user_id, text)
                          }
                          placeholder="0.00"
                          keyboardType="decimal-pad"
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                        />
                      </View>
                    </View>
                  ))}

                  {/* Remaining amount display */}
                  {parseFloat(formData.amount) > 0 &&
                    (() => {
                      const remaining = calculateRemainingAmount();
                      const isMatching = Math.abs(remaining) < 0.01;
                      const isExceeding = remaining < 0;
                      let bgColor;
                      if (isMatching) {
                        bgColor = 'bg-green-50';
                      } else if (isExceeding) {
                        bgColor = 'bg-red-50';
                      } else {
                        bgColor = 'bg-yellow-50';
                      }

                      let textColor;
                      if (isMatching) {
                        textColor = 'text-green-800';
                      } else if (isExceeding) {
                        textColor = 'text-red-800';
                      } else {
                        textColor = 'text-yellow-800';
                      }

                      let subTextColor;
                      if (isMatching) {
                        subTextColor = 'text-green-700';
                      } else if (isExceeding) {
                        subTextColor = 'text-red-700';
                      } else {
                        subTextColor = 'text-yellow-700';
                      }

                      let statusMessage;
                      if (isMatching) {
                        statusMessage = '✅ Amounts match perfectly!';
                      } else if (isExceeding) {
                        statusMessage =
                          '⚠️ Member amounts exceed total expense';
                      } else {
                        statusMessage = '💰 Amount still needs to be allocated';
                      }

                      return (
                        <View className={`mt-4 rounded-lg p-3 ${bgColor}`}>
                          <View className="flex-row items-center justify-between">
                            <Text
                              className={`text-base font-medium ${textColor}`}
                            >
                              Remaining amount:
                            </Text>
                            <Text className={`text-lg font-bold ${textColor}`}>
                              {group.currency_code === 'USD'
                                ? '$'
                                : group.currency_code}
                              {remaining.toFixed(2)}
                            </Text>
                          </View>
                          <Text className={`mt-1 text-sm ${subTextColor}`}>
                            {statusMessage}
                          </Text>
                        </View>
                      );
                    })()}
                </View>
              )}

              {/* Member Shares Section (for shares split) */}
              {formData.splitType === 'percentage' && group?.members && (
                <View className="mb-6">
                  <Text className="mb-2 text-lg font-semibold text-gray-900">
                    Shares for each member
                  </Text>
                  <Text className="mb-4 text-sm text-gray-600">
                    Enter the number of shares for each person. The total amount
                    will be divided proportionally. (leave blank or enter 0 if
                    someone gets no shares)
                  </Text>

                  {group.members.map((member) => (
                    <View key={member.user_id} className="mb-4">
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-base font-medium text-gray-900">
                          {getMemberDisplayName(member)}
                          {member.user?.email && (
                            <Text className="text-sm text-gray-600">
                              {' '}
                              ({member.user.email})
                            </Text>
                          )}
                        </Text>
                        {(() => {
                          const hasAmount = parseFloat(formData.amount) > 0;
                          const hasShares = calculateTotalShares() > 0;
                          if (hasAmount && hasShares) {
                            return (
                              <Text className="text-sm font-medium text-blue-600">
                                {group.currency_code === 'USD'
                                  ? '$'
                                  : group.currency_code}
                                {calculateAmountFromShares(
                                  member.user_id,
                                ).toFixed(2)}
                              </Text>
                            );
                          }
                          return null;
                        })()}
                      </View>
                      <View className="flex-row items-center">
                        <TextInput
                          value={memberShares[member.user_id] || ''}
                          onChangeText={(text) =>
                            handleMemberShareChange(member.user_id, text)
                          }
                          placeholder="0"
                          keyboardType="number-pad"
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                        />
                        <Text className="ml-2 text-base text-gray-600">
                          shares
                        </Text>
                      </View>
                    </View>
                  ))}

                  {/* Shares summary */}
                  {calculateTotalShares() > 0 &&
                    parseFloat(formData.amount) > 0 && (
                      <View className="mt-4 rounded-lg bg-purple-50 p-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-base font-medium text-purple-900">
                            Total shares:
                          </Text>
                          <Text className="text-lg font-bold text-purple-900">
                            {calculateTotalShares()}
                          </Text>
                        </View>
                        <Text className="mt-1 text-sm text-purple-700">
                          Each share ={' '}
                          {group.currency_code === 'USD'
                            ? '$'
                            : group.currency_code}
                          {(
                            parseFloat(formData.amount) / calculateTotalShares()
                          ).toFixed(2)}
                        </Text>
                      </View>
                    )}
                </View>
              )}

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
            disabled={isAnyMutationPending}
            className={`flex-1 rounded-lg py-3 ${primaryButtonColorClass}`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {primaryButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Member Selection Modal */}
      {group && (
        <MemberSelectionModal
          group={group}
          selectedUserId={formData.paidBy}
          visible={showMemberSelection}
          onClose={() => setShowMemberSelection(false)}
          onSelectMember={(userId) => {
            setFormData((prev) => ({ ...prev, paidBy: userId }));
          }}
          currentUser={user}
        />
      )}
    </KeyboardAvoidingView>
  );
}
