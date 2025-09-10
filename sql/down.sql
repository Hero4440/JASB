-- JASB Expense Splitting App - Database Rollback Script
-- This file safely removes all database objects created by the migration scripts
-- Run this script to completely reset the database schema

-- =============================================================================
-- ROLLBACK WARNING
-- =============================================================================
-- WARNING: This script will permanently delete all JASB data!
-- Make sure you have backups before running this script in production.

-- Uncomment the following line to enable destructive operations:
-- SET client_min_messages TO WARNING; -- Suppress notices during cleanup

-- =============================================================================
-- DROP POLICIES (RLS must be disabled to drop policies)
-- =============================================================================
-- Note: Policies are automatically dropped when tables are dropped,
-- but we'll be explicit for clarity

-- Disable RLS before dropping policies
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits DISABLE ROW LEVEL SECURITY;
ALTER TABLE settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency DISABLE ROW LEVEL SECURITY;

-- Drop policies explicitly (optional since they're dropped with tables)
DROP POLICY IF EXISTS users_select_policy ON users;
DROP POLICY IF EXISTS users_update_policy ON users;
DROP POLICY IF EXISTS users_insert_policy ON users;

DROP POLICY IF EXISTS groups_select_policy ON groups;
DROP POLICY IF EXISTS groups_insert_policy ON groups;
DROP POLICY IF EXISTS groups_update_policy ON groups;
DROP POLICY IF EXISTS groups_delete_policy ON groups;

DROP POLICY IF EXISTS group_members_select_policy ON group_members;
DROP POLICY IF EXISTS group_members_insert_policy ON group_members;
DROP POLICY IF EXISTS group_members_update_policy ON group_members;
DROP POLICY IF EXISTS group_members_delete_policy ON group_members;

DROP POLICY IF EXISTS expenses_select_policy ON expenses;
DROP POLICY IF EXISTS expenses_insert_policy ON expenses;
DROP POLICY IF EXISTS expenses_update_policy ON expenses;
DROP POLICY IF EXISTS expenses_delete_policy ON expenses;

DROP POLICY IF EXISTS expense_splits_select_policy ON expense_splits;
DROP POLICY IF EXISTS expense_splits_insert_policy ON expense_splits;
DROP POLICY IF EXISTS expense_splits_update_policy ON expense_splits;
DROP POLICY IF EXISTS expense_splits_delete_policy ON expense_splits;

DROP POLICY IF EXISTS settlements_select_policy ON settlements;
DROP POLICY IF EXISTS settlements_insert_policy ON settlements;
DROP POLICY IF EXISTS settlements_update_policy ON settlements;
DROP POLICY IF EXISTS settlements_delete_policy ON settlements;

DROP POLICY IF EXISTS expense_drafts_select_policy ON expense_drafts;
DROP POLICY IF EXISTS expense_drafts_insert_policy ON expense_drafts;
DROP POLICY IF EXISTS expense_drafts_update_policy ON expense_drafts;
DROP POLICY IF EXISTS expense_drafts_delete_policy ON expense_drafts;

DROP POLICY IF EXISTS ai_events_select_policy ON ai_events;
DROP POLICY IF EXISTS ai_events_insert_policy ON ai_events;

DROP POLICY IF EXISTS idempotency_select_policy ON idempotency;
DROP POLICY IF EXISTS idempotency_insert_policy ON idempotency;
DROP POLICY IF EXISTS idempotency_delete_policy ON idempotency;

-- =============================================================================
-- DROP FUNCTIONS
-- =============================================================================
-- Drop custom functions in reverse dependency order

DROP FUNCTION IF EXISTS get_user_balance_in_group(UUID, UUID);
DROP FUNCTION IF EXISTS validate_group_access(UUID);
DROP FUNCTION IF EXISTS validate_expense_splits(UUID);
DROP FUNCTION IF EXISTS user_group_ids();
DROP FUNCTION IF EXISTS user_is_group_admin(UUID);
DROP FUNCTION IF EXISTS user_is_group_member(UUID);
DROP FUNCTION IF EXISTS current_user_id();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- =============================================================================
-- DROP TRIGGERS
-- =============================================================================
-- Drop all triggers before dropping tables

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
DROP TRIGGER IF EXISTS update_settlements_updated_at ON settlements;
DROP TRIGGER IF EXISTS update_expense_drafts_updated_at ON expense_drafts;

-- =============================================================================
-- DROP INDEXES
-- =============================================================================
-- Indexes are automatically dropped when tables are dropped,
-- but we can be explicit for documentation purposes

-- Users indexes
DROP INDEX IF EXISTS idx_users_email;

-- Groups indexes
DROP INDEX IF EXISTS idx_groups_created_by;
DROP INDEX IF EXISTS idx_groups_created_at;

-- Group Members indexes
DROP INDEX IF EXISTS idx_group_members_user_id;
DROP INDEX IF EXISTS idx_group_members_group_id;

-- Expenses indexes
DROP INDEX IF EXISTS idx_expenses_group_id;
DROP INDEX IF EXISTS idx_expenses_paid_by;
DROP INDEX IF EXISTS idx_expenses_created_at;
DROP INDEX IF EXISTS idx_expenses_group_created;

-- Expense Splits indexes
DROP INDEX IF EXISTS idx_expense_splits_expense_id;
DROP INDEX IF EXISTS idx_expense_splits_user_id;

-- Settlements indexes
DROP INDEX IF EXISTS idx_settlements_group_id;
DROP INDEX IF EXISTS idx_settlements_from_user;
DROP INDEX IF EXISTS idx_settlements_to_user;
DROP INDEX IF EXISTS idx_settlements_status;

-- Expense Drafts indexes
DROP INDEX IF EXISTS idx_expense_drafts_group_id;
DROP INDEX IF EXISTS idx_expense_drafts_created_by;
DROP INDEX IF EXISTS idx_expense_drafts_status;
DROP INDEX IF EXISTS idx_expense_drafts_group_status;

-- AI Events indexes
DROP INDEX IF EXISTS idx_ai_events_user_id;
DROP INDEX IF EXISTS idx_ai_events_event_type;
DROP INDEX IF EXISTS idx_ai_events_created_at;

-- Idempotency indexes
DROP INDEX IF EXISTS idx_idempotency_user_id;
DROP INDEX IF EXISTS idx_idempotency_created_at;

-- =============================================================================
-- DROP TABLES
-- =============================================================================
-- Drop tables in reverse dependency order (child tables first)
-- Using CASCADE to handle any remaining foreign key constraints

-- Drop child tables first (tables with foreign keys)
DROP TABLE IF EXISTS idempotency CASCADE;
DROP TABLE IF EXISTS ai_events CASCADE;
DROP TABLE IF EXISTS expense_drafts CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS expense_splits CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;

-- Drop parent tables
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =============================================================================
-- CLEANUP CONFIRMATION
-- =============================================================================

-- Display confirmation message
DO $$
BEGIN
    RAISE NOTICE 'JASB database schema has been completely removed.';
    RAISE NOTICE 'All tables, indexes, triggers, functions, and policies have been dropped.';
    RAISE NOTICE 'UUID extension has been preserved as it may be used by other applications.';
END
$$;

-- =============================================================================
-- OPTIONAL: REMOVE EXTENSIONS
-- =============================================================================
-- Uncomment the following lines if you want to also remove the UUID extension
-- (Be careful in production - other applications might be using it)

/*
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
-- RAISE NOTICE 'UUID extension has been removed.';
*/

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- Uncomment to verify that all JASB objects have been removed

/*
-- Check for any remaining JASB-related objects
SELECT 
    schemaname,
    tablename
FROM pg_tables 
WHERE tablename IN (
    'users', 'groups', 'group_members', 'expenses', 
    'expense_splits', 'settlements', 'expense_drafts', 
    'ai_events', 'idempotency'
)
UNION ALL
SELECT 
    schemaname,
    viewname as tablename
FROM pg_views 
WHERE viewname LIKE '%jasb%' OR viewname LIKE '%expense%'
UNION ALL
SELECT 
    n.nspname as schemaname,
    p.proname as tablename
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN (
    'current_user_id', 'user_is_group_member', 'user_is_group_admin',
    'user_group_ids', 'validate_group_access', 'get_user_balance_in_group',
    'validate_expense_splits', 'update_updated_at_column'
);
*/