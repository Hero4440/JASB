/**
 * Mock Backend Server for JASB Development
 *
 * This provides a simple mock API server for testing the frontend
 * when the main backend is not available.
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory data store
let users = [
  {
    id: 'user-1',
    email: 'demo@example.com',
    name: 'Demo User',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-2',
    email: 'john@example.com',
    name: 'John Smith',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-3',
    email: 'sarah@example.com',
    name: 'Sarah Wilson',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

let groups = [
  {
    id: 'group-1',
    name: 'Demo Group',
    currency_code: 'USD',
    created_by: '550e8400-e29b-41d4-a716-446655440001', // Alice Developer's ID
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    members: [
      {
        user_id: '550e8400-e29b-41d4-a716-446655440001', // Alice Developer
        role: 'admin',
        user: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'alice@example.com',
          name: 'Alice Developer',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      {
        user_id: 'user-2',
        role: 'member',
        user: users[1],
      },
      {
        user_id: 'user-3',
        role: 'member',
        user: users[2],
      }
    ],
  }
];

let expenses = [
  {
    id: 'expense-1',
    group_id: 'group-1',
    description: 'Grocery Shopping',
    amount: 85.50,
    currency_code: 'USD',
    paid_by: '550e8400-e29b-41d4-a716-446655440001',
    split_type: 'equal',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    splits: [
      {
        id: 'split-1',
        expense_id: 'expense-1',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        amount: 28.50,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'alice@example.com',
          name: 'Alice Developer',
        }
      },
      {
        id: 'split-2',
        expense_id: 'expense-1',
        user_id: 'user-2',
        amount: 28.50,
        user: users[1]
      },
      {
        id: 'split-3',
        expense_id: 'expense-1',
        user_id: 'user-3',
        amount: 28.50,
        user: users[2]
      }
    ],
    payer: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'alice@example.com',
      name: 'Alice Developer',
    }
  },
  {
    id: 'expense-2',
    group_id: 'group-1',
    description: 'Dinner at Restaurant',
    amount: 120.00,
    currency_code: 'USD',
    paid_by: 'user-2',
    split_type: 'equal',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    splits: [
      {
        id: 'split-4',
        expense_id: 'expense-2',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        amount: 40.00,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'alice@example.com',
          name: 'Alice Developer',
        }
      },
      {
        id: 'split-5',
        expense_id: 'expense-2',
        user_id: 'user-2',
        amount: 40.00,
        user: users[1]
      },
      {
        id: 'split-6',
        expense_id: 'expense-2',
        user_id: 'user-3',
        amount: 40.00,
        user: users[2]
      }
    ],
    payer: users[1]
  },
  {
    id: 'expense-3',
    group_id: 'group-1',
    description: 'Coffee & Snacks',
    amount: 45.00,
    currency_code: 'USD',
    paid_by: 'user-3',
    split_type: 'equal',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    splits: [
      {
        id: 'split-7',
        expense_id: 'expense-3',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        amount: 15.00,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'alice@example.com',
          name: 'Alice Developer',
        }
      },
      {
        id: 'split-8',
        expense_id: 'expense-3',
        user_id: 'user-2',
        amount: 15.00,
        user: users[1]
      },
      {
        id: 'split-9',
        expense_id: 'expense-3',
        user_id: 'user-3',
        amount: 15.00,
        user: users[2]
      }
    ],
    payer: users[2]
  }
];
let drafts = [];
let balances = [];
let settlementRecords = [];

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'JASB Mock API Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Users endpoints
app.get('/v1/users/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const testUserId = req.headers['x-test-user-id'];

  if (testUserId) {
    const user = users.find(u => u.id === testUserId) || users[0];
    return res.json(user);
  }

  // For demo purposes, return the first user
  res.json(users[0]);
});

app.get('/v1/users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

app.post('/v1/users', (req, res) => {
  const newUser = {
    id: `user-${Date.now()}`,
    ...req.body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.patch('/v1/users/me', (req, res) => {
  const user = users[0]; // For demo, update first user
  Object.assign(user, req.body, { updated_at: new Date().toISOString() });
  res.json(user);
});

// Groups endpoints
app.get('/v1/groups', (req, res) => {
  res.json({
    data: groups,
    pagination: {
      has_more: false,
      total: groups.length,
    }
  });
});

app.get('/v1/groups/:id', (req, res) => {
  const group = groups.find(g => g.id === req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  res.json(group);
});

app.post('/v1/groups', (req, res) => {
  const newGroup = {
    id: `group-${Date.now()}`,
    ...req.body,
    created_by: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    members: [
      {
        user_id: 'user-1',
        role: 'admin',
        user: users[0],
      }
    ],
  };
  groups.push(newGroup);
  res.status(201).json(newGroup);
});

app.patch('/v1/groups/:id', (req, res) => {
  const group = groups.find(g => g.id === req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  Object.assign(group, req.body, { updated_at: new Date().toISOString() });
  res.json(group);
});

app.delete('/v1/groups/:id', (req, res) => {
  const index = groups.findIndex(g => g.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Group not found' });
  }
  groups.splice(index, 1);
  res.status(204).send();
});

app.get('/v1/groups/:id/balances', (req, res) => {
  const groupId = req.params.id;
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Calculate balances for this group
  const groupExpenses = expenses.filter(e => e.group_id === groupId);
  const balances = {};

  // Initialize balances for all group members
  group.members.forEach(member => {
    balances[member.user_id] = 0;
  });

  // Process each expense
  groupExpenses.forEach(expense => {
    const payerId = expense.paid_by;
    const totalAmount = expense.amount;

    // Add paid amount to payer's balance (they paid more than they owe)
    if (balances.hasOwnProperty(payerId)) {
      balances[payerId] += totalAmount;
    }

    // Subtract each person's share from their balance
    expense.splits.forEach(split => {
      if (balances.hasOwnProperty(split.user_id)) {
        balances[split.user_id] -= split.amount;
      }
    });
  });

  // Process settlement records to update balances
  const groupSettlementRecords = settlementRecords.filter(sr => sr.group_id === groupId);
  groupSettlementRecords.forEach(settlement => {
    // When someone pays (from_user), their balance increases by that amount
    if (balances.hasOwnProperty(settlement.from_user_id)) {
      balances[settlement.from_user_id] += settlement.amount;
    }
    // When someone receives payment (to_user), their balance decreases by that amount
    if (balances.hasOwnProperty(settlement.to_user_id)) {
      balances[settlement.to_user_id] -= settlement.amount;
    }
  });

  // Convert to array format with user details
  const balanceArray = Object.entries(balances).map(([userId, balance]) => {
    let user = null;

    // Find user details
    if (userId === '550e8400-e29b-41d4-a716-446655440001') {
      user = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'alice@example.com',
        name: 'Alice Developer',
      };
    } else {
      const foundUser = users.find(u => u.id === userId);
      if (foundUser) {
        user = {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
        };
      }
    }

    return {
      user_id: userId,
      user: user,
      balance: balance,
    };
  });

  res.json(balanceArray);
});

// Helper function to calculate optimal settlements
function calculateSettlements(balances) {
  const settlements = [];

  // Separate creditors (positive balance) and debtors (negative balance)
  const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);

  // Create working copies
  const workingCreditors = creditors.map(c => ({ ...c, remaining: c.balance }));
  const workingDebtors = debtors.map(d => ({ ...d, remaining: Math.abs(d.balance) }));

  // Greedy algorithm to minimize number of transactions
  for (const debtor of workingDebtors) {
    while (debtor.remaining > 0.01) {
      // Find creditor with the largest remaining amount
      const creditor = workingCreditors.find(c => c.remaining > 0.01);
      if (!creditor) break;

      // Calculate settlement amount
      const settlementAmount = Math.min(debtor.remaining, creditor.remaining);

      // Create settlement record
      settlements.push({
        from_user_id: debtor.user_id,
        to_user_id: creditor.user_id,
        amount: settlementAmount,
        from_user: debtor.user,
        to_user: creditor.user
      });

      // Update remaining amounts
      debtor.remaining -= settlementAmount;
      creditor.remaining -= settlementAmount;
    }
  }

  return settlements;
}

app.get('/v1/groups/:id/settlements', (req, res) => {
  const groupId = req.params.id;
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Calculate balances first (reuse logic from balances endpoint)
  const groupExpenses = expenses.filter(e => e.group_id === groupId);
  const balances = {};

  // Initialize balances for all group members
  group.members.forEach(member => {
    balances[member.user_id] = 0;
  });

  // Process each expense
  groupExpenses.forEach(expense => {
    const payerId = expense.paid_by;
    const totalAmount = expense.amount;

    // Add paid amount to payer's balance
    if (balances.hasOwnProperty(payerId)) {
      balances[payerId] += totalAmount;
    }

    // Subtract each person's share from their balance
    expense.splits.forEach(split => {
      if (balances.hasOwnProperty(split.user_id)) {
        balances[split.user_id] -= split.amount;
      }
    });
  });

  // Process settlement records to update balances
  const groupSettlementRecords = settlementRecords.filter(sr => sr.group_id === groupId);
  groupSettlementRecords.forEach(settlement => {
    // When someone pays (from_user), their balance increases by that amount
    if (balances.hasOwnProperty(settlement.from_user_id)) {
      balances[settlement.from_user_id] += settlement.amount;
    }
    // When someone receives payment (to_user), their balance decreases by that amount
    if (balances.hasOwnProperty(settlement.to_user_id)) {
      balances[settlement.to_user_id] -= settlement.amount;
    }
  });

  // Convert to array format with user details
  const balanceArray = Object.entries(balances).map(([userId, balance]) => {
    let user = null;

    // Find user details
    if (userId === '550e8400-e29b-41d4-a716-446655440001') {
      user = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'alice@example.com',
        name: 'Alice Developer',
      };
    } else {
      const foundUser = users.find(u => u.id === userId);
      if (foundUser) {
        user = {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
        };
      }
    }

    return {
      user_id: userId,
      user: user,
      balance: balance,
    };
  });

  // Calculate optimal settlements
  const settlements = calculateSettlements(balanceArray);

  res.json(settlements);
});

// Group Members endpoints
app.post('/v1/groups/:id/invite', (req, res) => {
  const { email } = req.body;
  const group = groups.find(g => g.id === req.params.id);

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Check if user already exists
  let user = users.find(u => u.email === email);

  if (!user) {
    // Create new user
    user = {
      id: `user-${Date.now()}`,
      email,
      name: email.split('@')[0], // Use part before @ as name
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    users.push(user);
  }

  // Check if user is already a member
  const existingMember = group.members.find(m => m.user_id === user.id);
  if (existingMember) {
    return res.status(400).json({ error: 'User is already a member of this group' });
  }

  // Add user to group
  group.members.push({
    user_id: user.id,
    role: 'member',
    user: user,
  });

  group.updated_at = new Date().toISOString();

  res.status(201).json({
    message: 'User invited successfully',
    user: user,
    group: group
  });
});

app.delete('/v1/groups/:id/members/:userId', (req, res) => {
  const group = groups.find(g => g.id === req.params.id);

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const memberIndex = group.members.findIndex(m => m.user_id === req.params.userId);

  if (memberIndex === -1) {
    return res.status(404).json({ error: 'Member not found in group' });
  }

  // Don't allow removing the group creator
  if (group.members[memberIndex].user_id === group.created_by) {
    return res.status(400).json({ error: 'Cannot remove group creator' });
  }

  group.members.splice(memberIndex, 1);
  group.updated_at = new Date().toISOString();

  res.status(204).send();
});

// Expenses endpoints
app.get('/v1/groups/:groupId/expenses', (req, res) => {
  const groupExpenses = expenses
    .filter(e => e.group_id === req.params.groupId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); // Sort by newest first
  res.json({
    data: groupExpenses,
    pagination: {
      has_more: false,
      total: groupExpenses.length,
    }
  });
});

app.post('/v1/groups/:groupId/expenses', (req, res) => {
  const { title, amount_cents, paid_by, split_type, member_amounts, member_shares, ...rest } = req.body;
  const groupId = req.params.groupId;

  // Find the group to get its members
  const group = groups.find(g => g.id === groupId);

  // Find the payer user details
  let payer = null;
  if (paid_by) {
    // Check if it's one of the hardcoded users
    if (paid_by === '550e8400-e29b-41d4-a716-446655440001') {
      payer = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'alice@example.com',
        name: 'Alice Developer',
      };
    } else {
      // Find in the users array
      const user = users.find(u => u.id === paid_by);
      if (user) {
        payer = {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    }
  }

  const expenseId = `expense-${Date.now()}`;
  const totalAmount = amount_cents ? amount_cents / 100 : req.body.amount;

  // Generate splits based on split type
  let splits = [];
  if (group && group.members) {
    if (split_type === 'equal') {
      // Equal split
      const splitAmount = totalAmount / group.members.length;

      splits = group.members.map((member, index) => {
        // Get user details for the split
        let splitUser = member.user;
        if (member.user_id === '550e8400-e29b-41d4-a716-446655440001') {
          splitUser = {
            id: '550e8400-e29b-41d4-a716-446655440001',
            email: 'alice@example.com',
            name: 'Alice Developer',
          };
        } else {
          const user = users.find(u => u.id === member.user_id);
          if (user) {
            splitUser = {
              id: user.id,
              email: user.email,
              name: user.name,
            };
          }
        }

        return {
          id: `split-${Date.now()}-${index}`,
          expense_id: expenseId,
          user_id: member.user_id,
          amount: splitAmount,
          user: splitUser
        };
      });
    } else if (split_type === 'exact' && member_amounts) {
      // Exact amounts from member_amounts
      splits = group.members.map((member, index) => {
        // Get user details for the split
        let splitUser = member.user;
        if (member.user_id === '550e8400-e29b-41d4-a716-446655440001') {
          splitUser = {
            id: '550e8400-e29b-41d4-a716-446655440001',
            email: 'alice@example.com',
            name: 'Alice Developer',
          };
        } else {
          const user = users.find(u => u.id === member.user_id);
          if (user) {
            splitUser = {
              id: user.id,
              email: user.email,
              name: user.name,
            };
          }
        }

        const memberAmount = parseFloat(member_amounts[member.user_id] || '0');

        return {
          id: `split-${Date.now()}-${index}`,
          expense_id: expenseId,
          user_id: member.user_id,
          amount: memberAmount,
          user: splitUser
        };
      });
    } else if (split_type === 'percentage' && member_shares) {
      // Shares-based split
      const totalShares = Object.values(member_shares).reduce((sum, shares) => sum + parseInt(shares || '0'), 0);

      splits = group.members.map((member, index) => {
        // Get user details for the split
        let splitUser = member.user;
        if (member.user_id === '550e8400-e29b-41d4-a716-446655440001') {
          splitUser = {
            id: '550e8400-e29b-41d4-a716-446655440001',
            email: 'alice@example.com',
            name: 'Alice Developer',
          };
        } else {
          const user = users.find(u => u.id === member.user_id);
          if (user) {
            splitUser = {
              id: user.id,
              email: user.email,
              name: user.name,
            };
          }
        }

        const memberShares = parseInt(member_shares[member.user_id] || '0');
        const memberAmount = totalShares > 0 ? (totalAmount * memberShares) / totalShares : 0;

        return {
          id: `split-${Date.now()}-${index}`,
          expense_id: expenseId,
          user_id: member.user_id,
          amount: memberAmount,
          user: splitUser
        };
      });
    }
  }

  const newExpense = {
    id: expenseId,
    group_id: groupId,
    description: title || req.body.description, // Use title as description for compatibility
    amount: totalAmount, // Convert cents to dollars
    paid_by: paid_by,
    payer: payer, // Add the payer object with user details
    split_type: split_type,
    splits: splits, // Add the generated splits
    // Store original member shares for percentage split
    ...(split_type === 'percentage' && member_shares && { member_shares }),
    // Store original member amounts for exact split
    ...(split_type === 'exact' && member_amounts && { member_amounts }),
    ...rest,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  expenses.push(newExpense);
  res.status(201).json(newExpense);
});

app.get('/v1/expenses/:id', (req, res) => {
  const expense = expenses.find(e => e.id === req.params.id);
  if (!expense) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  res.json(expense);
});

app.put('/v1/expenses/:id', (req, res) => {
  const expenseIndex = expenses.findIndex(e => e.id === req.params.id);
  if (expenseIndex === -1) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  const { title, amount_cents, paid_by, split_type, member_amounts, member_shares, ...rest } = req.body;
  const existingExpense = expenses[expenseIndex];

  // Update the expense
  const updatedExpense = {
    ...existingExpense,
    title: title !== undefined ? title : existingExpense.title,
    description: rest.description !== undefined ? rest.description : existingExpense.description,
    amount: amount_cents !== undefined ? amount_cents / 100 : existingExpense.amount,
    paid_by: paid_by !== undefined ? paid_by : existingExpense.paid_by,
    split_type: split_type !== undefined ? split_type : existingExpense.split_type,
    updated_at: new Date().toISOString(),
  };

  // Recalculate splits based on the split type
  const group = groups.find(g => g.id === existingExpense.group_id);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const totalAmount = updatedExpense.amount;
  let newSplits = [];

  if (updatedExpense.split_type === 'equal') {
    const equalAmount = totalAmount / group.members.length;
    newSplits = group.members.map((member, index) => ({
      id: `split-${Date.now()}-${index}`,
      expense_id: updatedExpense.id,
      user_id: member.user_id,
      amount: parseFloat(equalAmount.toFixed(2)),
      user: users.find(u => u.id === member.user_id) || null
    }));
  } else if (updatedExpense.split_type === 'exact' && member_amounts) {
    newSplits = Object.entries(member_amounts).map(([userId, amount], index) => ({
      id: `split-${Date.now()}-${index}`,
      expense_id: updatedExpense.id,
      user_id: userId,
      amount: parseFloat(amount),
      user: users.find(u => u.id === userId) || null
    }));
  } else if (updatedExpense.split_type === 'percentage' && member_shares) {
    const totalShares = Object.values(member_shares).reduce((sum, shares) => sum + parseInt(shares), 0);
    newSplits = Object.entries(member_shares).map(([userId, shares], index) => ({
      id: `split-${Date.now()}-${index}`,
      expense_id: updatedExpense.id,
      user_id: userId,
      amount: parseFloat(((totalAmount * parseInt(shares)) / totalShares).toFixed(2)),
      user: users.find(u => u.id === userId) || null
    }));
  } else {
    // Keep existing splits if no new split data provided
    newSplits = existingExpense.splits;
  }

  updatedExpense.splits = newSplits;

  // Store original member shares for percentage split
  if (split_type === 'percentage' && member_shares) {
    updatedExpense.member_shares = member_shares;
  }
  // Store original member amounts for exact split
  if (split_type === 'exact' && member_amounts) {
    updatedExpense.member_amounts = member_amounts;
  }

  // Add payer details
  if (updatedExpense.paid_by === '550e8400-e29b-41d4-a716-446655440001') {
    updatedExpense.payer = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'alice@example.com',
      name: 'Alice Developer',
    };
  } else {
    const payer = users.find(u => u.id === updatedExpense.paid_by);
    if (payer) {
      updatedExpense.payer = {
        id: payer.id,
        email: payer.email,
        name: payer.name,
      };
    }
  }

  expenses[expenseIndex] = updatedExpense;

  console.log(`[${new Date().toISOString()}] Updated expense: ${updatedExpense.title || updatedExpense.description} - $${updatedExpense.amount}`);

  res.json(updatedExpense);
});

app.delete('/v1/expenses/:id', (req, res) => {
  console.log(`[${new Date().toISOString()}] DELETE /v1/expenses/${req.params.id} - Processing deletion request`);

  const expenseIndex = expenses.findIndex(e => e.id === req.params.id);
  if (expenseIndex === -1) {
    console.log(`[${new Date().toISOString()}] DELETE /v1/expenses/${req.params.id} - Expense not found`);
    return res.status(404).json({ error: 'Expense not found' });
  }

  const deletedExpense = expenses[expenseIndex];
  expenses.splice(expenseIndex, 1);

  console.log(`[${new Date().toISOString()}] DELETE /v1/expenses/${req.params.id} - Successfully deleted expense: ${deletedExpense.title || deletedExpense.description} - $${deletedExpense.amount}`);

  res.status(204).send();
});

// Drafts endpoints
app.get('/v1/groups/:groupId/drafts', (req, res) => {
  const status = req.query.status;
  let groupDrafts = drafts.filter(d => d.group_id === req.params.groupId);

  if (status) {
    groupDrafts = groupDrafts.filter(d => d.status === status);
  }

  res.json(groupDrafts);
});

app.post('/v1/groups/:groupId/drafts', (req, res) => {
  const newDraft = {
    id: `draft-${Date.now()}`,
    group_id: req.params.groupId,
    created_by: 'user-1',
    status: 'pending_review',
    source: req.body.source || 'manual',
    ...req.body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  drafts.push(newDraft);
  res.status(201).json(newDraft);
});

app.get('/v1/groups/:groupId/drafts/:draftId', (req, res) => {
  const draft = drafts.find(d => d.id === req.params.draftId && d.group_id === req.params.groupId);
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  res.json(draft);
});

app.patch('/v1/groups/:groupId/drafts/:draftId', (req, res) => {
  const draft = drafts.find(d => d.id === req.params.draftId && d.group_id === req.params.groupId);
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  Object.assign(draft, req.body, { updated_at: new Date().toISOString() });
  res.json(draft);
});

app.post('/v1/groups/:groupId/drafts/:draftId/review', (req, res) => {
  const draft = drafts.find(d => d.id === req.params.draftId && d.group_id === req.params.groupId);
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }

  const { action, reason } = req.body;

  if (action === 'approve') {
    // Convert draft to expense
    const newExpense = {
      id: `expense-${Date.now()}`,
      group_id: draft.group_id,
      title: draft.title,
      amount_cents: draft.amount_cents,
      paid_by: draft.paid_by,
      description: draft.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expenses.push(newExpense);

    draft.status = 'approved';
    draft.updated_at = new Date().toISOString();
  } else if (action === 'reject') {
    draft.status = 'rejected';
    draft.rejection_reason = reason;
    draft.updated_at = new Date().toISOString();
  }

  res.json(draft);
});

app.delete('/v1/groups/:groupId/drafts/:draftId', (req, res) => {
  const index = drafts.findIndex(d => d.id === req.params.draftId && d.group_id === req.params.groupId);
  if (index === -1) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  drafts.splice(index, 1);
  res.status(204).send();
});

// Settlement Records endpoints
app.get('/v1/groups/:groupId/settlement-records', (req, res) => {
  const groupSettlementRecords = settlementRecords
    .filter(sr => sr.group_id === req.params.groupId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Add user details
  const enrichedRecords = groupSettlementRecords.map(record => ({
    ...record,
    from_user: users.find(u => u.id === record.from_user_id),
    to_user: users.find(u => u.id === record.to_user_id),
    creator: users.find(u => u.id === record.created_by)
  }));

  res.json(enrichedRecords);
});

app.post('/v1/groups/:groupId/settlement-records', (req, res) => {
  const { from_user_id, to_user_id, amount, description, created_by } = req.body;
  const groupId = req.params.groupId;

  // Validate required fields
  if (!from_user_id || !to_user_id || !amount || amount <= 0) {
    return res.status(400).json({
      error: 'Missing required fields or invalid amount',
      details: 'from_user_id, to_user_id, and positive amount are required'
    });
  }

  // Create settlement record
  const newSettlementRecord = {
    id: `settlement-${Date.now()}`,
    group_id: groupId,
    from_user_id,
    to_user_id,
    amount: parseFloat(amount),
    description: description || '',
    created_at: new Date().toISOString(),
    created_by: created_by || from_user_id, // Track who actually created the record (admin vs member)
  };

  settlementRecords.push(newSettlementRecord);

  // Add user details for response
  const enrichedRecord = {
    ...newSettlementRecord,
    from_user: users.find(u => u.id === from_user_id),
    to_user: users.find(u => u.id === to_user_id),
    creator: users.find(u => u.id === from_user_id)
  };

  console.log(`[${new Date().toISOString()}] Settlement recorded: ${enrichedRecord.from_user?.name} paid ${enrichedRecord.to_user?.name} $${amount}`);

  res.status(201).json(enrichedRecord);
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 JASB Mock API Server running on http://192.168.0.230:${PORT}`);
  console.log(`📱 Ready to receive requests from React Native app`);
  console.log(`🔍 Health check: http://192.168.0.230:${PORT}/health`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET    /health');
  console.log('  GET    /v1/users/me');
  console.log('  GET    /v1/groups');
  console.log('  POST   /v1/groups');
  console.log('  GET    /v1/groups/:id');
  console.log('  POST   /v1/groups/:id/invite');
  console.log('  DELETE /v1/groups/:id/members/:userId');
  console.log('  GET    /v1/groups/:id/expenses');
  console.log('  POST   /v1/groups/:id/expenses');
  console.log('  GET    /v1/expenses/:id');
  console.log('  PUT    /v1/expenses/:id');
  console.log('  DELETE /v1/expenses/:id');
  console.log('  GET    /v1/groups/:id/balances');
  console.log('  GET    /v1/groups/:id/settlements');
  console.log('  GET    /v1/groups/:id/drafts');
  console.log('  POST   /v1/groups/:id/drafts');
  console.log('  GET    /v1/groups/:id/settlement-records');
  console.log('  POST   /v1/groups/:id/settlement-records');
});

module.exports = app;