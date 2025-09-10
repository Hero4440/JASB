-- Migration: Add percent and shares columns to expense_splits table
-- This allows storing the original split parameters for reference

ALTER TABLE expense_splits 
ADD COLUMN percent DECIMAL(5,2) CHECK (percent >= 0 AND percent <= 100),
ADD COLUMN shares INTEGER CHECK (shares > 0);

-- Add comments
COMMENT ON COLUMN expense_splits.percent IS 'Original percentage if split_type is percent';
COMMENT ON COLUMN expense_splits.shares IS 'Original shares if split_type is share';

-- These columns are optional and only used for specific split types:
-- percent: used when split_type = 'percent'  
-- shares: used when split_type = 'share'
-- amount_cents: always contains the calculated amount in cents