// JASB Shared Types
// Common types used across the frontend and backend

// Currency types
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];

// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

// Group types
export interface Group {
  id: string;
  name: string;
  currency_code: Currency;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: GroupMember[];
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: User;
}

// Split types
export type SplitType = 'equal' | 'exact' | 'percentage';

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  user?: User;
}

// Expense types
export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency_code: Currency;
  paid_by: string;
  split_type: SplitType;
  created_at: string;
  updated_at: string;
  splits: ExpenseSplit[];
  payer?: User;
  // Store original user input for editing
  member_shares?: Record<string, string>;
  member_amounts?: Record<string, string>;
}

// Draft types
export interface ExpenseDraft {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency_code: Currency;
  paid_by: string;
  split_type: SplitType;
  created_by: string;
  created_at: string;
  updated_at: string;
  splits: DraftSplit[];
  payer?: User;
  creator?: User;
}

export interface DraftSplit {
  id: string;
  draft_id: string;
  user_id: string;
  amount: number;
  user?: User;
}

// Balance types
export interface Balance {
  user_id: string;
  balance: number;
  user?: User;
}

// API Request types
export interface CreateGroupRequest {
  name: string;
  currency_code?: Currency;
}

export interface CreateExpenseRequest {
  title?: string;
  description?: string;
  amount?: number;
  amount_cents?: number;
  currency_code?: Currency;
  paid_by: string;
  split_type: SplitType;
  splits?: {
    user_id: string;
    amount: number;
  }[];
  member_amounts?: Record<string, string>;
  member_shares?: Record<string, string>;
}

export interface UpdateExpenseRequest {
  title?: string;
  description?: string;
  amount?: number;
  amount_cents?: number;
  currency_code?: Currency;
  paid_by?: string;
  split_type?: SplitType;
  splits?: {
    user_id: string;
    amount: number;
  }[];
  member_amounts?: Record<string, string>;
  member_shares?: Record<string, string>;
}

export interface CreateDraftRequest {
  description: string;
  amount: number;
  currency_code?: Currency;
  paid_by: string;
  split_type: SplitType;
  splits: {
    user_id: string;
    amount: number;
  }[];
}

export interface UpdateDraftRequest {
  description?: string;
  amount?: number;
  currency_code?: Currency;
  paid_by?: string;
  split_type?: SplitType;
  splits?: {
    user_id: string;
    amount: number;
  }[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Settlement types (for balancing expenses)
export interface Settlement {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  from_user?: User;
  to_user?: User;
}

// Settlement record types (actual payments made)
export interface SettlementRecord {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  description?: string;
  created_at: string;
  created_by: string;
  from_user?: User;
  to_user?: User;
  creator?: User;
}

// Settlement request types
export interface CreateSettlementRequest {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  description?: string;
  created_by?: string;
}