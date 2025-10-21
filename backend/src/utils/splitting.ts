import type { SplitType } from '@shared/types';

/**
 * Interface for split calculation input
 */
export interface SplitCalculationInput {
  totalAmountCents: number;
  splitType: SplitType;
  participants: string[]; // User IDs
  customSplits?: {
    user_id: string;
    amount_cents?: number;
    percent?: number;
    shares?: number;
  }[];
}

/**
 * Interface for split calculation result
 */
export interface SplitCalculationResult {
  splits: {
    user_id: string;
    amount_cents: number;
    percent?: number;
    shares?: number;
  }[];
  totalCalculated: number;
  isValid: boolean;
  errors?: string[];
}

const normalizeSplitType = (splitType: SplitType): SplitType => {
  if (splitType === 'exact') {
    return 'amount';
  }
  if (splitType === 'percentage') {
    return 'share';
  }
  return splitType;
};

/**
 * Calculate equal split among all participants
 */
function calculateEqualSplit(
  totalAmountCents: number,
  participants: string[],
): SplitCalculationResult {
  const baseAmount = Math.floor(totalAmountCents / participants.length);
  const remainder = totalAmountCents % participants.length;

  const splits = participants.map((userId, index) => ({
    user_id: userId,
    amount_cents: baseAmount + (index < remainder ? 1 : 0), // Distribute remainder to first N users
  }));

  const totalCalculated = splits.reduce(
    (sum, split) => sum + split.amount_cents,
    0,
  );

  return {
    splits,
    totalCalculated,
    isValid: totalCalculated === totalAmountCents,
  };
}

/**
 * Calculate splits based on exact amounts
 */
function calculateAmountSplit(
  totalAmountCents: number,
  customSplits: SplitCalculationInput['customSplits'],
): SplitCalculationResult {
  if (!customSplits) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors: ['Custom splits are required'],
    };
  }

  const errors: string[] = [];
  const splits = customSplits.map((split) => {
    if (split.amount_cents === undefined || split.amount_cents < 0) {
      errors.push(`Invalid amount for user ${split.user_id}`);
      return { user_id: split.user_id, amount_cents: 0 };
    }

    return {
      user_id: split.user_id,
      amount_cents: split.amount_cents,
    };
  });

  if (errors.length > 0) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors,
    };
  }

  const totalCalculated = splits.reduce(
    (sum, split) => sum + split.amount_cents,
    0,
  );

  // Allow 1 cent tolerance for rounding
  const isValid = Math.abs(totalCalculated - totalAmountCents) <= 1;

  if (!isValid) {
    errors.push(
      `Split amounts (${totalCalculated}) don't match expense total (${totalAmountCents})`,
    );
  }

  return {
    splits,
    totalCalculated,
    isValid,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Calculate splits based on percentages
 */
function calculatePercentSplit(
  totalAmountCents: number,
  customSplits: SplitCalculationInput['customSplits'],
): SplitCalculationResult {
  if (!customSplits) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors: ['Custom splits are required'],
    };
  }

  const errors: string[] = [];
  let totalPercent = 0;

  // Validate percentages
  for (const split of customSplits) {
    if (
      split.percent === undefined ||
      split.percent < 0 ||
      split.percent > 100
    ) {
      errors.push(
        `Invalid percentage for user ${split.user_id}: ${split.percent}`,
      );
    } else {
      totalPercent += split.percent;
    }
  }

  if (errors.length > 0) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors,
    };
  }

  // Check total percentage
  if (Math.abs(totalPercent - 100) > 0.01) {
    errors.push(`Percentages must add up to 100% (got ${totalPercent}%)`);
  }

  if (errors.length > 0) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors,
    };
  }

  // Calculate amounts based on percentages
  const splits = customSplits.map((split) => {
    const amount = Math.round((split.percent! / 100) * totalAmountCents);
    return {
      user_id: split.user_id,
      amount_cents: amount,
      percent: split.percent,
    };
  });

  const totalCalculated = splits.reduce(
    (sum, split) => sum + split.amount_cents,
    0,
  );

  // Adjust for rounding errors
  const difference = totalAmountCents - totalCalculated;
  if (difference !== 0 && Math.abs(difference) <= splits.length) {
    // Distribute the difference among splits
    const increment = difference > 0 ? 1 : -1;
    let remaining = Math.abs(difference);

    for (let i = 0; i < splits.length && remaining > 0; i += 1) {
      const targetSplit = splits[i];
      if (!targetSplit) {
        break;
      }
      targetSplit.amount_cents += increment;
      remaining -= 1;
    }
  }

  const finalTotal = splits.reduce((sum, split) => sum + split.amount_cents, 0);

  return {
    splits,
    totalCalculated: finalTotal,
    isValid: finalTotal === totalAmountCents,
  };
}

/**
 * Calculate splits based on shares
 */
