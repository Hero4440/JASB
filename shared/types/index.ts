// Shared types between frontend and backend for JASB expense splitting app

export type SplitType =
  | 'equal'
  | 'percent'
  | 'amount'
  | 'share'
  | 'exact'
  | 'percentage';

export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'INR',
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export type Currency = SupportedCurrency;

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Group {
  id: string;
  name: string;
  currency_code: Currency | string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
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
  currency_code: Currency | string;
  paid_by: string;
  paid_by_user?: User;
  amount?: number;
  payer?: User;
  receipt_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  splits?: ExpenseSplit[];
  member_amounts?: Record<string, string>;
  member_shares?: Record<string, string>;
  split_type: SplitType;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  user?: User;
  amount_cents: number;
  split_type: SplitType;
  created_at: string;
  amount?: number;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  from_user_id?: string;
  from_user_details?: User;
  to_user: string;
  to_user_id?: string;
  to_user_details?: User;
  amount_cents: number;
  amount?: number;
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
  amount?: number;
  payer?: User;
  participants: string[]; // user IDs
  split_type: SplitType;
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
  balance?: number;
}

export interface SettlementSuggestion {
  from_user: string;
  from_user_id?: string;
  from_user_details?: User;
  to_user: string;
  to_user_id?: string;
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
  split_type?: SplitType;
  splits?: Array<{
    user_id: string;
    amount_cents?: number;
    percent?: number;
    shares?: number;
  }>;
  member_amounts?: Record<string, string>;
  member_shares?: Record<string, string>;
}

export interface UpdateExpenseRequest {
  title?: string;
  amount_cents?: number;
  currency_code?: string;
  paid_by?: string;
  description?: string;
  split_type?: SplitType;
  splits?: Array<{
    user_id: string;
    amount_cents?: number;
    percent?: number;
    shares?: number;
  }>;
  member_amounts?: Record<string, string>;
  member_shares?: Record<string, string>;
}

export interface CreateDraftRequest {
  title: string;
  amount_cents: number;
  amount?: number;
  paid_by: string;
  participants: string[];
  split_type: SplitType;
  source: 'manual' | 'llm_parsed';
  llm_metadata?: Record<string, any>;
  description?: string;
  splits?: Array<{
    user_id: string;
    amount_cents?: number;
    percent?: number;
    shares?: number;
  }>;
}

export interface UpdateDraftRequest {
  title?: string;
  amount_cents?: number;
  paid_by?: string;
  participants?: string[];
  split_type?: SplitType;
}

export interface CreateSettlementRequest {
  from_user?: string;
  from_user_id?: string;
  to_user?: string;
  to_user_id?: string;
  amount_cents?: number;
  amount?: number;
  description?: string;
}

export interface SettlementRecord {
  id: string;
  group_id: string;
  from_user: string;
  from_user_id?: string;
  to_user: string;
  to_user_id?: string;
  amount_cents: number;
  description?: string;
  created_at: string;
  created_by: string;
  from_user_details?: User;
  to_user_details?: User;
  created_by_user?: User;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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
