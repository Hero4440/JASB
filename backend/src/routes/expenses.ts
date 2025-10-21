import type {
  CreateExpenseRequest,
  Expense,
  ExpenseSplit,
  UpdateExpenseRequest,
} from '@shared/types';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { authMiddleware } from '../auth.js';
import { query, queryMany, queryOne, withTransaction } from '../db.js';
import {
  CreateExpenseSchema,
  ForbiddenError,
  normalizeSplitType,
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
      const { group_id: groupId } = (request as any).validatedParams;
      const { limit, cursor } = (request as any).validatedQuery;
      const user = request.user!;

      // Verify user is member of group
      const membership = await queryOne<{ role: string }>(
        `
      SELECT role FROM group_members 
      WHERE group_id = $1 AND user_id = $2
    `,
        [groupId, user.id],
      );

      if (!membership) {
        throw new ForbiddenError('You are not a member of this group');
      }

      // Build cursor query
      let sql = `
      SELECT 
        e.*,
        u.name as paid_by_name,
        u.email as paid_by_email,
        COUNT(*) OVER() as total_count
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
      WHERE e.group_id = $1
    `;
      const params: any[] = [groupId];

      if (cursor) {
        sql += ` AND e.created_at < $${params.length + 1}`;
        params.push(cursor);
      }

      sql += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const expenses = await queryMany<
        Expense & {
          total_count: number;
          paid_by_name: string;
          paid_by_email: string;
        }
      >(sql, params);

      const total = expenses.length > 0 ? (expenses[0]!.total_count ?? 0) : 0;
      const hasMore = expenses.length === limit;
      const nextCursor =
        hasMore && expenses.length > 0
          ? expenses[expenses.length - 1]!.created_at
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
      const { group_id: groupId } = (request as any).validatedParams;
      const expenseData = (request as any)
        .validatedBody as CreateExpenseRequest;
      const user = request.user!;

      const originalSplitType = expenseData.split_type ?? 'equal';
      const splitType = normalizeSplitType(originalSplitType);

      // Check for idempotency key
      const idempotencyKey = request.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        // Check if we've already processed this request
        const existingResult = await queryOne(
          `
        SELECT response_data FROM idempotency 
        WHERE key = $1 AND user_id = $2
      `,
          [idempotencyKey, user.id],
        );

        if (existingResult) {
          return reply.send(JSON.parse(existingResult.response_data));
        }
      }

      return withTransaction(async (client) => {
        // Verify user is member of group
        const membership = await queryOne<{ role: string }>(
          `
        SELECT role FROM group_members 
        WHERE group_id = $1 AND user_id = $2
      `,
          [groupId, user.id],
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
          [groupId, expenseData.paid_by],
          client,
        );

        if (!paidByMembership) {
          throw new ValidationError(
            'Paid by user is not a member of this group',
          );
        }

        const groupMembers = await queryMany<{ user_id: string }>(
          `
        SELECT user_id 
        FROM group_members 
        WHERE group_id = $1
      `,
          [groupId],
          client,
        );

        if (groupMembers.length === 0) {
          throw new ValidationError('Group has no members to split expenses');
        }

        const memberIdSet = new Set(
          groupMembers.map((member) => member.user_id),
        );

        type SplitAccumulator = {
          user_id: string;
          amount_cents?: number;
          percent?: number;
          shares?: number;
        };

        const rawSplits: SplitAccumulator[] = Array.isArray(expenseData.splits)
          ? [...expenseData.splits]
          : [];

        if (rawSplits.length === 0 && splitType === 'amount') {
          let hasAmount = false;

          for (const member of groupMembers) {
            const rawAmount = expenseData.member_amounts?.[member.user_id];
            const parsedAmount =
              rawAmount === undefined || rawAmount === ''
                ? 0
                : Number.parseFloat(rawAmount);

            if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
              throw new ValidationError('Invalid split amount provided');
            }

            const cents = Math.round(parsedAmount * 100);
            rawSplits.push({
              user_id: member.user_id,
              amount_cents: cents,
            });

            if (cents > 0) {
              hasAmount = true;
            }
          }

          if (!hasAmount) {
            throw new ValidationError(
              'At least one member amount must be greater than 0',
            );
          }
        }

        if (rawSplits.length === 0 && splitType === 'share') {
          let totalShares = 0;

          for (const member of groupMembers) {
            const rawShare = expenseData.member_shares?.[member.user_id];
            const parsedShare =
              rawShare === undefined || rawShare === ''
                ? 0
                : Number.parseInt(rawShare, 10);

            if (!Number.isFinite(parsedShare) || parsedShare < 0) {
              throw new ValidationError('Invalid share value provided');
            }

            rawSplits.push({
              user_id: member.user_id,
              shares: parsedShare,
            });

            totalShares += parsedShare;
          }

          if (totalShares <= 0) {
            throw new ValidationError('Total shares must be greater than 0');
          }
        }

        const normalizedSplitMap = new Map<string, SplitAccumulator>();

        for (const split of rawSplits) {
          if (!memberIdSet.has(split.user_id)) {
            throw new ValidationError(
              'Split includes a user that is not a group member',
            );
          }

          const accumulator = normalizedSplitMap.get(split.user_id) ?? {
            user_id: split.user_id,
          };

          if (typeof split.amount_cents === 'number') {
            accumulator.amount_cents = split.amount_cents;
          }
          if (typeof split.percent === 'number') {
            accumulator.percent = split.percent;
          }
          if (typeof split.shares === 'number') {
            accumulator.shares = split.shares;
          }

          normalizedSplitMap.set(split.user_id, accumulator);
        }

        const normalizedSplits = Array.from(normalizedSplitMap.values());

        if (splitType !== 'equal' && normalizedSplits.length === 0) {
          throw new ValidationError(
            'Split details are required for this split type',
          );
        }

        const computedSplits: Array<{ user_id: string; amount_cents: number }> =
          [];

        if (splitType === 'amount') {
          for (const split of normalizedSplits) {
            const amountCents = split.amount_cents ?? 0;
            if (amountCents < 0) {
              throw new ValidationError('Split amounts cannot be negative');
            }
            computedSplits.push({
              user_id: split.user_id,
              amount_cents: amountCents,
            });
          }
        } else if (splitType === 'percent') {
          for (const split of normalizedSplits) {
            if (split.percent === undefined) {
              throw new ValidationError('Percent value missing for split');
            }
            computedSplits.push({
              user_id: split.user_id,
              amount_cents: Math.round(
                (split.percent / 100) * expenseData.amount_cents,
              ),
            });
          }
        } else if (splitType === 'share') {
          const totalShares = normalizedSplits.reduce(
            (sum, split) => sum + (split.shares ?? 0),
            0,
          );

          if (totalShares <= 0) {
            throw new ValidationError('Total shares must be greater than 0');
          }

          for (const split of normalizedSplits) {
            computedSplits.push({
              user_id: split.user_id,
              amount_cents: Math.round(
                ((split.shares ?? 0) / totalShares) * expenseData.amount_cents,
              ),
            });
          }
        }

        if (splitType !== 'equal' && computedSplits.length > 0) {
          const totalAssigned = computedSplits.reduce(
            (sum, split) => sum + split.amount_cents,
            0,
          );
          const diff = expenseData.amount_cents - totalAssigned;
          if (diff !== 0) {
            const adjustmentIndex = computedSplits.length - 1;
            computedSplits[adjustmentIndex]!.amount_cents += diff;
          }
        }

        if (
          splitType !== 'equal' &&
          computedSplits.some((split) => split.amount_cents < 0)
        ) {
          throw new ValidationError('Split amounts cannot be negative');
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
            groupId,
            expenseData.title,
            expenseData.amount_cents,
            expenseData.currency_code,
            expenseData.paid_by,
            expenseData.description,
          ],
          client,
        );
        if (!expense) {
          throw new Error('Failed to create expense');
        }

        if (splitType === 'equal') {
          const splitAmount = Math.floor(
            expenseData.amount_cents / groupMembers.length,
          );
          const remainder = expenseData.amount_cents % groupMembers.length;

          const equalSplitInserts = groupMembers.map((member, index) => {
            const amount = splitAmount + (index < remainder ? 1 : 0);
            return query(
              `
            INSERT INTO expense_splits (expense_id, user_id, amount_cents, split_type)
            VALUES ($1, $2, $3, $4)
          `,
              [expense.id, member.user_id, amount, splitType],
              client,
            );
          });

          await Promise.all(equalSplitInserts);
        } else {
          const splitInsertPromises = computedSplits.map((split) =>
            query(
              `
            INSERT INTO expense_splits (expense_id, user_id, amount_cents, split_type)
            VALUES ($1, $2, $3, $4)
          `,
              [expense.id, split.user_id, split.amount_cents, splitType],
              client,
            ),
          );

          await Promise.all(splitInsertPromises);
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

        const memberAmountsResponse =
          splitType === 'amount'
            ? Object.fromEntries(
                computedSplits.map((split) => [
                  split.user_id,
                  (split.amount_cents / 100).toFixed(2),
                ]),
              )
            : undefined;

        const memberSharesResponse =
          splitType === 'share'
            ? Object.fromEntries(
                normalizedSplits.map((split) => [
                  split.user_id,
                  String(split.shares ?? 0),
                ]),
              )
            : undefined;

        const completeExpense = {
          ...expense,
          split_type: originalSplitType ?? splitType,
          ...(memberAmountsResponse
            ? { member_amounts: memberAmountsResponse }
            : {}),
          ...(memberSharesResponse
            ? { member_shares: memberSharesResponse }
            : {}),
          splits,
        };

        // Store idempotency result
        if (idempotencyKey) {
          await query(
            `
          INSERT INTO idempotency (key, user_id, response_data)
          VALUES ($1, $2, $3)
          ON CONFLICT (key) DO NOTHING
        `,
            [
              idempotencyKey,
              user.id,
              JSON.stringify({ data: completeExpense }),
            ],
            client,
          );
        }

        return reply.status(201).send({ data: completeExpense });
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
      const updateData = (request as any).validatedBody as UpdateExpenseRequest;
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
          if (
            value !== undefined &&
            key !== 'splits' &&
            key !== 'split_type' &&
            key !== 'member_amounts' &&
            key !== 'member_shares'
          ) {
            const placeholder = `$${paramIndex}`;
            paramIndex += 1;
            updateFields.push(`${key} = ${placeholder}`);
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

          const splitInsertPromises = updateData.splits.map((split) => {
            const amountCents = split.amount_cents ?? 0;
            return query(
              `
            INSERT INTO expense_splits (expense_id, user_id, amount_cents)
            VALUES ($1, $2, $3)
          `,
              [id, split.user_id, amountCents],
              client,
            );
          });

          await Promise.all(splitInsertPromises);
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
