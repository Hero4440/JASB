#!/bin/bash

# JASB Database Migration Helper Script
# Usage: ./migrate.sh [command] [database_url]
# Commands: up, down, test, reset

set -e

# Default values
DB_URL="${2:-postgresql://localhost/jasb}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if psql is available
check_psql() {
    if ! command -v psql &> /dev/null; then
        log_error "psql command not found. Please install PostgreSQL client."
        exit 1
    fi
}

# Test database connection
test_connection() {
    local db_url="$1"
    log_info "Testing database connection..."
    
    if psql "$db_url" -c "SELECT version();" &> /dev/null; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database: $db_url"
        exit 1
    fi
}

# Run migration up (create schema)
migrate_up() {
    local db_url="$1"
    log_info "Running migration UP - Creating JASB schema..."
    
    # Run core schema
    log_info "Creating core tables..."
    psql "$db_url" -f "$SCRIPT_DIR/001_core.sql" -v ON_ERROR_STOP=1
    
    # Run RLS policies (use Supabase version if available, else standalone)
    if psql "$db_url" -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';" | grep -q auth; then
        log_info "Supabase detected - applying production RLS policies..."
        psql "$db_url" -f "$SCRIPT_DIR/002_policies.sql" -v ON_ERROR_STOP=1
    else
        log_info "Standard PostgreSQL detected - applying standalone RLS policies..."
        psql "$db_url" -f "$SCRIPT_DIR/002_policies_standalone.sql" -v ON_ERROR_STOP=1
    fi
    
    log_success "Migration UP completed successfully"
}

# Run migration down (destroy schema)
migrate_down() {
    local db_url="$1"
    log_warning "Running migration DOWN - This will destroy all JASB data!"
    
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Migration DOWN cancelled"
        exit 0
    fi
    
    log_info "Destroying JASB schema..."
    psql "$db_url" -f "$SCRIPT_DIR/down.sql" -v ON_ERROR_STOP=1
    log_success "Migration DOWN completed successfully"
}

# Test migration with sample data
test_migration() {
    local db_url="$1"
    log_info "Testing migration with sample data..."
    
    # Create test database
    local test_db="${db_url}_test_$(date +%s)"
    log_info "Creating temporary test database..."
    
    # Extract database name from URL and create test version
    if command -v createdb &> /dev/null; then
        createdb jasb_test_temp || log_warning "Test database might already exist"
        test_db="postgresql://localhost/jasb_test_temp"
    fi
    
    # Run migrations
    migrate_up "$test_db"
    
    # Insert test data
    log_info "Inserting test data..."
    psql "$test_db" -f "$SCRIPT_DIR/test_data.sql" -v ON_ERROR_STOP=1
    
    # Run validation queries
    log_info "Running validation tests..."
    psql "$test_db" -c "
        SELECT 'Users:' as table_name, COUNT(*) as record_count FROM users
        UNION ALL
        SELECT 'Groups:', COUNT(*) FROM groups
        UNION ALL
        SELECT 'Expenses:', COUNT(*) FROM expenses
        UNION ALL
        SELECT 'Expense Splits:', COUNT(*) FROM expense_splits;
    "
    
    # Test balance calculation
    psql "$test_db" -c "
        SELECT set_current_user('550e8400-e29b-41d4-a716-446655440001');
        SELECT 'Alice Balance:' as description, get_user_balance_in_group('660e8400-e29b-41d4-a716-446655440001')::text as value
        UNION ALL
        SELECT 'Bob Balance:', (SELECT set_current_user('550e8400-e29b-41d4-a716-446655440002') IS NULL)::text || ' ' || get_user_balance_in_group('660e8400-e29b-41d4-a716-446655440001')::text;
    "
    
    # Cleanup test database
    if command -v dropdb &> /dev/null; then
        log_info "Cleaning up test database..."
        dropdb jasb_test_temp 2>/dev/null || log_warning "Could not drop test database"
    fi
    
    log_success "Migration test completed successfully"
}

# Reset database (down + up)
reset_migration() {
    local db_url="$1"
    log_warning "This will completely reset the JASB database!"
    
    migrate_down "$db_url"
    migrate_up "$db_url"
    
    log_success "Database reset completed successfully"
}

# Show usage
show_usage() {
    echo "JASB Database Migration Helper"
    echo ""
    echo "Usage: $0 [command] [database_url]"
    echo ""
    echo "Commands:"
    echo "  up      - Create JASB schema (tables, indexes, policies)"
    echo "  down    - Destroy JASB schema (WARNING: deletes all data)"
    echo "  test    - Test migration with sample data on temporary database"
    echo "  reset   - Run down then up (complete reset)"
    echo "  help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 up postgresql://localhost/jasb_dev"
    echo "  $0 test"
    echo "  $0 down postgresql://user:pass@host:5432/jasb_prod"
    echo ""
    echo "Default database URL: postgresql://localhost/jasb"
}

# Main script logic
main() {
    local command="${1:-help}"
    local db_url="${2:-postgresql://localhost/jasb}"
    
    case "$command" in
        "up")
            check_psql
            test_connection "$db_url"
            migrate_up "$db_url"
            ;;
        "down")
            check_psql
            test_connection "$db_url"
            migrate_down "$db_url"
            ;;
        "test")
            check_psql
            test_migration "$db_url"
            ;;
        "reset")
            check_psql
            test_connection "$db_url"
            reset_migration "$db_url"
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"