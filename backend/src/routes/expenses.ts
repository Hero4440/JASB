import type { Expense, ExpenseSplit } from '@shared/types';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { authMiddleware } from '../auth.js';
import { query, queryMany, queryOne, withTransaction } from '../db.js';
import {
  CreateExpenseSchema,
  ForbiddenError,
  NotFoundError,
  PaginationSchema,
  UpdateExpenseSchema,
  UUIDSchema,
  validateParams,
  validateQuery,
  validateRequest,
  ValidationError,
} from '../validation.js';

// URL parameter schemas
const ExpenseParamsSchema = z.object({ id: UUIDSchema });
const GroupExpenseParamsSchema = z.object({ group_id: UUIDSchema });

const expensesRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // GET /v1/groups/:group_id/expenses - List expenses for a group
  fastify.get(
    '/v1/groups/:group_id/expenses',
    {
      preHandler: [
        validateParams(GroupExpenseParamsSchema),
        validateQuery(PaginationSchema),
      ],
    },
    async (request, reply) => {
      const { group_id } = (request as any).validatedParams;
      const { limit, cursor } = (request as any).validatedQuery;
      const user = request.user!;

      // Verify user is member of group
      const membership = await queryOne<{ role: string }>(
        `
      SELECT role FROM group_members 
      WHERE group_id = $1 AND user_id = $2
    `,
        [group_id, user.id],
      );

      if (!membership) {
        throw new ForbiddenError('You are not a member of this group');
      }

      // Build cursor query
      let query = `
      SELECT 
        e.*,
        u.name as paid_by_name,
        u.email as paid_by_email,
        COUNT(*) OVER() as total_count
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
      WHERE e.group_id = $1
    `;
      const params: any[] = [group_id];

      if (cursor) {
        query += ` AND e.created_at < $${params.length + 1}`;
        params.push(cursor);
      }

      query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const expenses = await queryMany<
        Expense & {
          total_count: number;
          paid_by_name: string;
          paid_by_email: string;
        }
      >(query, params);

      const total = expenses.length > 0 ? expenses[0].total_count : 0;
      const hasMore = expenses.length === limit;
      const nextCursor =
        hasMore && expenses.length > 0
          ? expenses[expenses.length - 1].created_at
          : null;

      // For each expense, fetch splits
      const expensesWithSplits = await Promise.all(
        expenses.map(async (expense) => {
          const splits = await queryMany<
            ExpenseSplit & { user_name: string; user_email: string }
          >(
            `
          SELECT 
            es.*,
            u.name as user_name,
            u.email as user_email
          FROM expense_splits es
          JOIN users u ON es.user_id = u.id
          WHERE es.expense_id = $1
          ORDER BY u.name
        `,
            [expense.id],
          );

          return {
            ...expense,
            paid_by_name: expense.paid_by_name,
            paid_by_email: expense.paid_by_email,
            splits,
            total_count: undefined, // Remove from response
          };
        }),
      );

      reply.send({
        data: expensesWithSplits,
        pagination: {
          has_more: hasMore,
          total,
          cursor: nextCursor,
        },
      });
    },
  );

  // POST /v1/groups/:group_id/expenses - Create expense
  fastify.post(
    '/v1/groups/:group_id/expenses',
    {
      preHandler: [
        validateParams(GroupExpenseParamsSchema),
        validateRequest(CreateExpenseSchema),
      ],
    },
    async (request, reply) => {
      const { group_id } = (request as any).validatedParams;
      const expenseData = (request as any).validatedBody;
      const user = request.user!;

      // Check for idempotency key
      const idempotencyKey = request.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        // Check if we've already processed this request
        const existingResult = await queryOne(
          `
        SELECT response_data FROM idempotency_keys 
        WHERE key = $1 AND user_id = $2
      `,
          [idempotencyKey, user.id],
        );

        if (existingResult) {
          return reply.send(JSON.parse(existingResult.response_data));
        }
      }

      await withTransaction(async (client) => {
        // Verify user is member of group
        const membership = await queryOne<{ role: string }>(
          `
        SELECT role FROM group_members 
        WHERE group_id = $1 AND user_id = $2
      `,
          [group_id, user.id],
          client,
        );

        if (!membership) {
          throw new ForbiddenError('You are not a member of this group');
        }

        // Verify paid_by user is member of group
        const paidByMembership = await queryOne(
          `
        SELECT 1 FROM group_members 
        WHERE group_id = $1 AND user_id = $2
      `,
          [group_id, expenseData.paid_by],
          client,
        );

        if (!paidByMembership) {
          throw new ValidationError(
            'Paid by user is not a member of this group',
          );
        }

        // Create expense
        const expense = await queryOne<Expense>(
          `
        INSERT INTO expenses (
          group_id, title, amount_cents, currency_code, 
          paid_by, description
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
          [
            group_id,
            expenseData.title,
            expenseData.amount_cents,
            expenseData.currency_code,
            expenseData.paid_by,
            expenseData.description,
          ],
          client,
        );

        // Handle splits based on split_type
        if (expenseData.split_type === 'equal') {
          // Get all group members and split equally
          const members = await queryMany<{ user_id: string }>(
            `
          SELECT user_id FROM group_members WHERE group_id = $1
        `,
            [group_id],
            client,
          );

          const splitAmount = Math.floor(
            expenseData.amount_cents / members.length,
          );
          const remainder = expenseData.amount_cents % members.length;

          for (let i = 0; i < members.length; i++) {
            const amount = splitAmount + (i < remainder ? 1 : 0); // Distribute remainder
            await query(
              `
            INSERT INTO expense_splits (expense_id, user_id, amount_cents)
            VALUES ($1, $2, $3)
          `,
              [expense.id, members[i].user_id, amount],
              client,
            );
          }
        } else if (expenseData.splits) {
          // Use provided splits
          for (const split of expenseData.splits) {
            let splitAmountCents: number;

            switch (expenseData.split_type) {
              case 'amount':
                splitAmountCents = split.amount_cents!;
                break;
              case 'percent':
                splitAmountCents = Math.round(
                  (split.percent! / 100) * expenseData.amount_cents,
                );
                break;
              case 'share':
                const totalShares = expenseData.splits.reduce(
                  (sum, s) => sum + (s.shares || 0),
                  0,
                );
                splitAmountCents = Math.round(
                  (split.shares! / totalShares) * expenseData.amount_cents,
                );
                break;
              default:
                throw new ValidationError('Invalid split type');
            }

            await query(
              `
            INSERT INTO expense_splits (expense_id, user_id, amount_cents)
            VALUES ($1, $2, $3)
          `,
              [expense.id, split.user_id, splitAmountCents],
              client,
            );
          }
        }

        // Fetch complete expense with splits
        const splits = await queryMany<
          ExpenseSplit & { user_name: string; user_email: string }
        >(
          `
        SELECT 
          es.*,
          u.name as user_name,
          u.email as user_email
        FROM expense_splits es
        JOIN users u ON es.user_id = u.id
        WHERE es.expense_id = $1
        ORDER BY u.name
      `,
          [expense.id],
          client,
        );

        const completeExpense = {
          ...expense,
          splits,
        };

        // Store idempotency result
        if (idempotencyKey) {
          await query(
            `
          INSERT INTO idempotency_keys (key, user_id, response_data)
          VALUES ($1, $2, $3)
          ON CONFLICT (key, user_id) DO NOTHING
        `,
            [
              idempotencyKey,
              user.id,
              JSON.stringify({ data: completeExpense }),
            ],
            client,
          );
        }

        reply.status(201).send({ data: completeExpense });
      });
    },
  );

  // GET /v1/expenses/:id - Get single expense
  fastify.get(
    '/v1/expenses/:id',
    {
      preHandler: validateParams(ExpenseParamsSchema.pick({ id: true })),
    },
    async (request, reply) => {
      const { id } = (request as any).validatedParams;
      const user = request.user!;

      // Fetch expense with membership check
      const expense = await queryOne<
        Expense & { paid_by_name: string; paid_by_email: string }
      >(
        `
      SELECT 
        e.*,
        u.name as paid_by_name,
        u.email as paid_by_email
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
      JOIN group_members gm ON e.group_id = gm.group_id
      WHERE e.id = $1 AND gm.user_id = $2
    `,
        [id, user.id],
      );

      if (!expense) {
        throw new NotFoundError('Expense', id);
      }

      // Fetch splits
      const splits = await queryMany<
        ExpenseSplit & { user_name: string; user_email: string }
      >(
        `
      SELECT 
        es.*,
        u.name as user_name,
        u.email as user_email
      FROM expense_splits es
      JOIN users u ON es.user_id = u.id
      WHERE es.expense_id = $1
      ORDER BY u.name
    `,
        [id],
      );

      reply.send({
        data: {
          ...expense,
          splits,
        },
      });
    },
  );

  // PUT /v1/expenses/:id - Update expense
  fastify.put(
    '/v1/expenses/:id',
    {
      preHandler: [
        validateParams(ExpenseParamsSchema.pick({ id: true })),
        validateRequest(UpdateExpenseSchema),
      ],
    },
    async (request, reply) => {
      const { id } = (request as any).validatedParams;
      const updateData = (request as any).validatedBody;
      const user = request.user!;

      await withTransaction(async (client) => {
        // Check if expense exists and user has permission
        const expense = await queryOne<Expense>(
          `
        SELECT e.*
        FROM expenses e
        JOIN group_members gm ON e.group_id = gm.group_id
        WHERE e.id = $1 AND gm.user_id = $2
      `,
          [id, user.id],
          client,
        );

        if (!expense) {
          throw new NotFoundError('Expense', id);
        }

        // Only allow expense creator or group admin to update
        if (expense.paid_by !== user.id) {
          const isAdmin = await queryOne(
            `
          SELECT 1 FROM group_members 
          WHERE group_id = $1 AND user_id = $2 AND role = 'admin'
        `,
            [expense.group_id, user.id],
            client,
          );

          if (!isAdmin) {
            throw new ForbiddenError(
              'Only expense creator or group admin can update expenses',
            );
          }
        }

        // Update expense
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        Object.entries(updateData).forEach(([key, value]) => {
          if (value !== undefined && key !== 'splits') {
            updateFields.push(`${key} = $${paramIndex++}`);
            updateValues.push(value);
          }
        });

        if (updateFields.length > 0) {
          updateValues.push(id);
          await query(
            `
          UPDATE expenses 
          SET ${updateFields.join(', ')}, updated_at = NOW()
          WHERE id = $${paramIndex}
        `,
            updateValues,
            client,
          );
        }

        // If splits are being updated, replace all splits
        if (updateData.splits) {
          await query(
            `DELETE FROM expense_splits WHERE expense_id = $1`,
            [id],
            client,
          );

          for (const split of updateData.splits) {
            await query(
              `
            INSERT INTO expense_splits (expense_id, user_id, amount_cents)
            VALUES ($1, $2, $3)
          `,
              [id, split.user_id, split.amount_cents],
              client,
            );
          }
        }

        // Return updated expense
        const updatedExpense = await queryOne<Expense>(
          `SELECT * FROM expenses WHERE id = $1`,
          [id],
          client,
        );
        const splits = await queryMany<ExpenseSplit>(
          `
        SELECT * FROM expense_splits WHERE expense_id = $1
      `,
          [id],
          client,
        );

        reply.send({
          data: {
            ...updatedExpense,
            splits,
          },
        });
      });
    },
  );

  // DELETE /v1/expenses/:id - Delete expense
  fastify.delete(
    '/v1/expenses/:id',
    {
      preHandler: validateParams(ExpenseParamsSchema.pick({ id: true })),
    },
    async (request, reply) => {
      const { id } = (request as any).validatedParams;
      const user = request.user!;

      await withTransaction(async (client) => {
        // Check if expense exists and user has permission
        const expense = await queryOne<Expense>(
          `
        SELECT e.*
        FROM expenses e
        JOIN group_members gm ON e.group_id = gm.group_id
        WHERE e.id = $1 AND gm.user_id = $2
      `,
          [id, user.id],
          client,
        );

        if (!expense) {
          throw new NotFoundError('Expense', id);
        }

        // Only allow expense creator or group admin to delete
        if (expense.paid_by !== user.id) {
          const isAdmin = await queryOne(
            `
          SELECT 1 FROM group_members 
          WHERE group_id = $1 AND user_id = $2 AND role = 'admin'
        `,
            [expense.group_id, user.id],
            client,
          );

          if (!isAdmin) {
            throw new ForbiddenError(
              'Only expense creator or group admin can delete expenses',
            );
          }
        }

        // Delete splits first (cascade should handle this, but being explicit)
        await query(
          `DELETE FROM expense_splits WHERE expense_id = $1`,
          [id],
          client,
        );

        // Delete expense
        await query(`DELETE FROM expenses WHERE id = $1`, [id], client);

        reply.status(204).send();
      });
    },
  );
};

export default expensesRoutes;
