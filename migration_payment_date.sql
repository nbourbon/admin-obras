-- Migration: Add payment_date column to participant_payments table
-- Run this in Supabase SQL Editor or psql

-- Check if column exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='participant_payments'
        AND column_name='payment_date'
    ) THEN
        ALTER TABLE participant_payments ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Column payment_date added to participant_payments table';
    ELSE
        RAISE NOTICE 'Column payment_date already exists in participant_payments table';
    END IF;
END $$;
