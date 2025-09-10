import type {
  Balance,
  CreateDraftRequest,
  CreateExpenseRequest,
  CreateGroupRequest,
  Expense,
  ExpenseDraft,
  Group,
  UpdateDraftRequest,
  User,
} from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getAuthToken } from './supabase';

// API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// HTTP client with authentication
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add authentication token if available
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // For development/testing, allow test user headers
    if (__DEV__) {
      const testUserId = process.env.EXPO_PUBLIC_TEST_USER_ID;
      const testUserEmail = process.env.EXPO_PUBLIC_TEST_USER_EMAIL;

      if (testUserId) {
        headers['X-Test-User-ID'] = testUserId;
      }
      if (testUserEmail) {
        headers['X-Test-User-Email'] = testUserEmail;
      }
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = await this.getHeaders();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      );
      (error as any).status = response.status;
      (error as any).code = errorData.code;
      (error as any).details = errorData.details;
      throw error;
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    headers?: HeadersInit,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create API client instance
const apiClient = new ApiClient(API_BASE_URL);

// Query keys for React Query
export const queryKeys = {
  user: ['user'] as const,
  userProfile: (id: string) => ['users', id] as const,
  groups: ['groups'] as const,
  group: (id: string) => ['groups', id] as const,
  groupExpenses: (groupId: string) => ['groups', groupId, 'expenses'] as const,
  groupBalances: (groupId: string) => ['groups', groupId, 'balances'] as const,
  groupDrafts: (groupId: string) => ['groups', groupId, 'drafts'] as const,
  expense: (id: string) => ['expenses', id] as const,
  draft: (id: string) => ['drafts', id] as const,
};

// API response types
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    has_more: boolean;
    total?: number;
    cursor?: string;
  };
}

// User profile API hooks
export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => apiClient.get<User>('/v1/users/me'),
  });
};

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: () => apiClient.get<User>(`/v1/users/${userId}`),
    enabled: !!userId,
  });
};

export const useCreateUserProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: {
      id: string;
      email: string;
      name: string;
      avatar_url?: string;
    }) => apiClient.post<User>('/v1/users', userData),
    onSuccess: (user) => {
      // Cache user profile
      queryClient.setQueryData(queryKeys.user, user);
      queryClient.setQueryData(queryKeys.userProfile(user.id), user);
    },
  });
};

export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: { name?: string; avatar_url?: string }) =>
      apiClient.patch<User>('/v1/users/me', updates),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.user, user);
      queryClient.setQueryData(queryKeys.userProfile(user.id), user);
    },
  });
};

// Groups API hooks
export const useGroups = () => {
  return useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => apiClient.get<PaginatedResponse<Group>>('/v1/groups'),
    select: (data) => data.data, // Extract just the groups array
  });
};

export const useGroup = (groupId: string) => {
  return useQuery({
    queryKey: queryKeys.group(groupId),
    queryFn: () => apiClient.get<Group>(`/v1/groups/${groupId}`),
    enabled: !!groupId,
  });
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGroupRequest) =>
      apiClient.post<Group>('/v1/groups', data),
    onSuccess: () => {
      // Invalidate groups list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    },
  });
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => apiClient.delete(`/v1/groups/${groupId}`),
    onSuccess: (_, groupId) => {
      // Remove the group from cache and invalidate groups list
      queryClient.removeQueries({ queryKey: queryKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    },
  });
};

// Group member management hooks
export const useInviteToGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, email }: { groupId: string; email: string }) =>
      apiClient.post(`/v1/groups/${groupId}/invite`, { email }),
    onSuccess: (_, { groupId }) => {
      // Refetch group details to show new member
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    },
  });
};

export const useRemoveFromGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      apiClient.delete(`/v1/groups/${groupId}/members/${userId}`),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    },
  });
};

// Expenses API hooks (placeholder - would need backend implementation)
export const useGroupExpenses = (groupId: string) => {
  return useQuery({
    queryKey: queryKeys.groupExpenses(groupId),
    queryFn: () =>
      apiClient.get<PaginatedResponse<Expense>>(
        `/v1/groups/${groupId}/expenses`,
      ),
    select: (data) => data.data,
    enabled: !!groupId,
  });
};

