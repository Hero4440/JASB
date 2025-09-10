// Shared types between frontend and backend for JASB expense splitting app

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  currency_code: string;
  created_by: string;
  created_at: string;
  members?: GroupMember[];
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  user?: User;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  title: string;
  amount_cents: number;
  currency_code: string;
  paid_by: string;
  paid_by_user?: User;
  receipt_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  user?: User;
  amount_cents: number;
  split_type: 'equal' | 'percent' | 'amount' | 'share';
  created_at: string;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  from_user_details?: User;
  to_user: string;
  to_user_details?: User;
  amount_cents: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ExpenseDraft {
  id: string;
  group_id: string;
  created_by: string;
  created_by_user?: User;
  title: string;
  amount_cents: number;
  paid_by: string;
  paid_by_user?: User;
  participants: string[]; // user IDs
  split_type: 'equal' | 'percent' | 'amount' | 'share';
  status: 'pending_review' | 'approved' | 'rejected';
  source: 'manual' | 'llm_parsed';
  llm_metadata?: Record<string, any>;
  validation_warnings?: string[];
  created_at: string;
  updated_at: string;
}

export interface Balance {
  user_id: string;
  user?: User;
  net_cents: number; // positive = owed money, negative = owes money
}

export interface SettlementSuggestion {
  from_user: string;
  from_user_details?: User;
  to_user: string;
  to_user_details?: User;
  amount_cents: number;
}

// API Request/Response types
export interface CreateGroupRequest {
  name: string;
  currency_code?: string;
}

export interface CreateExpenseRequest {
  title: string;
  amount_cents: number;
  currency_code?: string;
  paid_by: string;
  description?: string;
  split_type?: 'equal' | 'percent' | 'amount' | 'share';
  splits?: Array<{
    user_id: string;
    amount_cents?: number;
    percent?: number;
    shares?: number;
  }>;
}

export interface CreateDraftRequest {
  title: string;
  amount_cents: number;
  paid_by: string;
  participants: string[];
  split_type: 'equal' | 'percent' | 'amount' | 'share';
  source: 'manual' | 'llm_parsed';
  llm_metadata?: Record<string, any>;
}

export interface UpdateDraftRequest {
  title?: string;
  amount_cents?: number;
  paid_by?: string;
  participants?: string[];
  split_type?: 'equal' | 'percent' | 'amount' | 'share';
}

export interface CreateSettlementRequest {
  from_user: string;
  to_user: string;
  amount_cents: number;
}

// Error response type
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor?: string;
    has_more: boolean;
    total?: number;
  };
}

// Common currency codes
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];