import { Ionicons } from '@expo/vector-icons';
import type { Group } from '@shared/types';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getErrorMessage, useInviteToGroup, useRemoveFromGroup } from '../lib/api';
import { useAuth } from '../../app/_layout';

interface ManageMembersModalProps {
  group: Group;
  visible: boolean;
  onClose: () => void;
}

export function ManageMembersModal({
  group,
  visible,
  onClose,
}: ManageMembersModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const inviteToGroupMutation = useInviteToGroup();
  const removeFromGroupMutation = useRemoveFromGroup();

  const handleInvite = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsInviting(true);
    try {
      await inviteToGroupMutation.mutateAsync({
        groupId: group.id,
        email: email.trim().toLowerCase(),
      });

      Alert.alert('Success', `Invitation sent to ${email}`, [
        { text: 'OK' }
      ]);
      setEmail('');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (memberId === group.created_by) {
      Alert.alert('Error', 'Cannot remove the group creator');
      return;
    }

    if (memberId === user?.id) {
      Alert.alert('Error', 'Cannot remove yourself from the group');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromGroupMutation.mutateAsync({
                groupId: group.id,
                userId: memberId,
              });
              Alert.alert('Success', `${memberName} has been removed from the group`);
            } catch (error) {
              Alert.alert('Error', getErrorMessage(error));
            }
          },
        },
      ],
    );
  };

  const isGroupAdmin = group.created_by === user?.id;

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
              Manage Members
            </Text>
            <Pressable
              onPress={onClose}
              className="rounded-full bg-gray-100 p-2"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </Pressable>
          </View>
          <Text className="mt-1 text-sm text-gray-600">{group.name}</Text>
        </View>

        <ScrollView className="flex-1">
          {/* Add Member Section */}
          {isGroupAdmin && (
            <View className="mx-4 mt-4 rounded-xl bg-white p-6 shadow-sm">
              <Text className="mb-4 text-lg font-semibold text-gray-900">
                Invite New Member
              </Text>

              <View className="mb-4">
                <Text className="mb-2 text-sm font-medium text-gray-700">
                  Email Address
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter email address"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="rounded-lg border border-gray-300 px-4 py-3 text-base"
                  editable={!isInviting}
                />
              </View>

              <Pressable
                onPress={handleInvite}
                disabled={isInviting || !email.trim()}
                className={`rounded-lg p-4 ${
                  isInviting || !email.trim()
                    ? 'bg-gray-300'
                    : 'bg-blue-600'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isInviting || !email.trim()
                      ? 'text-gray-500'
                      : 'text-white'
                  }`}
                >
                  {isInviting ? 'Sending Invitation...' : 'Send Invitation'}
                </Text>
              </Pressable>

              <Text className="mt-2 text-xs text-gray-500">
                If the email doesn't exist, a new account will be created automatically.
              </Text>
            </View>
          )}

          {/* Current Members Section */}
          <View className="mx-4 mt-4 rounded-xl bg-white shadow-sm">
            <View className="border-b border-gray-100 px-6 py-4">
              <Text className="text-lg font-semibold text-gray-900">
                Current Members ({group.members?.length || 0})
              </Text>
            </View>

            {group.members?.map((member, index) => (
              <View
                key={member.user_id}
                className={`flex-row items-center justify-between px-6 py-4 ${
                  index < (group.members?.length || 1) - 1
                    ? 'border-b border-gray-100'
                    : ''
                }`}
              >
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-medium text-gray-900">
                      {member.user?.name || member.user?.email || 'Unknown User'}
                    </Text>
                    {member.user_id === group.created_by && (
                      <View className="ml-2 rounded-full bg-blue-100 px-2 py-1">
                        <Text className="text-xs font-medium text-blue-800">
                          Admin
                        </Text>
                      </View>
                    )}
                    {member.user_id === user?.id && (
                      <View className="ml-2 rounded-full bg-green-100 px-2 py-1">
                        <Text className="text-xs font-medium text-green-800">
                          You
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-gray-600">
                    {member.user?.email}
                  </Text>
                </View>

                {isGroupAdmin &&
                  member.user_id !== group.created_by &&
                  member.user_id !== user?.id && (
                    <Pressable
                      onPress={() =>
                        handleRemoveMember(
                          member.user_id,
                          member.user?.name || member.user?.email || 'User',
                        )
                      }
                      disabled={removeFromGroupMutation.isPending}
                      className="rounded-full bg-red-100 p-2"
                    >
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    </Pressable>
                  )}
              </View>
            ))}

            {(!group.members || group.members.length === 0) && (
              <View className="px-6 py-8">
                <Text className="text-center text-gray-500">
                  No members found
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
                  Member Management
                </Text>
                <Text className="mt-1 text-sm text-blue-700">
                  {isGroupAdmin
                    ? 'As the group admin, you can invite new members and remove existing ones. Members can view and add expenses to this group.'
                    : 'Only the group admin can manage members. Contact the admin to invite new members or make changes.'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}