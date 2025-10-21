import type {
  CreateDraftRequest,
  ExpenseDraft,
  UpdateDraftRequest,
} from '@shared/types';
import type { FastifyInstance } from 'fastify';
import pino from 'pino';

import { authMiddleware } from '../auth.js';
import { query, withTransaction } from '../db.js';
import {
  ApproveDraftSchema,
  CreateDraftSchema,
  UpdateDraftSchema,
} from '../validation.js';

const logger = pino({ name: 'drafts-routes' });

const formatDraftResponse = (row: any): ExpenseDraft => ({
  id: row.id,
  group_id: row.group_id,
  created_by: row.created_by,
  created_by_user: row.created_by_id
    ? {
        id: row.created_by_id,
        name: row.created_by_name,
        email: row.created_by_email,
      }
    : undefined,
  title: row.title,
  amount_cents: row.amount_cents,
  paid_by: row.paid_by,
  paid_by_user: row.paid_by_id
    ? {
        id: row.paid_by_id,
        name: row.paid_by_name,
        email: row.paid_by_email,
      }
    : undefined,
  participants: JSON.parse(row.participants),
  split_type: row.split_type,
  status: row.status,
  source: row.source,
  llm_metadata: row.llm_metadata ? JSON.parse(row.llm_metadata) : undefined,
  validation_warnings: row.validation_warnings
    ? JSON.parse(row.validation_warnings)
    : undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export default async function draftRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // Create a new expense draft
  fastify.post<{
    Params: { groupId: string };
    Body: CreateDraftRequest;
  }>('/v1/groups/:groupId/drafts', async (request, reply) => {
    const { groupId } = request.params;

    // Validate request data manually
    const parseResult = CreateDraftSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: parseResult.error.issues,
      });
    }

    const draft = parseResult.data;
    const userId = request.user?.id;

    if (!userId) {
      return reply
        .status(401)
        .send({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    logger.info({ groupId, draft, userId }, 'Creating expense draft');

    try {
      // Verify user is a member of the group
      const membership = await query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId],
      );

      if (membership.rows.length === 0) {
        return await reply.status(403).send({
          code: 'GROUP_ACCESS_DENIED',
          message: 'User is not a member of this group',
        });
      }

      // Verify all participants are group members
      const participantCheck = await query(
        `SELECT user_id FROM group_members
         WHERE group_id = $1 AND user_id = ANY($2)`,
        [groupId, draft.participants],
      );

      if (participantCheck.rows.length !== draft.participants.length) {
        return await reply.status(400).send({
          code: 'INVALID_PARTICIPANTS',
          message: 'Some participants are not members of this group',
        });
      }

      // Insert the draft
      const result = await query(
        `INSERT INTO expense_drafts
         (group_id, created_by, title, amount_cents, paid_by, participants, split_type, source, llm_metadata, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_review')
         RETURNING *`,
        [
          groupId,
          userId,
          draft.title,
          draft.amount_cents,
          draft.paid_by,
          JSON.stringify(draft.participants),
          draft.split_type,
          draft.source,
          draft.llm_metadata ? JSON.stringify(draft.llm_metadata) : null,
        ],
      );

      const createdDraft = result.rows[0];

      // Fetch user details for response
      const draftWithUsers = await query(
        `SELECT
           d.*,
           creator.id as created_by_id, creator.name as created_by_name, creator.email as created_by_email,
           payer.id as paid_by_id, payer.name as paid_by_name, payer.email as paid_by_email
         FROM expense_drafts d
         LEFT JOIN users creator ON d.created_by = creator.id
         LEFT JOIN users payer ON d.paid_by = payer.id
         WHERE d.id = $1`,
        [createdDraft.id],
      );

      const draftResponse = formatDraftResponse(draftWithUsers.rows[0]);

      logger.info(
        { draftId: createdDraft.id },
        'Expense draft created successfully',
      );

      return await reply.status(201).send(draftResponse);
    } catch (error) {
      logger.error({ error, groupId, draft }, 'Failed to create expense draft');
      throw error;
    }
  });

  // Get all drafts for a group
  fastify.get<{
    Params: { groupId: string };
    Querystring: { status?: string };
  }>('/v1/groups/:groupId/drafts', async (request, reply) => {
    const { groupId } = request.params;
    const { status } = request.query;
    const userId = request.user?.id;

    if (!userId) {
      return reply
        .status(401)
        .send({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    try {
      // Verify user is a member of the group
      const membership = await query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId],
      );

      if (membership.rows.length === 0) {
        return await reply.status(403).send({
          code: 'GROUP_ACCESS_DENIED',
          message: 'User is not a member of this group',
        });
      }

      let queryText = `
        SELECT
          d.*,
          creator.id as created_by_id, creator.name as created_by_name, creator.email as created_by_email,
          payer.id as paid_by_id, payer.name as paid_by_name, payer.email as paid_by_email
        FROM expense_drafts d
        LEFT JOIN users creator ON d.created_by = creator.id
        LEFT JOIN users payer ON d.paid_by = payer.id
        WHERE d.group_id = $1`;

      const params = [groupId];

      if (status) {
        queryText += ' AND d.status = $2';
        params.push(status);
      }

      queryText += ' ORDER BY d.created_at DESC';

      const result = await query(queryText, params);
      const drafts = result.rows.map(formatDraftResponse);

      return await reply.send(drafts);
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to fetch expense drafts');
      throw error;
    }
  });

  // Get a specific draft
  fastify.get<{
    Params: { groupId: string; draftId: string };
  }>('/v1/groups/:groupId/drafts/:draftId', async (request, reply) => {
    const { groupId, draftId } = request.params;
    const userId = request.user?.id;

    if (!userId) {
      return reply
        .status(401)
        .send({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    try {
      // Verify user is a member of the group
      const membership = await query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId],
      );

      if (membership.rows.length === 0) {
        return await reply.status(403).send({
          code: 'GROUP_ACCESS_DENIED',
          message: 'User is not a member of this group',
        });
      }

      const result = await query(
        `SELECT 
           d.*,
           creator.id as created_by_id, creator.name as created_by_name, creator.email as created_by_email,
           payer.id as paid_by_id, payer.name as paid_by_name, payer.email as paid_by_email
         FROM expense_drafts d
         LEFT JOIN users creator ON d.created_by = creator.id
         LEFT JOIN users payer ON d.paid_by = payer.id
         WHERE d.id = $1 AND d.group_id = $2`,
        [draftId, groupId],
      );

      if (result.rows.length === 0) {
        return await reply.status(404).send({
          code: 'DRAFT_NOT_FOUND',
          message: 'Expense draft not found',
        });
      }

      const draft = formatDraftResponse(result.rows[0]);
      return await reply.send(draft);
    } catch (error) {
      logger.error(
        { error, groupId, draftId },
        'Failed to fetch expense draft',
      );
      throw error;
    }
  });

  // Update a draft
  fastify.put<{
    Params: { groupId: string; draftId: string };
    Body: UpdateDraftRequest;
  }>('/v1/groups/:groupId/drafts/:draftId', async (request, reply) => {
    const { groupId, draftId } = request.params;

    // Validate request data manually
    const parseResult = UpdateDraftSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: parseResult.error.issues,
      });
    }

    const updates = parseResult.data;
    const userId = request.user?.id;

    if (!userId) {
      return reply
        .status(401)
        .send({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    logger.info(
      { groupId, draftId, updates, userId },
      'Updating expense draft',
    );

    try {
      // Verify draft exists and user has access
      const draftCheck = await query(
        `SELECT d.*, gm.user_id as member_check
         FROM expense_drafts d
         LEFT JOIN group_members gm ON d.group_id = gm.group_id AND gm.user_id = $1
         WHERE d.id = $2 AND d.group_id = $3`,
        [userId, draftId, groupId],
      );

      if (draftCheck.rows.length === 0) {
        return await reply.status(404).send({
          code: 'DRAFT_NOT_FOUND',
          message: 'Expense draft not found',
        });
      }

      const draft = draftCheck.rows[0];

      if (!draft.member_check) {
        return await reply.status(403).send({
          code: 'GROUP_ACCESS_DENIED',
          message: 'User is not a member of this group',
        });
      }

      if (draft.status !== 'pending_review') {
        return await reply.status(400).send({
          code: 'INVALID_DRAFT_STATUS',
          message: 'Can only update drafts that are pending review',
        });
      }

      // Verify all participants are group members if updating participants
      if (updates.participants) {
        const participantCheck = await query(
          `SELECT user_id FROM group_members 
           WHERE group_id = $1 AND user_id = ANY($2)`,
          [groupId, updates.participants],
        );

        if (participantCheck.rows.length !== updates.participants.length) {
          return await reply.status(400).send({
            code: 'INVALID_PARTICIPANTS',
            message: 'Some participants are not members of this group',
          });
        }
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const params: any[] = [];

      const addField = (column: string, value: unknown) => {
        params.push(value);
        updateFields.push(`${column} = $${params.length}`);
      };

      if (updates.title) {
        addField('title', updates.title);
      }

      if (updates.amount_cents) {
        addField('amount_cents', updates.amount_cents);
      }

      if (updates.paid_by) {
        addField('paid_by', updates.paid_by);
      }

      if (updates.participants) {
        addField('participants', JSON.stringify(updates.participants));
      }

      if (updates.split_type) {
        addField('split_type', updates.split_type);
      }

      updateFields.push('updated_at = NOW()');

      params.push(draftId);
      const draftIdPlaceholder = `$${params.length}`;
      params.push(groupId);
      const groupIdPlaceholder = `$${params.length}`;

      await query(
        `UPDATE expense_drafts 
         SET ${updateFields.join(', ')}
         WHERE id = ${draftIdPlaceholder} AND group_id = ${groupIdPlaceholder}
         RETURNING *`,
        params,
      );

      // Fetch updated draft with user details
      const updatedDraftResult = await query(
        `SELECT 
           d.*,
           creator.id as created_by_id, creator.name as created_by_name, creator.email as created_by_email,
           payer.id as paid_by_id, payer.name as paid_by_name, payer.email as paid_by_email
         FROM expense_drafts d
         LEFT JOIN users creator ON d.created_by = creator.id
         LEFT JOIN users payer ON d.paid_by = payer.id
         WHERE d.id = $1`,
        [draftId],
      );

      const updatedDraft = formatDraftResponse(updatedDraftResult.rows[0]);

      logger.info({ draftId }, 'Expense draft updated successfully');
      return await reply.send(updatedDraft);
    } catch (error) {
      logger.error(
        { error, groupId, draftId, updates },
        'Failed to update expense draft',
      );
      throw error;
    }
  });

  // Approve/reject a draft
  fastify.post<{
    Params: { groupId: string; draftId: string };
    Body: { action: 'approve' | 'reject'; reason?: string };
  }>('/v1/groups/:groupId/drafts/:draftId/review', async (request, reply) => {
    const { groupId, draftId } = request.params;

    // Validate request data manually
    const parseResult = ApproveDraftSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: parseResult.error.issues,
      });
    }

    const { action, reason } = parseResult.data;
    const userId = request.user?.id;

    if (!userId) {
      return reply
        .status(401)
        .send({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    logger.info(
      { groupId, draftId, action, reason, userId },
      'Reviewing expense draft',
    );

    try {
      // Verify draft exists and user has access
      const draftCheck = await query(
        `SELECT d.*, gm.user_id as member_check, gm.role
         FROM expense_drafts d
         LEFT JOIN group_members gm ON d.group_id = gm.group_id AND gm.user_id = $1
         WHERE d.id = $2 AND d.group_id = $3`,
        [userId, draftId, groupId],
      );

      if (draftCheck.rows.length === 0) {
        return await reply.status(404).send({
          code: 'DRAFT_NOT_FOUND',
          message: 'Expense draft not found',
        });
      }

      const draft = draftCheck.rows[0];

      if (!draft.member_check) {
        return await reply.status(403).send({
          code: 'GROUP_ACCESS_DENIED',
          message: 'User is not a member of this group',
        });
      }

      if (draft.status !== 'pending_review') {
        return await reply.status(400).send({
          code: 'INVALID_DRAFT_STATUS',
          message: 'Draft is not pending review',
        });
      }

      // Only allow the creator or group admin to approve/reject
      if (draft.created_by !== userId && draft.role !== 'admin') {
        return await reply.status(403).send({
          code: 'INSUFFICIENT_PERMISSIONS',
          message:
            'Only the draft creator or group admin can review this draft',
        });
      }

      if (action === 'approve') {
        // Convert draft to actual expense
        const createdExpense = await withTransaction(
          async (transactionQuery) => {
            // Create the expense
            const expenseResult = await transactionQuery(
              `INSERT INTO expenses
             (group_id, title, amount_cents, currency_code, paid_by, description, created_at, updated_at)
             VALUES ($1, $2, $3, 'USD', $4, $5, NOW(), NOW())
             RETURNING *`,
              [
                groupId,
                draft.title,
                draft.amount_cents,
                draft.paid_by,
                `Approved from draft: ${draft.title}`,
              ],
            );

            const expense = expenseResult.rows[0];
            const participants = JSON.parse(draft.participants);

            // Create expense splits based on split type
            const splitAmount = Math.floor(
              draft.amount_cents / participants.length,
            );
            const remainder = draft.amount_cents % participants.length;

            const splitInsertPromises = participants.map(
              (participantId: string, index: number) => {
                const participantAmount =
                  splitAmount + (index < remainder ? 1 : 0);

                return transactionQuery(
                  `INSERT INTO expense_splits
               (expense_id, user_id, amount_cents, split_type)
               VALUES ($1, $2, $3, $4)`,
                  [
                    expense.id,
                    participantId,
                    participantAmount,
                    draft.split_type,
                  ],
                );
              },
            );

            await Promise.all(splitInsertPromises);

            // Update draft status
            await transactionQuery(
              `UPDATE expense_drafts
             SET status = 'approved', updated_at = NOW()
             WHERE id = $1`,
              [draftId],
            );

            return expense;
          },
        );

        logger.info(
          {
            draftId,
            expenseId: createdExpense.id,
          },
          'Draft approved and converted to expense',
        );
      } else {
        // Just update the draft status to rejected
        await query(
          `UPDATE expense_drafts 
           SET status = 'rejected', updated_at = NOW()
           WHERE id = $1`,
          [draftId],
        );

        logger.info({ draftId }, 'Draft rejected');
      }

      // Return updated draft
      const updatedDraftResult = await query(
        `SELECT 
           d.*,
           creator.id as created_by_id, creator.name as created_by_name, creator.email as created_by_email,
           payer.id as paid_by_id, payer.name as paid_by_name, payer.email as paid_by_email
         FROM expense_drafts d
         LEFT JOIN users creator ON d.created_by = creator.id
         LEFT JOIN users payer ON d.paid_by = payer.id
         WHERE d.id = $1`,
        [draftId],
      );

      const updatedDraft = formatDraftResponse(updatedDraftResult.rows[0]);
      return await reply.send(updatedDraft);
    } catch (error) {
      logger.error(
        { error, groupId, draftId, action },
        'Failed to review expense draft',
      );
      throw error;
    }
  });

  // Delete a draft
  fastify.delete<{
    Params: { groupId: string; draftId: string };
  }>('/v1/groups/:groupId/drafts/:draftId', async (request, reply) => {
    const { groupId, draftId } = request.params;
    const userId = request.user?.id;

    if (!userId) {
      return reply
        .status(401)
        .send({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    try {
      // Verify draft exists and user has access
      const draftCheck = await query(
        `SELECT d.*, gm.user_id as member_check, gm.role
         FROM expense_drafts d
         LEFT JOIN group_members gm ON d.group_id = gm.group_id AND gm.user_id = $1
         WHERE d.id = $2 AND d.group_id = $3`,
        [userId, draftId, groupId],
      );

      if (draftCheck.rows.length === 0) {
        return await reply.status(404).send({
          code: 'DRAFT_NOT_FOUND',
          message: 'Expense draft not found',
        });
      }

      const draft = draftCheck.rows[0];

      if (!draft.member_check) {
        return await reply.status(403).send({
          code: 'GROUP_ACCESS_DENIED',
          message: 'User is not a member of this group',
        });
      }

      // Only allow the creator or group admin to delete
      if (draft.created_by !== userId && draft.role !== 'admin') {
        return await reply.status(403).send({
          code: 'INSUFFICIENT_PERMISSIONS',
          message:
            'Only the draft creator or group admin can delete this draft',
        });
      }

      await query('DELETE FROM expense_drafts WHERE id = $1', [draftId]);

      logger.info({ draftId }, 'Expense draft deleted successfully');
      return await reply.status(204).send();
    } catch (error) {
      logger.error(
        { error, groupId, draftId },
        'Failed to delete expense draft',
      );
      throw error;
    }
  });
}
