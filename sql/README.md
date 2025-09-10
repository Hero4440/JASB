# JASB Database Schema

This directory contains the complete database schema for the JASB expense splitting application.

## Files Overview

- **`001_core.sql`** - Core database schema with tables, indexes, and triggers
- **`002_policies.sql`** - Row Level Security policies for Supabase/production
- **`002_policies_standalone.sql`** - Simplified RLS policies for standard PostgreSQL
- **`down.sql`** - Complete rollback script to remove all JASB objects
- **`test_data.sql`** - Sample data for testing and development
- **`migrate.sh`** - Helper script for database operations

## Quick Start

### 1. Create Database Schema

```bash
# For Supabase or production with auth schema
./sql/migrate.sh up postgresql://your-database-url

# For local development/testing
./sql/migrate.sh test
```

### 2. Test with Sample Data

```bash
# Run complete test with temporary database
./sql/migrate.sh test

# Or manually with existing database
psql your_database -f sql/test_data.sql
```

### 3. Reset Database (Destructive!)

```bash
./sql/migrate.sh reset postgresql://your-database-url
```

## Schema Overview

### Core Tables

#### Users Table
Stores user profile information. Authentication is handled separately by Supabase Auth.

```sql
users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

#### Groups Table
Expense splitting groups (roommates, trips, etc.)

```sql
groups (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    currency_code TEXT DEFAULT 'USD',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

#### Group Members Table
Many-to-many relationship between users and groups.

```sql
group_members (
    group_id UUID REFERENCES groups(id),
    user_id UUID REFERENCES users(id),
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
)
```

#### Expenses Table
Individual expenses within groups. Amounts stored as cents to avoid floating point issues.

```sql
expenses (
    id UUID PRIMARY KEY,
    group_id UUID REFERENCES groups(id),
    title TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency_code TEXT NOT NULL,
    paid_by UUID REFERENCES users(id),
    receipt_url TEXT,
    description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

#### Expense Splits Table
How each expense is divided among group members.

```sql
expense_splits (
    id UUID PRIMARY KEY,
    expense_id UUID REFERENCES expenses(id),
    user_id UUID REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    split_type TEXT DEFAULT 'equal',
    created_at TIMESTAMP
)
```

#### Settlements Table
Track money transfers between users to settle balances.

```sql
settlements (
    id UUID PRIMARY KEY,
    group_id UUID REFERENCES groups(id),
    from_user UUID REFERENCES users(id),
    to_user UUID REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

### AI/Safety Tables

#### Expense Drafts Table
**Core safety feature** - All LLM-generated expenses become reviewable drafts before approval.

```sql
expense_drafts (
    id UUID PRIMARY KEY,
    group_id UUID REFERENCES groups(id),
    created_by UUID REFERENCES users(id),
    title TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_by UUID REFERENCES users(id),
    participants JSONB NOT NULL,
    split_type TEXT DEFAULT 'equal',
    status TEXT DEFAULT 'pending_review',
    source TEXT DEFAULT 'manual',
    llm_metadata JSONB,
    validation_warnings JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

#### AI Events Table
Audit trail for all AI/LLM interactions.

```sql
ai_events (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    input_data JSONB,
    output_data JSONB,
    created_at TIMESTAMP
)
```

#### Idempotency Table
Prevent duplicate operations using Idempotency-Key headers.

```sql
idempotency (
    key TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    response_data JSONB,
    created_at TIMESTAMP
)
```

## Row Level Security (RLS)

The schema implements comprehensive RLS policies to ensure multi-tenant security:

- **Users can only see groups they belong to**
- **All group-related data is scoped by group membership**
- **Users can manage their own profiles and drafts**
- **Group admins have additional permissions**
- **AI events are private to each user**

### Key RLS Functions

- `current_user_id()` - Get current authenticated user
- `user_is_group_member(group_id)` - Check group membership
- `user_is_group_admin(group_id)` - Check admin privileges
- `get_user_balance_in_group(group_id)` - Calculate user's balance

## Key Features

### 1. Data Integrity
- **Check constraints** prevent invalid data (empty titles, negative amounts)
- **Foreign key constraints** ensure referential integrity
- **Unique constraints** prevent duplicate group memberships
- **Custom validation functions** for complex business rules

### 2. Performance
- **Strategic indexes** on frequently queried columns
- **Composite indexes** for common query patterns
- **JSONB indexes** for metadata queries (can be added as needed)

### 3. Audit Trail
- **updated_at triggers** automatically track modifications
- **AI events table** logs all LLM interactions
- **Immutable expense history** (limited edit windows)

### 4. Human-in-the-Loop Safety
- **All AI outputs become drafts** requiring human approval
- **Validation warnings** highlight potential issues
- **Source tracking** distinguishes manual vs AI-generated entries

## Migration Scripts

### Production Migration (Supabase)

```bash
# Apply to Supabase project
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f 001_core.sql
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f 002_policies.sql
```

### Development Migration (Local PostgreSQL)

```bash
# Apply to local database
psql jasb_dev -f 001_core.sql
psql jasb_dev -f 002_policies_standalone.sql
```

### Testing

```bash
# Create test database with sample data
createdb jasb_test
psql jasb_test -f 001_core.sql
psql jasb_test -f 002_policies_standalone.sql
psql jasb_test -f test_data.sql

# Run validation queries
psql jasb_test -c "SELECT validate_expense_splits('770e8400-e29b-41d4-a716-446655440001');"
```

## Environment Variables

The backend will need these environment variables:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/jasb
DATABASE_SSL=true

# Supabase (if using)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# For local testing
TEST_DATABASE_URL=postgresql://localhost/jasb_test
```

## Common Queries

### Get User's Groups
```sql
SELECT g.* FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = $1;
```

### Get Group Balance Summary
```sql
SELECT 
    u.name,
    get_user_balance_in_group($group_id, u.id) as balance_cents
FROM users u
JOIN group_members gm ON u.id = gm.user_id
WHERE gm.group_id = $group_id;
```

### Get Recent Expenses
```sql
SELECT e.*, u.name as paid_by_name
FROM expenses e
JOIN users u ON e.paid_by = u.id
WHERE e.group_id = $group_id
ORDER BY e.created_at DESC
LIMIT 20;
```

## Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Use transactions** for operations that modify multiple tables
3. **Validate expense splits** add up to the total amount
4. **Respect time limits** for expense modifications
5. **Log all AI interactions** in the ai_events table
6. **Use idempotency keys** for expense creation
7. **Test RLS policies** thoroughly in development

## Troubleshooting

### Common Issues

1. **RLS blocking queries**: Ensure `current_user_id()` returns correct value
2. **Split validation failing**: Check that splits sum to expense amount
3. **Constraint violations**: Review CHECK constraints in schema
4. **Permission denied**: Verify user is group member with proper role

### Debug Queries

```sql
-- Check current user context
SELECT current_user_id();

-- Check user's groups
SELECT user_group_ids();

-- Validate specific expense splits
SELECT validate_expense_splits('expense-uuid');

-- Check RLS policy effects
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM groups;
```