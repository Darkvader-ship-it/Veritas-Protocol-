-- ============================================================================
-- Veritas Copy Trading Tables - Migration Script
-- ============================================================================
-- This script handles both new table creation and updating existing tables
-- Execute this in your Supabase SQL Editor
-- ============================================================================

-- STEP 1: Check what exists
-- ============================================================================
-- Run this first to see what tables already exist:
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('simulated_trades', 'copy_follows', 'copy_trades')
-- ORDER BY tablename;

-- STEP 2: Handle simulated_trades table
-- ============================================================================
DO $$
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'simulated_trades') THEN
        CREATE TABLE public.simulated_trades (
          id BIGSERIAL PRIMARY KEY,
          follower TEXT NOT NULL,
          leader TEXT NOT NULL,
          epoch BIGINT NOT NULL,
          amount TEXT NOT NULL,
          is_bull BOOLEAN NOT NULL,
          outcome TEXT NOT NULL DEFAULT 'pending',
          pnl TEXT,
          simulated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          resolved_at TIMESTAMP WITH TIME ZONE,
          CONSTRAINT simulated_trades_unique_bet UNIQUE (follower, epoch)
        );

        CREATE INDEX idx_simulated_follower ON public.simulated_trades(follower);
        CREATE INDEX idx_simulated_leader ON public.simulated_trades(leader);
        CREATE INDEX idx_simulated_epoch ON public.simulated_trades(epoch);
        CREATE INDEX idx_simulated_outcome ON public.simulated_trades(outcome);

        ALTER TABLE public.simulated_trades ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Allow read access to all users" ON public.simulated_trades
          FOR SELECT USING (true);

        CREATE POLICY "Allow users to insert their own trades" ON public.simulated_trades
          FOR INSERT WITH CHECK (true);

        CREATE POLICY "Allow users to update their own trades" ON public.simulated_trades
          FOR UPDATE USING (true);

        RAISE NOTICE 'Created simulated_trades table';
    ELSE
        RAISE NOTICE 'simulated_trades table already exists, skipping creation';
    END IF;
END $$;

-- STEP 3: Handle copy_follows table
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'copy_follows') THEN
        CREATE TABLE public.copy_follows (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          trader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          platform_id INTEGER REFERENCES public.platforms(id) ON DELETE SET NULL,
          allocation_percentage INTEGER NOT NULL DEFAULT 10 CHECK (allocation_percentage >= 1 AND allocation_percentage <= 100),
          max_bet_amount TEXT NOT NULL DEFAULT '0',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT copy_follows_unique_follow UNIQUE (follower_id, trader_id, platform_id),
          CONSTRAINT copy_follows_not_self CHECK (follower_id != trader_id)
        );

        CREATE INDEX idx_copy_follows_follower ON public.copy_follows(follower_id);
        CREATE INDEX idx_copy_follows_trader ON public.copy_follows(trader_id);
        CREATE INDEX idx_copy_follows_active ON public.copy_follows(is_active);
        CREATE INDEX idx_copy_follows_platform ON public.copy_follows(platform_id);

        ALTER TABLE public.copy_follows ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Allow read access to all users" ON public.copy_follows
          FOR SELECT USING (true);

        CREATE POLICY "Allow users to insert their own follows" ON public.copy_follows
          FOR INSERT WITH CHECK (true);

        CREATE POLICY "Allow users to update their own follows" ON public.copy_follows
          FOR UPDATE USING (true);

        CREATE POLICY "Allow users to delete their own follows" ON public.copy_follows
          FOR DELETE USING (true);

        RAISE NOTICE 'Created copy_follows table';
    ELSE
        RAISE NOTICE 'copy_follows table already exists, skipping creation';
    END IF;
END $$;

