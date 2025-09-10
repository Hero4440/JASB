#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { z } from 'zod';

const logger = pino({
  name: 'jasb-mcp-server',
  level: process.env.LOG_LEVEL || 'info',
});

// Validation schemas
const ParseExpenseSchema = z.object({
  text: z.string().describe('Natural language description of the expense'),
  groupId: z
    .string()
    .uuid()
    .describe('UUID of the group this expense belongs to'),
  userId: z.string().uuid().describe('UUID of the user creating the expense'),
});

const ValidateDraftSchema = z.object({
  draft: z.object({
    description: z.string(),
    amount: z.number(),
    paidById: z.string().uuid(),
    splitType: z.enum(['equal', 'exact', 'percentage']),
    splits: z.array(
      z.object({
        userId: z.string().uuid(),
        amount: z.number().optional(),
        percentage: z.number().optional(),
      }),
    ),
  }),
  groupId: z.string().uuid(),
});

const ExplainBalanceSchema = z.object({
  groupId: z
    .string()
    .uuid()
    .describe('UUID of the group to explain balances for'),
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional: specific user to focus explanation on'),
});

const SuggestSettlementSchema = z.object({
  groupId: z
    .string()
    .uuid()
    .describe('UUID of the group to suggest settlements for'),
});

class JASBMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: 'jasb-mcp-server',
      version: '1.0.0',
    });

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error({ error }, 'Server error occurred');
    };

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'parse_expense',
            description:
              'Parse natural language expense description into structured data with safety validation',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description:
                    "Natural language description of the expense (e.g., 'I paid $45 for dinner, split equally between Alice, Bob, and me')",
                },
                groupId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'UUID of the group this expense belongs to',
                },
                userId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'UUID of the user creating the expense',
                },
              },
              required: ['text', 'groupId', 'userId'],
            },
          },
          {
            name: 'validate_draft',
            description:
              'Validate an expense draft for safety, accuracy, and completeness before saving',
            inputSchema: {
              type: 'object',
              properties: {
                draft: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    amount: { type: 'number' },
                    paidById: { type: 'string', format: 'uuid' },
                    splitType: {
                      type: 'string',
                      enum: ['equal', 'exact', 'percentage'],
                    },
                    splits: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          userId: { type: 'string', format: 'uuid' },
                          amount: { type: 'number' },
                          percentage: { type: 'number' },
                        },
                        required: ['userId'],
                      },
                    },
                  },
                  required: [
                    'description',
                    'amount',
                    'paidById',
                    'splitType',
                    'splits',
                  ],
                },
                groupId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'UUID of the group for validation context',
                },
              },
              required: ['draft', 'groupId'],
            },
          },
          {
            name: 'explain_balance',
            description:
              'Provide human-friendly explanation of group balances and who owes what',
            inputSchema: {
              type: 'object',
              properties: {
                groupId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'UUID of the group to explain balances for',
                },
                userId: {
                  type: 'string',
                  format: 'uuid',
                  description:
                    'Optional: specific user to focus explanation on',
                },
              },
              required: ['groupId'],
            },
          },
          {
            name: 'suggest_settlement',
            description:
              'Suggest optimal settlement transactions to minimize the number of payments needed',
            inputSchema: {
              type: 'object',
              properties: {
                groupId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'UUID of the group to suggest settlements for',
                },
              },
              required: ['groupId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'parse_expense':
            return await this.handleParseExpense(args);
          case 'validate_draft':
            return await this.handleValidateDraft(args);
          case 'explain_balance':
            return await this.handleExplainBalance(args);
          case 'suggest_settlement':
            return await this.handleSuggestSettlement(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error({ error, tool: name, args }, 'Tool execution failed');
        throw error;
      }
    });
  }

  private async handleParseExpense(args: unknown) {
    const { text, groupId, userId } = ParseExpenseSchema.parse(args);

    logger.info(
      { text, groupId, userId },
      'Parsing expense from natural language',
    );

    // Fetch group members for context
    const groupMembers = await this.fetchGroupMembers(groupId);

    // Use LLM to parse the expense description
    const parsedExpense = await this.parseExpenseWithLLM(
      text,
      groupMembers,
      userId,
    );

    // Validate and sanitize the result
    const validatedExpense = await this.validateParsedExpense(
      parsedExpense,
      groupId,
      userId,
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              draft: validatedExpense,
              confidence: parsedExpense.confidence,
              warnings: validatedExpense.warnings || [],
              requiresReview: validatedExpense.requiresReview || false,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleValidateDraft(args: unknown) {
    const { draft, groupId } = ValidateDraftSchema.parse(args);

    logger.info({ draft, groupId }, 'Validating expense draft');

    const validation = await this.validateExpenseDraft(draft, groupId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              isValid: validation.isValid,
              errors: validation.errors,
              warnings: validation.warnings,
              suggestions: validation.suggestions,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleExplainBalance(args: unknown) {
    const { groupId, userId } = ExplainBalanceSchema.parse(args);

    logger.info({ groupId, userId }, 'Explaining group balances');

    const balances = await this.fetchGroupBalances(groupId);
    const explanation = await this.generateBalanceExplanation(balances, userId);

    return {
      content: [
        {
          type: 'text',
          text: explanation,
        },
      ],
    };
  }

  private async handleSuggestSettlement(args: unknown) {
    const { groupId } = SuggestSettlementSchema.parse(args);

    logger.info({ groupId }, 'Suggesting optimal settlements');

    const balances = await this.fetchGroupBalances(groupId);
    const settlements = await this.calculateOptimalSettlements(balances);
    const explanation = await this.generateSettlementExplanation(settlements);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              settlements,
              explanation,
              totalTransactions: settlements.length,
              totalAmount: settlements.reduce((sum, s) => sum + s.amount, 0),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async fetchGroupMembers(groupId: string) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/groups/${groupId}/members`, {
      headers: {
        'x-dev-user-id': 'system-mcp',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch group members: ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchGroupBalances(groupId: string) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/groups/${groupId}/balances`, {
      headers: {
        'x-dev-user-id': 'system-mcp',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch group balances: ${response.statusText}`);
    }

    return response.json();
  }

  private async parseExpenseWithLLM(
    text: string,
    groupMembers: any[],
    userId: string,
  ): Promise<any> {
    // This would integrate with Anthropic's API or another LLM
    // For now, return a structured response that would come from the LLM

    // Simple regex-based parsing for demonstration
    const amountMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
    const amount =
      amountMatch && amountMatch[1] ? parseFloat(amountMatch[1]) : 0;

    // Look for names mentioned in the text
    const mentionedMembers = groupMembers.filter((member) =>
      text.toLowerCase().includes(member.name.toLowerCase()),
    );

    return {
      description: text,
      amount: amount * 100, // Convert to cents
      paidById: userId,
      splitType: 'equal' as const,
      splits:
        mentionedMembers.length > 0
          ? mentionedMembers.map((m) => ({ userId: m.id }))
          : [{ userId }],
      confidence: amount > 0 ? 0.8 : 0.3,
    };
  }

  private async validateParsedExpense(
    expense: any,
    _groupId: string,
    userId: string,
  ): Promise<any> {
    const warnings: string[] = [];
    let requiresReview = false;

    if (expense.amount <= 0) {
      warnings.push('Could not detect a valid amount in the description');
      requiresReview = true;
    }

    if (expense.splits.length === 0) {
      warnings.push('No participants detected, defaulting to expense creator');
      expense.splits = [{ userId }];
    }

    if (expense.confidence < 0.7) {
      warnings.push(
        'Low confidence in expense parsing, please review carefully',
      );
      requiresReview = true;
    }

    return {
      ...expense,
      warnings,
      requiresReview,
    };
  }

  private async validateExpenseDraft(
    draft: any,
    _groupId: string,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!draft.description || draft.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (draft.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!draft.splits || draft.splits.length === 0) {
      errors.push('At least one participant is required');
    }

    // Validate split amounts
    if (draft.splitType === 'exact') {
      const totalSplitAmount = draft.splits.reduce(
        (sum: number, split: any) => sum + (split.amount || 0),
        0,
      );
      if (Math.abs(totalSplitAmount - draft.amount) > 1) {
        // Allow 1 cent difference for rounding
        errors.push(
          `Split amounts (${totalSplitAmount}) don't match expense amount (${draft.amount})`,
        );
      }
    }

    if (draft.splitType === 'percentage') {
      const totalPercentage = draft.splits.reduce(
        (sum: number, split: any) => sum + (split.percentage || 0),
        0,
      );
      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.push(
          `Split percentages must add up to 100% (currently ${totalPercentage}%)`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  private async generateBalanceExplanation(
    balances: any,
    _focusUserId?: string,
  ): Promise<string> {
    // Generate human-friendly explanation of balances
    if (!balances || balances.length === 0) {
      return "This group has no expenses yet, so everyone's balance is $0.00.";
    }

    let explanation = "Here's the current balance summary:\n\n";

    balances.forEach((balance: any) => {
      const amount = Math.abs(balance.balance) / 100;
      if (balance.balance > 0) {
        explanation += `• ${balance.name} is owed $${amount.toFixed(2)}\n`;
      } else if (balance.balance < 0) {
        explanation += `• ${balance.name} owes $${amount.toFixed(2)}\n`;
      } else {
        explanation += `• ${balance.name} is all settled up\n`;
      }
    });

    return explanation;
  }

  private async calculateOptimalSettlements(balances: any[]): Promise<any[]> {
    // Implement settlement optimization algorithm
    const creditors = balances.filter((b) => b.balance > 0);
    const debtors = balances.filter((b) => b.balance < 0);
    const settlements = [];

    let i = 0;
    let j = 0;
    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];

      const amount = Math.min(creditor.balance, -debtor.balance);

      settlements.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount,
        fromName: debtor.name,
        toName: creditor.name,
      });

      creditor.balance -= amount;
      debtor.balance += amount;

      if (creditor.balance === 0) i++;
      if (debtor.balance === 0) j++;
    }

    return settlements;
  }

  private async generateSettlementExplanation(
    settlements: any[],
  ): Promise<string> {
    if (settlements.length === 0) {
      return 'Great! Everyone is already settled up. No payments needed.';
    }

    let explanation = `To settle all balances with ${
      settlements.length
    } payment${settlements.length > 1 ? 's' : ''}:\n\n`;

    settlements.forEach((settlement, index) => {
      const amount = settlement.amount / 100;
      explanation += `${index + 1}. ${settlement.fromName} pays ${
        settlement.toName
      } $${amount.toFixed(2)}\n`;
    });

    return explanation;
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('JASB MCP Server running on stdio');
  }
}

// Check if this module is being run directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))
) {
  const server = new JASBMCPServer();
  server.run().catch((error) => {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  });
}
