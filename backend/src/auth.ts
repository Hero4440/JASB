import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
// import { createClient } from '@supabase/supabase-js';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
    };
  }
}

// Initialize Supabase client for JWT verification (unused in development)
// const supabase = createClient(
//   process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
//   process.env.SUPABASE_ANON_KEY || 'placeholder-key'
// );

interface SupabaseJWTPayload {
  sub: string;
  email?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  role?: string;
}

/**
 * Verify Supabase JWT token and extract user information
 */
export async function verifySupabaseToken(
  token: string,
): Promise<{ id: string; email: string }> {
  try {
    // In production, you would verify against Supabase's public key
    // For now, we'll decode and validate basic structure
    const decoded = jwt.decode(token) as SupabaseJWTPayload;

    if (!decoded || !decoded.sub) {
      throw new Error('Invalid token payload');
    }

    // Check token expiration
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    return {
      id: decoded.sub,
      email: decoded.email || '',
    };
  } catch (error) {
    throw new Error(
      `Token verification failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

/**
 * Development/testing authentication bypass
 * Uses X-Test-User-ID header when NODE_ENV !== 'production'
 */
function getTestUser(
  request: FastifyRequest,
): { id: string; email: string } | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const testUserId = request.headers['x-test-user-id'] as string;
  const testUserEmail = request.headers['x-test-user-email'] as string;

  if (testUserId) {
    // Validate UUID format for test user ID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(testUserId)) {
      throw new Error('Invalid test user ID format - must be a valid UUID');
    }

    return {
      id: testUserId,
      email: testUserEmail || `test-${testUserId}@example.com`,
    };
  }

  return null;
}

/**
 * Authentication middleware for protected routes
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    // Check for test user in development
    const testUser = getTestUser(request);
    if (testUser) {
      request.user = testUser;
      return;
    }

    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token and extract user info
    const user = await verifySupabaseToken(token);
    request.user = user;
  } catch (error) {
    request.log.warn(
      {
        error: error instanceof Error ? error.message : 'Unknown auth error',
        url: request.url,
        method: request.method,
      },
      'Authentication failed',
    );

    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication middleware - sets user if token is valid, but doesn't block request
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  try {
    // Check for test user in development
    const testUser = getTestUser(request);
    if (testUser) {
      request.user = testUser;
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // No token provided, continue without user
    }

    const token = authHeader.substring(7);
    const user = await verifySupabaseToken(token);
    request.user = user;
  } catch (error) {
    // Log but don't block request
    request.log.debug(
      {
        error: error instanceof Error ? error.message : 'Unknown auth error',
      },
      'Optional authentication failed',
    );
  }
}

/**
 * Helper to get current user ID (throws if not authenticated)
 */
export function requireUser(request: FastifyRequest): string {
  if (!request.user) {
    throw new Error('User not authenticated');
  }
  return request.user.id;
}

/**
 * Helper to get current user ID (returns null if not authenticated)
 */
export function getCurrentUser(request: FastifyRequest): string | null {
  return request.user?.id || null;
}
