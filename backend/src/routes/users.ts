import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authMiddleware, requireUser } from '../auth';
import { setCurrentUser, UserDB } from '../db';
import {
  NotFoundError,
  UUIDSchema,
  validateParams,
  validateRequest,
} from '../validation';

interface UserRoutes {
  Body: any;
  Querystring: any;
  Params: any;
  Headers: any;
  Reply: any;
}

// Validation schemas
const CreateUserSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  name: z.string().min(1).max(100),
  avatar_url: z.string().url().optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
});

export default async function userRoutes(fastify: FastifyInstance) {
  // All routes require authentication except create
  fastify.addHook('preHandler', authMiddleware);

  /**
   * POST /v1/users
   * Create user profile (called after Supabase registration)
   */
  fastify.post<UserRoutes>(
    '/v1/users',
    {
      preHandler: [validateRequest(CreateUserSchema)],
    },
    async (request, reply) => {
      const userData = (request as any).validatedBody;

      try {
        // Check if user already exists
        const existingUser = await UserDB.findById(userData.id);
        if (existingUser) {
          return existingUser;
        }

        // Create new user profile
        const user = await UserDB.create({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          avatar_url: userData.avatar_url || null,
        });

        reply.status(201);
        return user;
      } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key')) {
          // User already exists, fetch and return
          const existingUser = await UserDB.findById(userData.id);
          return existingUser;
        }
        throw error;
      }
    },
  );

  /**
   * GET /v1/users/me
   * Get current user profile
   */
  fastify.get<UserRoutes>('/v1/users/me', async (request, _reply) => {
    const userId = requireUser(request);

    // Set current user for RLS
    await setCurrentUser(userId);

    const user = await UserDB.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return user;
  });

  /**
   * PATCH /v1/users/me
   * Update current user profile
   */
  fastify.patch<UserRoutes>(
    '/v1/users/me',
    {
      preHandler: [validateRequest(UpdateUserSchema)],
    },
    async (request, _reply) => {
      const userId = requireUser(request);
      const updates = (request as any).validatedBody;

      // Set current user for RLS
      await setCurrentUser(userId);

      const user = await UserDB.update(userId, updates);

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      return user;
    },
  );

  /**
   * GET /v1/users/:id
   * Get user profile by ID (for group members, etc.)
   */
  fastify.get<UserRoutes>(
    '/v1/users/:id',
    {
      preHandler: [validateParams(z.object({ id: UUIDSchema }))],
    },
    async (request, _reply) => {
      const currentUserId = requireUser(request);
      const { id } = request.params as { id: string };

      // Set current user for RLS
      await setCurrentUser(currentUserId);

      const user = await UserDB.findById(id);

      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Return limited user info for privacy
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      };
    },
  );
}
