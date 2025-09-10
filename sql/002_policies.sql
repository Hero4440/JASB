-- JASB Expense Splitting App - Row Level Security Policies
-- This file implements multi-tenant security using Postgres RLS
-- Ensures users can only access groups they belong to and related data

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================
-- Enable RLS on all tables that need tenant isolation

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTIONS FOR POLICIES
-- =============================================================================

-- Get current user's UUID from JWT claims
-- Assumes Supabase auth where user ID is in auth.uid()
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid -- Fallback for testing
  );
$$;

-- Check if current user is a member of a specific group
CREATE OR REPLACE FUNCTION user_is_group_member(group_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = group_uuid 
    AND user_id = current_user_id()
  );
$$;

-- Check if current user is an admin of a specific group
CREATE OR REPLACE FUNCTION user_is_group_admin(group_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = group_uuid 
    AND user_id = current_user_id()
    AND role = 'admin'
  );
$$;

-- Get all group IDs that the current user is a member of
CREATE OR REPLACE FUNCTION user_group_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT group_id FROM group_members WHERE user_id = current_user_id();
$$;

-- =============================================================================
-- USERS TABLE POLICIES
-- =============================================================================
-- Users can see their own profile and profiles of users in their groups

-- Users can view their own profile and other users in their groups
CREATE POLICY users_select_policy ON users
FOR SELECT
USING (
  id = current_user_id() OR  -- Own profile
  id IN (  -- Users in same groups
    SELECT DISTINCT gm2.user_id 
    FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = current_user_id()
  )
);

-- Users can only update their own profile
CREATE POLICY users_update_policy ON users
FOR UPDATE
USING (id = current_user_id());

-- Users can insert their own profile (for user registration)
CREATE POLICY users_insert_policy ON users
FOR INSERT
WITH CHECK (id = current_user_id());

-- =============================================================================
-- GROUPS TABLE POLICIES
-- =============================================================================
-- Users can only see groups they are members of

-- Users can view groups they belong to
CREATE POLICY groups_select_policy ON groups
FOR SELECT
USING (id IN (SELECT user_group_ids()));

-- Any authenticated user can create a group
CREATE POLICY groups_insert_policy ON groups
FOR INSERT
WITH CHECK (created_by = current_user_id());

-- Only group admins can update group details
CREATE POLICY groups_update_policy ON groups
FOR UPDATE
USING (user_is_group_admin(id));

-- Only group admins can delete groups
CREATE POLICY groups_delete_policy ON groups
FOR DELETE
USING (user_is_group_admin(id));

-- =============================================================================
-- GROUP_MEMBERS TABLE POLICIES
-- =============================================================================
-- Users can see membership of groups they belong to

-- Users can view group membership for groups they're in
CREATE POLICY group_members_select_policy ON group_members
FOR SELECT
USING (group_id IN (SELECT user_group_ids()));

-- Group admins can add new members
CREATE POLICY group_members_insert_policy ON group_members
FOR INSERT
WITH CHECK (user_is_group_admin(group_id));

-- Group admins can update member roles, users can leave groups
CREATE POLICY group_members_update_policy ON group_members
FOR UPDATE
USING (
  user_is_group_admin(group_id) OR  -- Admin can update any member
  (user_id = current_user_id() AND role = 'member')  -- User can update own membership
);

-- Group admins can remove members, users can remove themselves
CREATE POLICY group_members_delete_policy ON group_members
FOR DELETE
USING (
  user_is_group_admin(group_id) OR  -- Admin can remove any member
  user_id = current_user_id()  -- User can leave group
);

-- =============================================================================
-- EXPENSES TABLE POLICIES
-- =============================================================================
-- Users can see expenses from groups they belong to

-- Users can view expenses from their groups
CREATE POLICY expenses_select_policy ON expenses
FOR SELECT
USING (group_id IN (SELECT user_group_ids()));

-- Group members can create expenses
CREATE POLICY expenses_insert_policy ON expenses
FOR INSERT
WITH CHECK (
  group_id IN (SELECT user_group_ids()) AND
  paid_by = current_user_id()  -- Can only create expenses they paid for
);

