-- Test data for JASB schema validation
-- This creates sample data to test the database schema and constraints

-- Insert test users
INSERT INTO users (id, email, name) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'alice@example.com', 'Alice Johnson'),
    ('550e8400-e29b-41d4-a716-446655440002', 'bob@example.com', 'Bob Smith'),
    ('550e8400-e29b-41d4-a716-446655440003', 'carol@example.com', 'Carol Davis');

-- Insert test group
INSERT INTO groups (id, name, created_by) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'Roommate Expenses', '550e8400-e29b-41d4-a716-446655440001');

-- Insert group members
INSERT INTO group_members (group_id, user_id, role) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'admin'),
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'member'),
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'member');

-- Insert test expense
INSERT INTO expenses (id, group_id, title, amount_cents, currency_code, paid_by, description) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Groceries', 4500, 'USD', '550e8400-e29b-41d4-a716-446655440001', 'Weekly grocery shopping');

-- Insert expense splits (equal split: $45.00 / 3 = $15.00 each)
INSERT INTO expense_splits (expense_id, user_id, amount_cents, split_type) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 1500, 'equal'),
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 1500, 'equal'),
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1500, 'equal');

-- Insert test draft
INSERT INTO expense_drafts (id, group_id, created_by, title, amount_cents, paid_by, participants, split_type, source, llm_metadata) VALUES
    ('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Pizza dinner', 2400, '550e8400-e29b-41d4-a716-446655440002', '["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002", "550e8400-e29b-41d4-a716-446655440003"]', 'equal', 'llm_parsed', '{"confidence": 0.92, "original_text": "I paid $24 for pizza for all of us"}');

-- Insert test settlement
INSERT INTO settlements (id, group_id, from_user, to_user, amount_cents, status) VALUES
    ('990e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 1500, 'pending');

-- Insert AI event
INSERT INTO ai_events (user_id, event_type, tool_name, input_data, output_data) VALUES
    ('550e8400-e29b-41d4-a716-446655440002', 'parse_expense', 'parse_natural_expense', '{"utterance": "I paid $24 for pizza for all of us", "group_id": "660e8400-e29b-41d4-a716-446655440001"}', '{"draft_id": "880e8400-e29b-41d4-a716-446655440001", "confidence": 0.92}');