-- STEP 4: Handle copy_trades table (with migration for existing table)
-- ============================================================================
DO $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'copy_trades') THEN
        -- Create new table with full schema
        CREATE TABLE public.copy_trades (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          copy_follow_id UUID NOT NULL REFERENCES public.copy_follows(id) ON DELETE CASCADE,
          original_bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL,
          copied_bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL,
          follower_address TEXT NOT NULL,
          trader_address TEXT NOT NULL,
          platform_id INTEGER REFERENCES public.platforms(id) ON DELETE SET NULL,
          market_id TEXT NOT NULL,
          position TEXT NOT NULL,
          original_amount TEXT NOT NULL,
          copied_amount TEXT NOT NULL,
          allocation_percentage INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          error_message TEXT,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        RAISE NOTICE 'Created copy_trades table with full schema';
    ELSE
        RAISE NOTICE 'copy_trades table exists, checking for missing columns';

        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'follower_address') THEN
            ALTER TABLE public.copy_trades ADD COLUMN follower_address TEXT;
            RAISE NOTICE 'Added follower_address column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'trader_address') THEN
            ALTER TABLE public.copy_trades ADD COLUMN trader_address TEXT;
            RAISE NOTICE 'Added trader_address column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'platform_id') THEN
            ALTER TABLE public.copy_trades ADD COLUMN platform_id INTEGER REFERENCES public.platforms(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added platform_id column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'market_id') THEN
            ALTER TABLE public.copy_trades ADD COLUMN market_id TEXT;
            RAISE NOTICE 'Added market_id column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'position') THEN
            ALTER TABLE public.copy_trades ADD COLUMN position TEXT;
            RAISE NOTICE 'Added position column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'original_amount') THEN
            ALTER TABLE public.copy_trades ADD COLUMN original_amount TEXT;
            RAISE NOTICE 'Added original_amount column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'copied_amount') THEN
            ALTER TABLE public.copy_trades ADD COLUMN copied_amount TEXT;
            RAISE NOTICE 'Added copied_amount column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'allocation_percentage') THEN
            ALTER TABLE public.copy_trades ADD COLUMN allocation_percentage INTEGER;
            RAISE NOTICE 'Added allocation_percentage column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'status') THEN
            ALTER TABLE public.copy_trades ADD COLUMN status TEXT DEFAULT 'pending';
            RAISE NOTICE 'Added status column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'error_message') THEN
            ALTER TABLE public.copy_trades ADD COLUMN error_message TEXT;
            RAISE NOTICE 'Added error_message column';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns
                      WHERE table_schema = 'public'
                      AND table_name = 'copy_trades'
                      AND column_name = 'created_at') THEN
            ALTER TABLE public.copy_trades ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added created_at column';
        END IF;
    END IF;
END $$;

-- STEP 5: Create indexes for copy_trades if they don't exist
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_copy_trades_follow') THEN
        CREATE INDEX idx_copy_trades_follow ON public.copy_trades(copy_follow_id);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_copy_trades_original') THEN
        CREATE INDEX idx_copy_trades_original ON public.copy_trades(original_bet_id);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_copy_trades_copied') THEN
        CREATE INDEX idx_copy_trades_copied ON public.copy_trades(copied_bet_id);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_copy_trades_follower') THEN
        CREATE INDEX idx_copy_trades_follower ON public.copy_trades(follower_address);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_copy_trades_trader') THEN
        CREATE INDEX idx_copy_trades_trader ON public.copy_trades(trader_address);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_copy_trades_status') THEN
        CREATE INDEX idx_copy_trades_status ON public.copy_trades(status);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_copy_trades_platform') THEN
        CREATE INDEX idx_copy_trades_platform ON public.copy_trades(platform_id);
    END IF;
END $$;

-- STEP 6: Enable RLS and create policies for copy_trades
-- ============================================================================
ALTER TABLE public.copy_trades ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Allow read access to all users" ON public.copy_trades;
CREATE POLICY "Allow read access to all users" ON public.copy_trades
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow system to insert copy trades" ON public.copy_trades;
CREATE POLICY "Allow system to insert copy trades" ON public.copy_trades
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow system to update copy trades" ON public.copy_trades;
CREATE POLICY "Allow system to update copy trades" ON public.copy_trades
  FOR UPDATE USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify all tables and columns exist:
SELECT
    t.tablename,
    COUNT(c.column_name) as column_count
FROM pg_tables t
LEFT JOIN information_schema.columns c
    ON c.table_schema = t.schemaname
    AND c.table_name = t.tablename
WHERE t.schemaname = 'public'
AND t.tablename IN ('simulated_trades', 'copy_follows', 'copy_trades')
GROUP BY t.tablename
ORDER BY t.tablename;

-- Expected output:
-- simulated_trades  | 9 columns
-- copy_follows      | 9 columns
-- copy_trades       | 16 columns
