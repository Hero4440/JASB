import { Ionicons } from '@expo/vector-icons';
import type { Group, User } from '@shared/types';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

interface MemberSelectionModalProps {
  group: Group;
  selectedUserId: string;
  visible: boolean;
  onClose: () => void;
  onSelectMember: (userId: string) => void;
  currentUser?: User;
}

export function MemberSelectionModal({
  group,
  selectedUserId,
  visible,
  onClose,
  onSelectMember,
  currentUser,
}: MemberSelectionModalProps) {
  const handleSelectMember = (userId: string) => {
    onSelectMember(userId);
    onClose();
  };

  const getMemberDisplayName = (member: any) => {
    if (member.user_id === currentUser?.id) {
      return 'You';
    }
    return member.user?.name || member.user?.email || 'Unknown User';
  };

  const getMemberEmail = (member: any) => {
    if (member.user_id === currentUser?.id) {
      return currentUser.email;
    }
    return member.user?.email;
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
              Who Paid?
            </Text>
            <Pressable
              onPress={onClose}
              className="rounded-full bg-gray-100 p-2"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </Pressable>
          </View>
          <Text className="mt-1 text-sm text-gray-600">
            Select the person who paid for this expense
          </Text>
        </View>

        <ScrollView className="flex-1">
          <View className="mx-4 mt-4 rounded-xl bg-white shadow-sm">
            <View className="border-b border-gray-100 px-6 py-4">
              <Text className="text-lg font-semibold text-gray-900">
                Group Members ({group.members?.length || 0})
              </Text>
            </View>

            {group.members?.map((member, index) => (
              <Pressable
                key={member.user_id}
                onPress={() => handleSelectMember(member.user_id)}
                className={`flex-row items-center justify-between px-6 py-4 ${
                  index < (group.members?.length || 1) - 1
                    ? 'border-b border-gray-100'
                    : ''
                }`}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#f3f4f6' : 'transparent',
                })}
              >
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-medium text-gray-900">
                      {getMemberDisplayName(member)}
                    </Text>
                    {member.user_id === group.created_by && (
                      <View className="ml-2 rounded-full bg-blue-100 px-2 py-1">
                        <Text className="text-xs font-medium text-blue-800">
                          Admin
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-gray-600">
                    {getMemberEmail(member)}
                  </Text>
                </View>

                {/* Selection indicator */}
                <View className="ml-4">
                  {selectedUserId === member.user_id ? (
                    <View className="flex-row items-center">
                      <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
                    </View>
                  ) : (
                    <View className="h-6 w-6 rounded-full border-2 border-gray-300" />
                  )}
                </View>
              </Pressable>
            ))}

            {(!group.members || group.members.length === 0) && (
              <View className="px-6 py-8">
                <Text className="text-center text-gray-500">
                  No members found in this group
                </Text>
              </View>
            )}
          </View>

          {/* Info Section */}
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
                  Who Paid This Expense?
                </Text>
                <Text className="mt-1 text-sm text-blue-700">
                  Select the person who actually paid for this expense. This will be used to calculate who owes money to whom when settling up.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}