-- Only the person who created the expense can update it (within reasonable time)
CREATE POLICY expenses_update_policy ON expenses
FOR UPDATE
USING (
  paid_by = current_user_id() AND
  group_id IN (SELECT user_group_ids()) AND
  created_at > NOW() - INTERVAL '24 hours'  -- Can only edit within 24 hours
);

-- Only the person who created the expense can delete it (within reasonable time)
CREATE POLICY expenses_delete_policy ON expenses
FOR DELETE
USING (
  paid_by = current_user_id() AND
  group_id IN (SELECT user_group_ids()) AND
  created_at > NOW() - INTERVAL '1 hour'  -- Can only delete within 1 hour
);

-- =============================================================================
-- EXPENSE_SPLITS TABLE POLICIES
-- =============================================================================
-- Users can see splits for expenses in their groups

-- Users can view expense splits for their groups
CREATE POLICY expense_splits_select_policy ON expense_splits
FOR SELECT
USING (
  expense_id IN (
    SELECT id FROM expenses WHERE group_id IN (SELECT user_group_ids())
  )
);

-- System/API can create splits when creating expenses
-- Note: In practice, this would be restricted to service role
CREATE POLICY expense_splits_insert_policy ON expense_splits
FOR INSERT
WITH CHECK (
  expense_id IN (
    SELECT id FROM expenses WHERE group_id IN (SELECT user_group_ids())
  )
);

-- Only expense creator can update splits within time limit
CREATE POLICY expense_splits_update_policy ON expense_splits
FOR UPDATE
USING (
  expense_id IN (
    SELECT e.id FROM expenses e 
    WHERE e.paid_by = current_user_id() 
    AND e.group_id IN (SELECT user_group_ids())
    AND e.created_at > NOW() - INTERVAL '24 hours'
  )
);

-- Only expense creator can delete splits within time limit
CREATE POLICY expense_splits_delete_policy ON expense_splits
FOR DELETE
USING (
  expense_id IN (
    SELECT e.id FROM expenses e 
    WHERE e.paid_by = current_user_id() 
    AND e.group_id IN (SELECT user_group_ids())
    AND e.created_at > NOW() - INTERVAL '1 hour'
  )
);

-- =============================================================================
-- SETTLEMENTS TABLE POLICIES
-- =============================================================================
-- Users can see settlements involving their groups

-- Users can view settlements in their groups
CREATE POLICY settlements_select_policy ON settlements
FOR SELECT
USING (group_id IN (SELECT user_group_ids()));

-- Users can create settlements in their groups
CREATE POLICY settlements_insert_policy ON settlements
FOR INSERT
WITH CHECK (
  group_id IN (SELECT user_group_ids()) AND
  (from_user = current_user_id() OR to_user = current_user_id())  -- Must involve current user
);

-- Users involved in settlement can update status
CREATE POLICY settlements_update_policy ON settlements
FOR UPDATE
USING (
  group_id IN (SELECT user_group_ids()) AND
  (from_user = current_user_id() OR to_user = current_user_id())
);

-- Users involved in settlement can cancel it
CREATE POLICY settlements_delete_policy ON settlements
FOR DELETE
USING (
  group_id IN (SELECT user_group_ids()) AND
  (from_user = current_user_id() OR to_user = current_user_id()) AND
  status = 'pending'  -- Can only delete pending settlements
);

-- =============================================================================
-- EXPENSE_DRAFTS TABLE POLICIES
-- =============================================================================
-- Users can see and manage drafts for their groups

-- Users can view drafts in their groups
CREATE POLICY expense_drafts_select_policy ON expense_drafts
FOR SELECT
USING (group_id IN (SELECT user_group_ids()));

-- Group members can create drafts
CREATE POLICY expense_drafts_insert_policy ON expense_drafts
FOR INSERT
WITH CHECK (
  group_id IN (SELECT user_group_ids()) AND
  created_by = current_user_id()
);

-- Draft creator can update their own drafts, any group member can update status
CREATE POLICY expense_drafts_update_policy ON expense_drafts
FOR UPDATE
USING (
  group_id IN (SELECT user_group_ids()) AND
  (
    created_by = current_user_id() OR  -- Creator can edit everything
    user_is_group_member(group_id)     -- Any member can approve/reject
  )
);

