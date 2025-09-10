-- JASB Expense Splitting App - Row Level Security Policies (Standalone Version)
-- This version works with standard PostgreSQL for testing (without Supabase auth schema)

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================

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
-- HELPER FUNCTIONS FOR POLICIES (STANDALONE VERSION)
-- =============================================================================

-- Mock current user function for testing (in production, use Supabase auth.uid())
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('app.current_user_id', true))::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
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
-- BASIC POLICIES (SIMPLIFIED FOR TESTING)
-- =============================================================================
-- Note: In production, use the full RLS policies from 002_policies.sql

-- Users can see their own profile
CREATE POLICY users_select_policy ON users
FOR SELECT
USING (id = current_user_id());

-- Users can update their own profile
CREATE POLICY users_update_policy ON users
FOR UPDATE
USING (id = current_user_id());

-- Users can insert their own profile
CREATE POLICY users_insert_policy ON users
FOR INSERT
WITH CHECK (id = current_user_id());

-- Users can view groups they belong to
CREATE POLICY groups_select_policy ON groups
FOR SELECT
USING (id IN (SELECT user_group_ids()));

-- Any user can create groups
CREATE POLICY groups_insert_policy ON groups
FOR INSERT
WITH CHECK (created_by = current_user_id());

-- Group admins can update groups
CREATE POLICY groups_update_policy ON groups
FOR UPDATE
USING (user_is_group_admin(id));

-- =============================================================================
-- TESTING HELPER FUNCTIONS
-- =============================================================================

-- Set current user for testing
CREATE OR REPLACE FUNCTION set_current_user(user_uuid UUID)
RETURNS VOID
LANGUAGE SQL
AS $$
  SELECT set_config('app.current_user_id', user_uuid::text, false);
$$;

-- Reset current user
CREATE OR REPLACE FUNCTION reset_current_user()
RETURNS VOID
LANGUAGE SQL
AS $$
  SELECT set_config('app.current_user_id', '', false);
$$;

-- Function to get user's balance in a group (simplified for testing)
CREATE OR REPLACE FUNCTION get_user_balance_in_group(group_uuid UUID, target_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  WITH user_id_to_check AS (
    SELECT COALESCE(target_user_id, current_user_id()) as uid
  ),
  user_expenses AS (
    SELECT COALESCE(SUM(amount_cents), 0) as paid_out
    FROM expenses e
    WHERE e.group_id = group_uuid 
    AND e.paid_by = (SELECT uid FROM user_id_to_check)
  ),
  user_shares AS (
    SELECT COALESCE(SUM(es.amount_cents), 0) as owes
    FROM expense_splits es
    JOIN expenses e ON es.expense_id = e.id
    WHERE e.group_id = group_uuid
    AND es.user_id = (SELECT uid FROM user_id_to_check)
  )
  SELECT (
    (SELECT paid_out FROM user_expenses) - 
    (SELECT owes FROM user_shares)
  )::INTEGER;
$$;