function calculateShareSplit(
  totalAmountCents: number,
  customSplits: SplitCalculationInput['customSplits'],
): SplitCalculationResult {
  if (!customSplits) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors: ['Custom splits are required'],
    };
  }

  const errors: string[] = [];
  let totalShares = 0;

  // Validate shares
  for (const split of customSplits) {
    if (split.shares === undefined || split.shares <= 0) {
      errors.push(`Invalid shares for user ${split.user_id}: ${split.shares}`);
    } else {
      totalShares += split.shares;
    }
  }

  if (errors.length > 0) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors,
    };
  }

  if (totalShares === 0) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors: ['Total shares must be greater than 0'],
    };
  }

  // Calculate amounts based on shares
  const baseAmountPerShare = totalAmountCents / totalShares;
  const splits = customSplits.map((split) => {
    const amount = Math.round(baseAmountPerShare * split.shares!);
    return {
      user_id: split.user_id,
      amount_cents: amount,
      shares: split.shares,
    };
  });

  const totalCalculated = splits.reduce(
    (sum, split) => sum + split.amount_cents,
    0,
  );

  // Adjust for rounding errors
  const difference = totalAmountCents - totalCalculated;
  if (difference !== 0) {
    // Add/subtract the difference from the user with the most shares
    const maxSharesIndex = splits.reduce((maxIdx, split, idx) => {
      const currentShares = split.shares ?? 0;
      const maxShares = splits[maxIdx]?.shares ?? 0;
      return currentShares > maxShares ? idx : maxIdx;
    }, 0);
    const targetSplit = splits[maxSharesIndex];
    if (targetSplit) {
      targetSplit.amount_cents += difference;
    }
  }

  const finalTotal = splits.reduce((sum, split) => sum + split.amount_cents, 0);

  return {
    splits,
    totalCalculated: finalTotal,
    isValid: finalTotal === totalAmountCents,
  };
}

/**
 * Calculate expense splits based on split type and parameters
 */
export function calculateExpenseSplits(
  input: SplitCalculationInput,
): SplitCalculationResult {
  const { totalAmountCents, splitType, participants, customSplits } = input;
  const normalizedSplitType = normalizeSplitType(splitType);
  const errors: string[] = [];

  if (totalAmountCents <= 0) {
    errors.push('Total amount must be positive');
  }

  if (participants.length === 0) {
    errors.push('At least one participant is required');
  }

  if (errors.length > 0) {
    return {
      splits: [],
      totalCalculated: 0,
      isValid: false,
      errors,
    };
  }

  switch (normalizedSplitType) {
    case 'equal':
      return calculateEqualSplit(totalAmountCents, participants);

    case 'amount':
      if (!customSplits) {
        return {
          splits: [],
          totalCalculated: 0,
          isValid: false,
          errors: ['Custom splits required for amount-based splitting'],
        };
      }
      return calculateAmountSplit(totalAmountCents, customSplits);

    case 'percent':
      if (!customSplits) {
        return {
          splits: [],
          totalCalculated: 0,
          isValid: false,
          errors: ['Custom splits required for percentage-based splitting'],
        };
      }
      return calculatePercentSplit(totalAmountCents, customSplits);

    case 'share':
      if (!customSplits) {
        return {
          splits: [],
          totalCalculated: 0,
          isValid: false,
          errors: ['Custom splits required for share-based splitting'],
        };
      }
      return calculateShareSplit(totalAmountCents, customSplits);

    default:
      return {
        splits: [],
        totalCalculated: 0,
        isValid: false,
        errors: [`Invalid split type: ${splitType}`],
      };
  }
}

/**
 * Validate a split configuration before creating expense
 */
export function validateSplitConfiguration(input: SplitCalculationInput): {
  isValid: boolean;
  errors: string[];
} {
  const result = calculateExpenseSplits(input);
  return {
    isValid: result.isValid,
    errors: result.errors || [],
  };
}

/**
 * Helper function to format split amounts for display
 */
export function formatSplitAmount(
  amountCents: number,
  currencyCode: string = 'USD',
): string {
  const amount = amountCents / 100;

  switch (currencyCode) {
    case 'USD':
    case 'CAD':
    case 'AUD':
      return `$${amount.toFixed(2)}`;
    case 'EUR':
      return `€${amount.toFixed(2)}`;
    case 'GBP':
      return `£${amount.toFixed(2)}`;
    case 'JPY':
      return `¥${Math.round(amount)}`;
    default:
      return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Helper function to get split summary text
 */
export function getSplitSummaryText(
  splitType: SplitType,
  participantCount: number,
  totalAmountCents: number,
  currencyCode: string = 'USD',
): string {
  const totalAmount = formatSplitAmount(totalAmountCents, currencyCode);

  switch (splitType) {
    case 'equal': {
      const perPerson = formatSplitAmount(
        Math.round(totalAmountCents / participantCount),
        currencyCode,
      );
      return `${totalAmount} split equally among ${participantCount} people (≈${perPerson} each)`;
    }

    case 'amount':
      return `${totalAmount} split by custom amounts`;

    case 'percent':
      return `${totalAmount} split by percentages`;

    case 'share':
      return `${totalAmount} split by shares`;

    default:
      return `${totalAmount} split`;
  }
}
