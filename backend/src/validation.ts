import { SUPPORTED_CURRENCIES } from '@shared/types';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

// Common validation schemas
export const UUIDSchema = z.string().uuid();
export const PositiveIntegerSchema = z.number().int().positive();
export const NonNegativeIntegerSchema = z.number().int().min(0);
export const CurrencyCodeSchema = z.enum(SUPPORTED_CURRENCIES);
export const EmailSchema = z.string().email();
export const NonEmptyStringSchema = z.string().min(1).trim();

// Pagination schemas
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

// User schemas
export const CreateUserSchema = z.object({
  id: UUIDSchema,
  email: EmailSchema,
  name: NonEmptyStringSchema,
  avatar_url: z.string().url().optional(),
});

export const UpdateUserSchema = z
  .object({
    name: NonEmptyStringSchema.optional(),
    avatar_url: z.string().url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// Group schemas
export const CreateGroupSchema = z.object({
  name: NonEmptyStringSchema,
  currency_code: CurrencyCodeSchema.default('USD'),
});

export const UpdateGroupSchema = z
  .object({
    name: NonEmptyStringSchema.optional(),
    currency_code: CurrencyCodeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const InviteToGroupSchema = z.object({
  email: EmailSchema,
});

// Expense schemas
export const SplitTypeSchema = z.enum(['equal', 'percent', 'amount', 'share']);

export const ExpenseSplitSchema = z.object({
  user_id: UUIDSchema,
  amount_cents: NonNegativeIntegerSchema.optional(),
  percent: z.number().min(0).max(100).optional(),
  shares: PositiveIntegerSchema.optional(),
});

export const CreateExpenseSchema = z
  .object({
    title: NonEmptyStringSchema,
    amount_cents: PositiveIntegerSchema,
    currency_code: CurrencyCodeSchema.default('USD'),
    paid_by: UUIDSchema,
    description: z.string().trim().optional(),
    split_type: SplitTypeSchema.default('equal'),
    splits: z.array(ExpenseSplitSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // Validate splits based on split_type
    if (data.split_type === 'equal') {
      // Equal splits don't need individual split amounts
      return;
    }

    if (!data.splits || data.splits.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Splits array is required for split_type: ${data.split_type}`,
      });
      return;
    }

    // Validate splits based on type
    data.splits.forEach((split, index) => {
      switch (data.split_type) {
        case 'amount':
          if (!split.amount_cents) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['splits', index, 'amount_cents'],
              message: 'amount_cents is required for amount splits',
            });
          }
          break;
        case 'percent':
          if (!split.percent) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['splits', index, 'percent'],
              message: 'percent is required for percent splits',
            });
          }
          break;
        case 'share':
          if (!split.shares) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['splits', index, 'shares'],
              message: 'shares is required for share splits',
            });
          }
          break;
      }
    });

    // Validate totals
    if (data.split_type === 'amount') {
      const totalSplits = data.splits.reduce(
        (sum, split) => sum + (split.amount_cents || 0),
        0,
      );
      if (Math.abs(totalSplits - data.amount_cents) > 1) {
        // Allow 1 cent rounding difference
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Split amounts (${totalSplits}) don't match expense total (${data.amount_cents})`,
        });
      }
    }

    if (data.split_type === 'percent') {
      const totalPercent = data.splits.reduce(
        (sum, split) => sum + (split.percent || 0),
        0,
      );
      if (Math.abs(totalPercent - 100) > 0.01) {
        // Allow small rounding
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Split percentages must add up to 100% (got ${totalPercent}%)`,
        });
      }
    }
  });

export const UpdateExpenseSchema = z
  .object({
    title: NonEmptyStringSchema.optional(),
    amount_cents: PositiveIntegerSchema.optional(),
    currency_code: CurrencyCodeSchema.optional(),
    paid_by: UUIDSchema.optional(),
    description: z.string().trim().optional(),
    split_type: SplitTypeSchema.optional(),
    splits: z.array(ExpenseSplitSchema).optional(),
  })
  .refine((data: any) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// Settlement schemas
export const CreateSettlementSchema = z
  .object({
    from_user: UUIDSchema,
    to_user: UUIDSchema,
    amount_cents: PositiveIntegerSchema,
  })
  .refine((data) => data.from_user !== data.to_user, {
    message: 'from_user and to_user cannot be the same',
  });

export const UpdateSettlementSchema = z.object({
  status: z.enum(['pending', 'completed', 'cancelled']),
});

// Draft schemas
export const CreateDraftSchema = z.object({
  title: NonEmptyStringSchema,
  amount_cents: PositiveIntegerSchema,
  paid_by: UUIDSchema,
  participants: z.array(UUIDSchema).min(1),
  split_type: SplitTypeSchema.default('equal'),
  source: z.enum(['manual', 'llm_parsed']).default('manual'),
  llm_metadata: z.record(z.any()).optional(),
});

export const UpdateDraftSchema = z
  .object({
    title: NonEmptyStringSchema.optional(),
    amount_cents: PositiveIntegerSchema.optional(),
    paid_by: UUIDSchema.optional(),
    participants: z.array(UUIDSchema).min(1).optional(),
    split_type: SplitTypeSchema.optional(),
    status: z.enum(['pending_review', 'approved', 'rejected']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const ApproveDraftSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

export const UUID_SCHEMA = UUIDSchema;

// Idempotency key validation
export const IdempotencyKeySchema = z.string().min(1).max(255);

// Request validation middleware
export function validateRequest<T extends z.ZodTypeAny>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = schema.parse(request.body);
      // Store validated data in request for use in handlers
      (request as any).validatedBody = validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: formatZodError(error),
        });
        return;
      }
      throw error;
    }
  };
}

// Query parameter validation middleware
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedQuery = schema.parse(request.query);
      (request as any).validatedQuery = validatedQuery;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          details: formatZodError(error),
        });
        return;
      }
      throw error;
    }
  };
}

// Path parameter validation middleware
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedParams = schema.parse(request.params);
      (request as any).validatedParams = validatedParams;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Path parameter validation failed',
          details: formatZodError(error),
        });
        return;
      }
      throw error;
    }
  };
}

// Format Zod validation errors for API response
export function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    const key = path || 'root';

    if (!formatted[key]) {
      formatted[key] = [];
    }

    formatted[key]!.push(err.message);
  });

  return formatted;
}

// Common error responses
export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ''} not found`);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Error handler for custom error types
export function handleCustomErrors(
  error: Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof ValidationError) {
    reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: error.details,
    });
  } else if (error instanceof NotFoundError) {
    reply.status(404).send({
      code: 'NOT_FOUND',
      message: error.message,
    });
  } else if (error instanceof ForbiddenError) {
    reply.status(403).send({
      code: 'FORBIDDEN',
      message: error.message,
    });
  } else if (error instanceof ConflictError) {
    reply.status(409).send({
      code: 'CONFLICT',
      message: error.message,
    });
  } else {
    // Re-throw for default error handler
    throw error;
  }
}