-- Draft creator can delete their own drafts
CREATE POLICY expense_drafts_delete_policy ON expense_drafts
FOR DELETE
USING (
  group_id IN (SELECT user_group_ids()) AND
  created_by = current_user_id()
);

-- =============================================================================
-- AI_EVENTS TABLE POLICIES
-- =============================================================================
-- Users can only see their own AI interactions

-- Users can view their own AI events
CREATE POLICY ai_events_select_policy ON ai_events
FOR SELECT
USING (user_id = current_user_id());

-- System can create AI events (this would typically use service role)
CREATE POLICY ai_events_insert_policy ON ai_events
FOR INSERT
WITH CHECK (user_id = current_user_id());

-- No updates or deletes allowed on AI events (audit trail)

-- =============================================================================
-- IDEMPOTENCY TABLE POLICIES
-- =============================================================================
-- Users can only see their own idempotency keys

-- Users can view their own idempotency records
CREATE POLICY idempotency_select_policy ON idempotency
FOR SELECT
USING (user_id = current_user_id());

-- System can create idempotency records
CREATE POLICY idempotency_insert_policy ON idempotency
FOR INSERT
WITH CHECK (user_id = current_user_id());

-- Auto-cleanup old idempotency records (older than 24 hours)
CREATE POLICY idempotency_delete_policy ON idempotency
FOR DELETE
USING (
  created_at < NOW() - INTERVAL '24 hours' AND
  user_id = current_user_id()
);

-- =============================================================================
-- ADDITIONAL SECURITY FUNCTIONS
-- =============================================================================

-- Function to validate group membership before expensive operations
CREATE OR REPLACE FUNCTION validate_group_access(group_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT user_is_group_member(group_uuid);
$$;

-- Function to get user's current balance in a specific group
-- This respects RLS policies and only works for groups user belongs to
CREATE OR REPLACE FUNCTION get_user_balance_in_group(group_uuid UUID, target_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  WITH user_id_to_check AS (
    SELECT COALESCE(target_user_id, current_user_id()) as uid
  ),
  user_expenses AS (
    -- Amount user paid out
    SELECT COALESCE(SUM(amount_cents), 0) as paid_out
    FROM expenses e
    WHERE e.group_id = group_uuid 
    AND e.paid_by = (SELECT uid FROM user_id_to_check)
  ),
  user_shares AS (
    -- Amount user owes based on splits
    SELECT COALESCE(SUM(es.amount_cents), 0) as owes
    FROM expense_splits es
    JOIN expenses e ON es.expense_id = e.id
    WHERE e.group_id = group_uuid
    AND es.user_id = (SELECT uid FROM user_id_to_check)
  ),
  user_settlements_paid AS (
    -- Amount user has paid in settlements
    SELECT COALESCE(SUM(amount_cents), 0) as settled_out
    FROM settlements s
    WHERE s.group_id = group_uuid
    AND s.from_user = (SELECT uid FROM user_id_to_check)
    AND s.status = 'completed'
  ),
  user_settlements_received AS (
    -- Amount user has received in settlements
    SELECT COALESCE(SUM(amount_cents), 0) as settled_in
    FROM settlements s
    WHERE s.group_id = group_uuid
    AND s.to_user = (SELECT uid FROM user_id_to_check)
    AND s.status = 'completed'
  )
  SELECT (
    (SELECT paid_out FROM user_expenses) - 
    (SELECT owes FROM user_shares) - 
    (SELECT settled_out FROM user_settlements_paid) + 
    (SELECT settled_in FROM user_settlements_received)
  )::INTEGER;
$$;

-- =============================================================================
-- TESTING QUERIES
-- =============================================================================
-- Uncomment to test RLS policies with sample data

/*
-- Test RLS policies by setting a test user context
-- SET request.jwt.claims = '{"sub": "550e8400-e29b-41d4-a716-446655440001"}';

-- Should return groups the user is a member of
-- SELECT * FROM groups;

-- Should return expenses from user's groups only
-- SELECT * FROM expenses;

-- Should return user's balance in the sample group
-- SELECT get_user_balance_in_group('660e8400-e29b-41d4-a716-446655440001');
*/