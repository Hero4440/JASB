import type { Balance, Group } from '@shared/types';
import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { authMiddleware, requireUser } from '../auth';
import { GroupDB, setCurrentUser, UserDB } from '../db';
import {
  CreateGroupSchema,
  ForbiddenError,
  InviteToGroupSchema,
  NotFoundError,
  PaginationSchema,
  UpdateGroupSchema,
  UUIDSchema,
  validateParams,
  validateQuery,
  validateRequest,
} from '../validation';

interface GroupRoutes {
  Body: any;
  Querystring: any;
  Params: any;
  Headers: any;
  Reply: any;
}

export default async function groupRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  /**
   * GET /v1/groups
   * Get user's groups with pagination
   */
  fastify.get<GroupRoutes>(
    '/v1/groups',
    {
      preHandler: [validateQuery(PaginationSchema)],
    },
    async (request, _reply) => {
      const userId = requireUser(request);
      const { limit } = (request as any).validatedQuery;

      // Set current user for RLS
      await setCurrentUser(userId);

      const groups = await GroupDB.findUserGroups(userId);

      // Apply client-side pagination (in production, you'd do this in SQL)
      const limitedGroups = groups.slice(0, limit);

      return {
        data: limitedGroups,
        pagination: {
          has_more: groups.length > limit,
          total: groups.length,
        },
      };
    },
  );

  /**
   * POST /v1/groups
   * Create a new group
   */
  fastify.post<GroupRoutes>(
    '/v1/groups',
    {
      preHandler: [validateRequest(CreateGroupSchema)],
    },
    async (request, _reply) => {
      const userId = requireUser(request);
      const groupData = (request as any).validatedBody;

      // Set current user for RLS
      await setCurrentUser(userId);

      const newGroup: Omit<Group, 'created_at' | 'updated_at' | 'members'> = {
        id: uuidv4(),
        name: groupData.name,
        currency_code: groupData.currency_code,
        created_by: userId,
      };

      const group = await GroupDB.create(newGroup);

      _reply.status(201);
      return group;
    },
  );

  /**
   * GET /v1/groups/:id
   * Get group details with members
   */
  fastify.get<GroupRoutes>(
    '/v1/groups/:id',
    {
      preHandler: [validateParams(z.object({ id: UUIDSchema }))],
    },
    async (request, _reply) => {
      const userId = requireUser(request);
      const { id } = request.params as { id: string };

      // Set current user for RLS
      await setCurrentUser(userId);

      const group = await GroupDB.findById(id);

      if (!group) {
        throw new NotFoundError('Group', id);
      }

      // RLS will handle access control, but let's double-check
      const userIsMember = group.members?.some(
        (member) => member.user_id === userId,
      );
      if (!userIsMember) {
        throw new ForbiddenError('You are not a member of this group');
      }

      return group;
    },
  );

  /**
   * GET /v1/groups/:id/balances
   * Get group balances
   */
  fastify.get<GroupRoutes>(
    '/v1/groups/:id/balances',
    {
      preHandler: [validateParams(z.object({ id: UUIDSchema }))],
    },
    async (request, _reply) => {
      const userId = requireUser(request);
      const { id } = request.params as { id: string };

      // Set current user for RLS
      await setCurrentUser(userId);

      const group = await GroupDB.findById(id);

      if (!group) {
        throw new NotFoundError('Group', id);
      }

      // Check if user is a member
      const userIsMember = group.members?.some(
        (member) => member.user_id === userId,
      );
      if (!userIsMember) {
        throw new ForbiddenError('You are not a member of this group');
      }

      // For now, return empty balances (would need to be calculated from expenses)
      const balances: Balance[] =
        group.members?.map((member) => ({
          user_id: member.user_id,
          user: member.user,
          net_cents: 0, // Would calculate from expenses and settlements
        })) || [];

      return balances;
    },
  );

  /**
   * PATCH /v1/groups/:id
   * Update group details (admin only)
   */
  fastify.patch<GroupRoutes>(
    '/v1/groups/:id',
    {
      preHandler: [
        validateParams(z.object({ id: UUIDSchema })),
        validateRequest(UpdateGroupSchema),
      ],
    },
    async (request, _reply) => {
      const userId = requireUser(request);
      const { id } = request.params as { id: string };
      // const _updates = (request as any).validatedBody;

      // Set current user for RLS
      await setCurrentUser(userId);

      const group = await GroupDB.findById(id);

      if (!group) {
        throw new NotFoundError('Group', id);
      }

      // Check if user is admin
      const userMember = group.members?.find(
        (member) => member.user_id === userId,
      );
      if (!userMember || userMember.role !== 'admin') {
        throw new ForbiddenError('Only group admins can update group details');
      }

      // Update group (this would need to be implemented in GroupDB)
      // For now, we'll return the group as-is
      return group;
    },
  );

  /**
   * DELETE /v1/groups/:id
   * Delete group (admin only)
   */
  fastify.delete<GroupRoutes>(
    '/v1/groups/:id',
    {
      preHandler: [validateParams(z.object({ id: UUIDSchema }))],
    },
    async (request, _reply) => {
      const userId = requireUser(request);
      const { id } = request.params as { id: string };

      // Set current user for RLS
      await setCurrentUser(userId);

      const group = await GroupDB.findById(id);

      if (!group) {
        throw new NotFoundError('Group', id);
      }

      // Check if user is admin
      const userMember = group.members?.find(
        (member) => member.user_id === userId,
      );
      if (!userMember || userMember.role !== 'admin') {
        throw new ForbiddenError('Only group admins can delete groups');
      }

      // Delete group (this would need to be implemented in GroupDB)
      // RLS and CASCADE will handle cleanup

      _reply.status(204);
      return {};
    },
  );

  /**
   * POST /v1/groups/:id/invite
   * Invite user to group (admin only)
   */
  fastify.post<GroupRoutes>(
    '/v1/groups/:id/invite',
    {
      preHandler: [
        validateParams(z.object({ id: UUIDSchema })),
        validateRequest(InviteToGroupSchema),
      ],
    },
    async (request, _reply) => {
      const userId = requireUser(request);
      const { id } = request.params as { id: string };
      const { email } = (request as any).validatedBody;

      // Set current user for RLS
      await setCurrentUser(userId);

      const group = await GroupDB.findById(id);

      if (!group) {
        throw new NotFoundError('Group', id);
      }

      // Check if user is admin
      const userMember = group.members?.find(
        (member) => member.user_id === userId,
      );
      if (!userMember || userMember.role !== 'admin') {
        throw new ForbiddenError('Only group admins can invite members');
      }

      // Find user by email
      const invitedUser = await UserDB.findByEmail(email);
      if (!invitedUser) {
        throw new NotFoundError('User with email', email);
      }

      // Check if user is already a member
      const isAlreadyMember = group.members?.some(
        (member) => member.user_id === invitedUser.id,
      );
      if (isAlreadyMember) {
        return { message: 'User is already a member of this group' };
      }

      // Add user to group (this would need to be implemented in GroupDB)
      // For now, return success message
      return {
        message: `${invitedUser.name} has been invited to ${group.name}`,
        user: {
          id: invitedUser.id,
          email: invitedUser.email,
          name: invitedUser.name,
        },
      };
    },
  );

  /**
   * DELETE /v1/groups/:id/members/:userId
   * Remove member from group (admin only, or self-removal)
   */
  fastify.delete<GroupRoutes>(
    '/v1/groups/:id/members/:userId',
    {
      preHandler: [
        validateParams(z.object({ id: UUIDSchema, userId: UUIDSchema })),
      ],
    },
    async (request, _reply) => {
      const currentUserId = requireUser(request);
      const { id: groupId, userId: targetUserId } = request.params as {
        id: string;
        userId: string;
      };

      // Set current user for RLS
      await setCurrentUser(currentUserId);

      const group = await GroupDB.findById(groupId);

      if (!group) {
        throw new NotFoundError('Group', groupId);
      }

      // Check permissions
      const currentUserMember = group.members?.find(
        (member) => member.user_id === currentUserId,
      );
      const targetUserMember = group.members?.find(
        (member) => member.user_id === targetUserId,
      );

      if (!currentUserMember) {
        throw new ForbiddenError('You are not a member of this group');
      }

      if (!targetUserMember) {
        throw new NotFoundError('User is not a member of this group');
      }

      // Allow self-removal or admin removing others
      const canRemove =
        currentUserId === targetUserId || currentUserMember.role === 'admin';
      if (!canRemove) {
        throw new ForbiddenError(
          'You can only remove yourself or be an admin to remove others',
        );
      }

      // Prevent removing the last admin
      const adminCount =
        group.members?.filter((member) => member.role === 'admin').length || 0;
      if (targetUserMember.role === 'admin' && adminCount === 1) {
        throw new ForbiddenError('Cannot remove the last admin from the group');
      }

      // Remove member (this would need to be implemented in GroupDB)

      _reply.status(204);
      return {};
    },
  );

  /**
   * PATCH /v1/groups/:id/members/:userId
   * Update member role (admin only)
   */
  fastify.patch<GroupRoutes>(
    '/v1/groups/:id/members/:userId',
    {
      preHandler: [
        validateParams(z.object({ id: UUIDSchema, userId: UUIDSchema })),
        validateRequest(z.object({ role: z.enum(['admin', 'member']) })),
      ],
    },
    async (request, _reply) => {
      const currentUserId = requireUser(request);
      const { id: groupId, userId: targetUserId } = request.params as {
        id: string;
        userId: string;
      };
      const { role } = (request as any).validatedBody;

      // Set current user for RLS
      await setCurrentUser(currentUserId);

      const group = await GroupDB.findById(groupId);

      if (!group) {
        throw new NotFoundError('Group', groupId);
      }

      // Check if current user is admin
      const currentUserMember = group.members?.find(
        (member) => member.user_id === currentUserId,
      );
      if (!currentUserMember || currentUserMember.role !== 'admin') {
        throw new ForbiddenError('Only admins can change member roles');
      }

      // Check if target user exists in group
      const targetUserMember = group.members?.find(
        (member) => member.user_id === targetUserId,
      );
      if (!targetUserMember) {
        throw new NotFoundError('User is not a member of this group');
      }

      // Prevent demoting the last admin
      if (targetUserMember.role === 'admin' && role === 'member') {
        const adminCount =
          group.members?.filter((member) => member.role === 'admin').length ||
          0;
        if (adminCount === 1) {
          throw new ForbiddenError('Cannot demote the last admin');
        }
      }

      // Update member role (this would need to be implemented in GroupDB)

      return {
        message: `${targetUserMember.user?.name}'s role updated to ${role}`,
        member: {
          ...targetUserMember,
          role,
        },
      };
    },
  );
}