export const useExpense = (expenseId: string) => {
  return useQuery({
    queryKey: queryKeys.expense(expenseId),
    queryFn: () => apiClient.get<Expense>(`/v1/expenses/${expenseId}`),
    enabled: !!expenseId,
  });
};

export const useCreateExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      expense,
    }: {
      groupId: string;
      expense: CreateExpenseRequest;
    }) =>
      apiClient.post<Expense>(`/v1/groups/${groupId}/expenses`, expense, {
        'Idempotency-Key': `expense-${Date.now()}-${Math.random()}`,
      }),
    onSuccess: (_, { groupId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupExpenses(groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupBalances(groupId),
      });
    },
  });
};

// Balances API hooks (placeholder)
export const useGroupBalances = (groupId: string) => {
  return useQuery({
    queryKey: queryKeys.groupBalances(groupId),
    queryFn: () => apiClient.get<Balance[]>(`/v1/groups/${groupId}/balances`),
    enabled: !!groupId,
  });
};

// Drafts API hooks
export const useGroupDrafts = (
  groupId: string,
  status?: 'pending_review' | 'approved' | 'rejected',
) => {
  return useQuery({
    queryKey: [...queryKeys.groupDrafts(groupId), status],
    queryFn: () => {
      const params = status ? `?status=${status}` : '';
      return apiClient.get<ExpenseDraft[]>(
        `/v1/groups/${groupId}/drafts${params}`,
      );
    },
    enabled: !!groupId,
  });
};

export const useDraft = (groupId: string, draftId: string) => {
  return useQuery({
    queryKey: queryKeys.draft(draftId),
    queryFn: () =>
      apiClient.get<ExpenseDraft>(`/v1/groups/${groupId}/drafts/${draftId}`),
    enabled: !!groupId && !!draftId,
  });
};

export const useCreateDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      draft,
    }: {
      groupId: string;
      draft: CreateDraftRequest;
    }) => apiClient.post<ExpenseDraft>(`/v1/groups/${groupId}/drafts`, draft),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupDrafts(groupId),
      });
    },
  });
};

export const useUpdateDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      draftId,
      updates,
    }: {
      groupId: string;
      draftId: string;
      updates: UpdateDraftRequest;
    }) =>
      apiClient.patch<ExpenseDraft>(
        `/v1/groups/${groupId}/drafts/${draftId}`,
        updates,
      ),
    onSuccess: (_, { groupId, draftId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.draft(draftId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupDrafts(groupId),
      });
    },
  });
};

export const useReviewDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      draftId,
      action,
      reason,
    }: {
      groupId: string;
      draftId: string;
      action: 'approve' | 'reject';
      reason?: string;
    }) =>
      apiClient.post<ExpenseDraft>(
        `/v1/groups/${groupId}/drafts/${draftId}/review`,
        { action, reason },
      ),
    onSuccess: (_, { groupId, draftId }) => {
      // Invalidate draft and group queries
      queryClient.invalidateQueries({ queryKey: queryKeys.draft(draftId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupDrafts(groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupExpenses(groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupBalances(groupId),
      });
    },
  });
};

export const useDeleteDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, draftId }: { groupId: string; draftId: string }) =>
      apiClient.delete(`/v1/groups/${groupId}/drafts/${draftId}`),
    onSuccess: (_, { groupId, draftId }) => {
      queryClient.removeQueries({ queryKey: queryKeys.draft(draftId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupDrafts(groupId),
      });
    },
  });
};

// Error handling helper
export const isApiError = (
  error: unknown,
): error is Error & {
  status: number;
  code?: string;
  details?: any;
} => {
  return error instanceof Error && 'status' in error;
};

// Helper to show user-friendly error messages
export const getErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    // Handle specific error codes
    switch (error.code) {
      case 'NOT_FOUND':
        return 'The requested item was not found.';
      case 'FORBIDDEN':
        return 'You do not have permission to perform this action.';
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again.';
      case 'UNAUTHORIZED':
        return 'Please sign in to continue.';
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
};
