/**
 * Interface for settlement suggestion
 */
export interface SettlementSuggestion {
  from_user: string;
  to_user: string;
  amount_cents: number;
  description?: string;
}

/**
 * Interface for user balance
 */
export interface UserBalance {
  user_id: string;
  balance_cents: number; // Positive means owed money, negative means owes money
  user_name?: string;
  user_email?: string;
}

/**
 * Calculate optimal settlement suggestions to minimize number of transactions
 * Uses a greedy approach similar to the "debt settlement" problem
 */
export function calculateSettlements(
  balances: UserBalance[],
): SettlementSuggestion[] {
  // Filter out users with zero balances (already settled)
  const nonZeroBalances = balances.filter(
    (b) => Math.abs(b.balance_cents) >= 1,
  ); // Allow 1 cent tolerance

  if (nonZeroBalances.length <= 1) {
    return []; // No settlements needed
  }

  // Separate creditors (positive balance) and debtors (negative balance)
  const creditors = nonZeroBalances
    .filter((b) => b.balance_cents > 0)
    .sort((a, b) => b.balance_cents - a.balance_cents); // Sort descending

  const debtors = nonZeroBalances
    .filter((b) => b.balance_cents < 0)
    .map((b) => ({ ...b, balance_cents: Math.abs(b.balance_cents) })) // Make positive for easier calculation
    .sort((a, b) => b.balance_cents - a.balance_cents); // Sort descending

  const settlements: SettlementSuggestion[] = [];

  // Use greedy approach: match largest creditor with largest debtor
  let i = 0; // creditors index
  let j = 0; // debtors index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    // Calculate settlement amount (minimum of what creditor is owed and what debtor owes)
    const settlementAmount = Math.min(
      creditor.balance_cents,
      debtor.balance_cents,
    );

    if (settlementAmount > 0) {
      settlements.push({
        from_user: debtor.user_id,
        to_user: creditor.user_id,
        amount_cents: settlementAmount,
        description: generateSettlementDescription(
          debtor.user_name || debtor.user_id,
          creditor.user_name || creditor.user_id,
          settlementAmount,
        ),
      });

      // Update balances
      creditor.balance_cents -= settlementAmount;
      debtor.balance_cents -= settlementAmount;
    }

    // Move to next creditor/debtor if current one is settled
    if (creditor.balance_cents === 0) {
      i++;
    }
    if (debtor.balance_cents === 0) {
      j++;
    }
  }

  return settlements;
}

/**
 * Generate a human-readable description for a settlement
 */
function generateSettlementDescription(
  debtorName: string,
  creditorName: string,
  amountCents: number,
): string {
  const amount = (amountCents / 100).toFixed(2);
  return `${debtorName} pays ${creditorName} $${amount}`;
}

/**
 * Calculate balances for a group based on expenses
 * This would typically query the database, but here's the calculation logic
 */
export function calculateGroupBalances(
  expenses: Array<{
    id: string;
    paid_by: string;
    amount_cents: number;
    splits: Array<{
      user_id: string;
      amount_cents: number;
    }>;
  }>,
): UserBalance[] {
  const balanceMap: { [userId: string]: number } = {};

  // Process each expense
  for (const expense of expenses) {
    // Add the full amount to the person who paid
    if (!balanceMap[expense.paid_by]) {
      balanceMap[expense.paid_by] = 0;
    }
    balanceMap[expense.paid_by] += expense.amount_cents;

    // Subtract each person's share
    for (const split of expense.splits) {
      if (!balanceMap[split.user_id]) {
        balanceMap[split.user_id] = 0;
      }
      balanceMap[split.user_id] -= split.amount_cents;
    }
  }

  // Convert to UserBalance array
  return Object.entries(balanceMap).map(([user_id, balance_cents]) => ({
    user_id,
    balance_cents,
  }));
}

/**
 * Validate settlement suggestions
 */
