import type {
  Balance,
  Expense,
  ExpenseSplit,
  Group,
  User,
} from '@shared/types';
import type { PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';

// Database connection pool
let pool: Pool | null = null;

// Database configuration
const dbConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECT_TIMEOUT || '2000',
    10,
  ),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
};

/**
 * Initialize database connection pool
 */
export function initializeDb(): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool(dbConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  // Test connection on startup
  pool
    .query('SELECT NOW()')
    .then(() => console.log('✅ Database connection established'))
    .catch((err) =>
      console.error('❌ Database connection failed:', err.message),
    );

  return pool;
}

/**
 * Get database pool instance
 */
export function getDb(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDb() first.');
  }
  return pool;
}

/**
 * Close database connection pool
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Type-safe query helper
 */
type QueryExecutor = (
  text: string,
  params?: any[],
) => Promise<QueryResult<any>>;

function isQueryExecutor(value: unknown): value is QueryExecutor {
  return typeof value === 'function';
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  executor?: PoolClient | QueryExecutor,
): Promise<QueryResult<T>> {
  const db = getDb();
  const start = Date.now();

  const run = async () => {
    if (executor) {
      if (isQueryExecutor(executor)) {
        return executor(text, params);
      }
      return executor.query<T>(text, params);
    }
    return db.query<T>(text, params);
  };

  try {
    const result = await run();
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
    }

    return result;
  } catch (error) {
    console.error('Database query error:', {
      text: text.substring(0, 200),
      params,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Execute query and return first row or null
 */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  executor?: PoolClient | QueryExecutor,
): Promise<T | null> {
  const result = await query<T>(text, params, executor);
  return result.rows[0] || null;
}

/**
 * Execute query and return all rows
 */
export async function queryMany<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  executor?: PoolClient | QueryExecutor,
): Promise<T[]> {
  const result = await query<T>(text, params, executor);
  return result.rows;
}

/**
 * Execute query within a transaction
 */
export async function withTransaction<T>(
  callback: (transactionQuery: QueryExecutor) => Promise<T>,
): Promise<T> {
  const client = await getDb().connect();

  try {
    await client.query('BEGIN');

    // Create scoped query function that uses the transaction client
    const transactionQuery = async <R extends QueryResultRow = any>(
      text: string,
      params?: any[],
    ): Promise<QueryResult<R>> => {
      return client.query<R>(text, params);
    };

    const result = await callback(transactionQuery);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Database helper functions for common operations
 */

// Set current user for RLS (for testing/development)
export async function setCurrentUser(userId: string): Promise<void> {
  await query('SELECT set_config($1, $2, false)', [
    'app.current_user_id',
    userId,
  ]);
}

// User operations
export const UserDB = {
  async findById(id: string): Promise<User | null> {
    return queryOne<User>('SELECT * FROM users WHERE id = $1', [id]);
  },

  async findByEmail(email: string): Promise<User | null> {
    return queryOne<User>('SELECT * FROM users WHERE email = $1', [email]);
  },

  async create(user: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
    return queryOne<User>(
      `INSERT INTO users (id, email, name, avatar_url) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [user.id, user.email, user.name, user.avatar_url],
    ).then((result) => {
      if (!result) throw new Error('Failed to create user');
      return result;
    });
  },

  async update(
    id: string,
    updates: Partial<Pick<User, 'name' | 'avatar_url'>>,
  ): Promise<User | null> {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    return queryOne<User>(
      `UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updates)],
    );
  },
};

// Group operations
export const GroupDB = {
  async findById(id: string): Promise<Group | null> {
    return queryOne<Group>(
      `SELECT g.*, 
              json_agg(
                json_build_object(
                  'group_id', gm.group_id,
                  'user_id', gm.user_id,
                  'role', gm.role,
                  'joined_at', gm.joined_at,
                  'user', json_build_object(
                    'id', u.id,
                    'email', u.email,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                  )
                )
              ) FILTER (WHERE gm.user_id IS NOT NULL) as members
       FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id
       LEFT JOIN users u ON gm.user_id = u.id
       WHERE g.id = $1
       GROUP BY g.id`,
      [id],
    );
  },

  async findUserGroups(userId: string): Promise<Group[]> {
    return queryMany<Group>(
      `SELECT g.* FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId],
    );
  },

  async create(
    group: Omit<Group, 'created_at' | 'updated_at' | 'members'>,
  ): Promise<Group> {
    return withTransaction(async (txQuery) => {
      // Create group
      const newGroup = await txQuery(
        `INSERT INTO groups (id, name, currency_code, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [group.id, group.name, group.currency_code, group.created_by],
      ).then((result) => result.rows[0]);

      // Add creator as admin
      await txQuery(
        `INSERT INTO group_members (group_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
        [newGroup.id, group.created_by],
      );

      return newGroup;
    });
  },
};

// Expense operations
export const ExpenseDB = {
  async findById(id: string): Promise<Expense | null> {
    const expense = await queryOne<Expense>(
      `SELECT e.*, u.name as paid_by_name, u.email as paid_by_email
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       WHERE e.id = $1`,
      [id],
    );

    if (!expense) return null;

    // Get splits
    const splits = await queryMany<ExpenseSplit>(
      `SELECT es.*, u.name as user_name, u.email as user_email
       FROM expense_splits es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = $1`,
      [id],
    );

    return { ...expense, splits };
  },

  async findByGroup(
    groupId: string,
    limit = 50,
    cursor?: string,
  ): Promise<Expense[]> {
    const whereClause = cursor
      ? 'WHERE e.group_id = $1 AND e.created_at < $3'
      : 'WHERE e.group_id = $1';
    const params = cursor ? [groupId, limit, cursor] : [groupId, limit];

    return queryMany<Expense>(
      `SELECT e.*, u.name as paid_by_name, u.email as paid_by_email
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $2`,
      params,
    );
  },
};

// Balance calculations
export const BalanceDB = {
  async getGroupBalances(groupId: string): Promise<Balance[]> {
    return queryMany<Balance>(
      `WITH member_balances AS (
         SELECT 
           u.id as user_id,
           u.name,
           u.email,
           get_user_balance_in_group($1, u.id) as net_cents
         FROM users u
         JOIN group_members gm ON u.id = gm.user_id
         WHERE gm.group_id = $1
       )
       SELECT 
         user_id,
         json_build_object(
           'id', user_id,
           'name', name,
           'email', email
         ) as user,
         net_cents
       FROM member_balances
       ORDER BY net_cents DESC`,
      [groupId],
    );
  },
};

// Initialize database on module load
initializeDb();
