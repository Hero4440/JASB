-- JASB Expense Splitting App - Core Database Schema
-- This file creates the core tables for expense splitting functionality
-- Run this script on your Supabase project or local Postgres instance

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Stores user profile information
-- Note: Authentication is handled by Supabase Auth, this extends user data
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- GROUPS TABLE  
-- =============================================================================
-- Expense splitting groups (e.g., roommates, trip groups, friend circles)
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (length(name) > 0),
    currency_code TEXT DEFAULT 'USD' NOT NULL CHECK (length(currency_code) = 3),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- GROUP_MEMBERS TABLE
-- =============================================================================
-- Many-to-many relationship between users and groups
-- Tracks who belongs to which groups and their roles
CREATE TABLE group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' NOT NULL CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (group_id, user_id)
);

-- =============================================================================
-- EXPENSES TABLE
-- =============================================================================
-- Individual expenses within groups
-- amount_cents: Store amounts as integers to avoid floating point precision issues
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL CHECK (length(title) > 0),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
    paid_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    receipt_url TEXT, -- S3 URL for receipt image
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- EXPENSE_SPLITS TABLE
-- =============================================================================
-- How each expense is split among group members
-- amount_cents: Each person's share of the expense
CREATE TABLE expense_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    split_type TEXT DEFAULT 'equal' NOT NULL CHECK (split_type IN ('equal', 'percent', 'amount', 'share')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (expense_id, user_id) -- Each user can only have one split per expense
);

-- =============================================================================
-- SETTLEMENTS TABLE
-- =============================================================================
-- Track money transfers between users to settle balances
-- Used for "Settle Up" functionality
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    from_user UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    to_user UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT no_self_settlement CHECK (from_user != to_user)
);

-- =============================================================================
-- EXPENSE_DRAFTS TABLE
-- =============================================================================
-- Draft expenses created by LLM parsing before user approval
-- Core feature for human-in-the-loop safety
CREATE TABLE expense_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    title TEXT NOT NULL CHECK (length(title) > 0),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    paid_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of user IDs
    split_type TEXT DEFAULT 'equal' NOT NULL CHECK (split_type IN ('equal', 'percent', 'amount', 'share')),
    status TEXT DEFAULT 'pending_review' NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected')),
    source TEXT DEFAULT 'manual' NOT NULL CHECK (source IN ('manual', 'llm_parsed')),
    llm_metadata JSONB DEFAULT '{}'::jsonb, -- Store LLM parsing confidence, original text, etc.
    validation_warnings JSONB DEFAULT '[]'::jsonb, -- Array of warning messages
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- AI_EVENTS TABLE
-- =============================================================================
-- Audit trail for all AI/LLM interactions
-- Used for debugging, analytics, and safety monitoring
CREATE TABLE ai_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'parse_expense', 'explain_balance', 'suggest_settlement'
    tool_name TEXT NOT NULL, -- MCP tool that was called
    input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- IDEMPOTENCY TABLE
-- =============================================================================
-- Prevent duplicate operations (especially for expense creation)
-- Used with Idempotency-Key headers
CREATE TABLE idempotency (
    key TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    response_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Users
CREATE INDEX idx_users_email ON users(email);

-- Groups
CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX idx_groups_created_at ON groups(created_at DESC);

-- Group Members
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);

-- Expenses
CREATE INDEX idx_expenses_group_id ON expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX idx_expenses_group_created ON expenses(group_id, created_at DESC);

-- Expense Splits
CREATE INDEX idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON expense_splits(user_id);

-- Settlements
CREATE INDEX idx_settlements_group_id ON settlements(group_id);
CREATE INDEX idx_settlements_from_user ON settlements(from_user);
CREATE INDEX idx_settlements_to_user ON settlements(to_user);
CREATE INDEX idx_settlements_status ON settlements(status);

-- Expense Drafts
CREATE INDEX idx_expense_drafts_group_id ON expense_drafts(group_id);
CREATE INDEX idx_expense_drafts_created_by ON expense_drafts(created_by);
CREATE INDEX idx_expense_drafts_status ON expense_drafts(status);
CREATE INDEX idx_expense_drafts_group_status ON expense_drafts(group_id, status);

-- AI Events
CREATE INDEX idx_ai_events_user_id ON ai_events(user_id);
CREATE INDEX idx_ai_events_event_type ON ai_events(event_type);
CREATE INDEX idx_ai_events_created_at ON ai_events(created_at DESC);

-- Idempotency
CREATE INDEX idx_idempotency_user_id ON idempotency(user_id);
CREATE INDEX idx_idempotency_created_at ON idempotency(created_at);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
-- Automatically update updated_at timestamps

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_drafts_updated_at BEFORE UPDATE ON expense_drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SCHEMA VALIDATION FUNCTIONS
-- =============================================================================

-- Validate that expense splits add up to the total expense amount
CREATE OR REPLACE FUNCTION validate_expense_splits(expense_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    expense_total INTEGER;
    splits_total INTEGER;
BEGIN
    -- Get expense total
    SELECT amount_cents INTO expense_total FROM expenses WHERE id = expense_uuid;
    
    -- Get sum of all splits
    SELECT COALESCE(SUM(amount_cents), 0) INTO splits_total 
    FROM expense_splits WHERE expense_id = expense_uuid;
    
    -- Return true if they match (allowing for small rounding differences)
    RETURN ABS(expense_total - splits_total) <= 1;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SAMPLE DATA (for development/testing)
-- =============================================================================
-- Uncomment the following to add sample data for testing

/*
-- Sample users
INSERT INTO users (id, email, name) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'alice@example.com', 'Alice Johnson'),
    ('550e8400-e29b-41d4-a716-446655440002', 'bob@example.com', 'Bob Smith'),
    ('550e8400-e29b-41d4-a716-446655440003', 'carol@example.com', 'Carol Davis');

-- Sample group
INSERT INTO groups (id, name, created_by) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'Roommate Expenses', '550e8400-e29b-41d4-a716-446655440001');

-- Sample group members
INSERT INTO group_members (group_id, user_id, role) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'admin'),
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'member'),
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'member');

-- Sample expense
INSERT INTO expenses (id, group_id, title, amount_cents, currency_code, paid_by, description) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Groceries', 4500, 'USD', '550e8400-e29b-41d4-a716-446655440001', 'Weekly grocery shopping');

-- Sample expense splits (equal split: $45.00 / 3 = $15.00 each)
INSERT INTO expense_splits (expense_id, user_id, amount_cents, split_type) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 1500, 'equal'),
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 1500, 'equal'),
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1500, 'equal');
*/