export function validateSettlements(settlements: SettlementSuggestion[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for invalid amounts
  const invalidAmounts = settlements.filter((s) => s.amount_cents <= 0);
  if (invalidAmounts.length > 0) {
    errors.push(
      `Invalid settlement amounts found: ${invalidAmounts.length} settlements with non-positive amounts`,
    );
  }

  // Check for self-payments
  const selfPayments = settlements.filter((s) => s.from_user === s.to_user);
  if (selfPayments.length > 0) {
    errors.push(
      `Self-payments found: ${selfPayments.length} settlements where from_user equals to_user`,
    );
  }

  // Check that settlements net to zero
  const userTotals: { [userId: string]: number } = {};

  for (const settlement of settlements) {
    // Person paying loses money (negative)
    if (!userTotals[settlement.from_user]) {
      userTotals[settlement.from_user] = 0;
    }
    userTotals[settlement.from_user] -= settlement.amount_cents;

    // Person receiving gains money (positive)
    if (!userTotals[settlement.to_user]) {
      userTotals[settlement.to_user] = 0;
    }
    userTotals[settlement.to_user] += settlement.amount_cents;
  }

  // Check that all totals are approximately zero (allowing for small rounding errors)
  const totalSum = Object.values(userTotals).reduce(
    (sum, total) => sum + total,
    0,
  );
  if (Math.abs(totalSum) > 1) {
    // Allow 1 cent tolerance
    errors.push(`Settlements don't balance: total sum is ${totalSum} cents`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get settlement summary statistics
 */
export function getSettlementSummary(settlements: SettlementSuggestion[]): {
  totalTransactions: number;
  totalAmountCents: number;
  averageTransactionCents: number;
  largestTransactionCents: number;
  smallestTransactionCents: number;
} {
  if (settlements.length === 0) {
    return {
      totalTransactions: 0,
      totalAmountCents: 0,
      averageTransactionCents: 0,
      largestTransactionCents: 0,
      smallestTransactionCents: 0,
    };
  }

  const amounts = settlements.map((s) => s.amount_cents);
  const totalAmountCents = amounts.reduce((sum, amount) => sum + amount, 0);

  return {
    totalTransactions: settlements.length,
    totalAmountCents,
    averageTransactionCents: Math.round(totalAmountCents / settlements.length),
    largestTransactionCents: Math.max(...amounts),
    smallestTransactionCents: Math.min(...amounts),
  };
}

/**
 * Format settlement for display
 */
export function formatSettlement(
  settlement: SettlementSuggestion,
  currencyCode: string = 'USD',
): string {
  const amount = settlement.amount_cents / 100;
  const currency = currencyCode === 'USD' ? '$' : currencyCode;

  return `${currency}${amount.toFixed(2)}`;
}

/**
 * Simple settlement optimization: merge small settlements between same users
 */
export function optimizeSettlements(
  settlements: SettlementSuggestion[],
  minAmountCents: number = 50,
): SettlementSuggestion[] {
  const userPairMap: { [key: string]: SettlementSuggestion } = {};

  // Consolidate settlements between same user pairs
  for (const settlement of settlements) {
    const pairKey = `${settlement.from_user}:${settlement.to_user}`;
    const reversePairKey = `${settlement.to_user}:${settlement.from_user}`;

    if (userPairMap[reversePairKey]) {
      // There's a reverse settlement, net them out
      const existing = userPairMap[reversePairKey];
      const netAmount = existing.amount_cents - settlement.amount_cents;

      if (netAmount === 0) {
        // They cancel out completely
        delete userPairMap[reversePairKey];
      } else if (netAmount > 0) {
        // Original direction wins
        existing.amount_cents = netAmount;
      } else {
        // New direction wins
        delete userPairMap[reversePairKey];
        userPairMap[pairKey] = {
          ...settlement,
          amount_cents: Math.abs(netAmount),
        };
      }
    } else if (userPairMap[pairKey]) {
      // Same direction, add amounts
      userPairMap[pairKey].amount_cents += settlement.amount_cents;
    } else {
      // New settlement
      userPairMap[pairKey] = { ...settlement };
    }
  }

  // Filter out settlements below minimum amount
  return Object.values(userPairMap).filter(
    (s) => s.amount_cents >= minAmountCents,
  );
}
