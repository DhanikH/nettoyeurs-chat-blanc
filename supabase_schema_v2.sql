-- Supabase SQL Schema Migration Script
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_designation TEXT NOT NULL CHECK (role_designation IN ('homeowner', 'cleaner', 'admin')),
    phone_number TEXT,
    address TEXT,
    profile_picture TEXT,
    bio TEXT,
    cv TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    loyalty_subscription_tier TEXT DEFAULT 'none',
    preferences TEXT, -- JSON string
    abandoned_count INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties Table
CREATE TABLE IF NOT EXISTS Properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES Users(id),
    address TEXT,
    postal_code TEXT,
    square_feet INTEGER,
    bedrooms INTEGER,
    bathrooms INTEGER,
    living_rooms INTEGER,
    windows INTEGER,
    offices INTEGER DEFAULT 0,
    preferred_time TEXT,
    has_pets BOOLEAN DEFAULT FALSE,
    entry_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create JobAssignments table
CREATE TABLE IF NOT EXISTS JobAssignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES Jobs(id),
    cleaner_id UUID REFERENCES Users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs Table
CREATE TABLE IF NOT EXISTS Jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES Properties(id),
    homeowner_id UUID REFERENCES Users(id),
    scheduled_date TIMESTAMPTZ NOT NULL,
    scheduled_end_date TIMESTAMPTZ,
    time_frame TEXT, -- e.g., 'morning', 'afternoon', 'evening'
    specific_date TIMESTAMPTZ,
    calculated_base_price REAL,
    final_transaction_price REAL,
    cleaner_payout REAL,
    job_lifecycle_status TEXT NOT NULL CHECK (job_lifecycle_status IN ('pending_quote', 'pending_claim', 'claimed', 'claimed_scheduled', 'completed', 'cancelled', 'pending_homeowner_approval', 'homeowner_rejected')),
    special_instructions TEXT,
    window_cleaning BOOLEAN DEFAULT FALSE,
    oven_cleaning BOOLEAN DEFAULT FALSE,
    deep_cleaning BOOLEAN DEFAULT FALSE,
    frequency TEXT DEFAULT 'none',
    is_abandoned BOOLEAN DEFAULT FALSE,
    paid BOOLEAN DEFAULT FALSE,
    cleaner_paid BOOLEAN DEFAULT FALSE,
    rating INTEGER,
    review_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CustomerNotes Table
CREATE TABLE IF NOT EXISTS CustomerNotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES Users(id),
    author_id UUID REFERENCES Users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS Notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id UUID REFERENCES Users(id),
    target_role TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback Table (General App Feedback)
CREATE TABLE IF NOT EXISTS Feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(id),
    page_url TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function for incrementing abandoned count
CREATE OR REPLACE FUNCTION increment_abandoned_count(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE Users
    SET abandoned_count = abandoned_count + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS Subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    homeowner_id UUID REFERENCES Users(id),
    property_id UUID REFERENCES Properties(id),
    frequency TEXT NOT NULL,
    completed_cleanings INTEGER DEFAULT 0,
    total_discount_received REAL DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Charges Table (for logging fees)
CREATE TABLE IF NOT EXISTS Charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(id),
    subscription_id UUID REFERENCES Subscriptions(id),
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments Table (for tracking transactions)
CREATE TABLE IF NOT EXISTS Payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES Jobs(id),
    user_id UUID REFERENCES Users(id),
    stripe_payment_intent_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'succeeded',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update Jobs Table to include subscription_id
ALTER TABLE Jobs ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES Subscriptions(id);
ALTER TABLE Jobs ADD COLUMN IF NOT EXISTS deposit_amount REAL DEFAULT 0;
ALTER TABLE Jobs ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE Jobs ADD COLUMN IF NOT EXISTS penalty_status TEXT DEFAULT 'none';
ALTER TABLE Jobs ADD COLUMN IF NOT EXISTS discount_applied REAL DEFAULT 0;
ALTER TABLE Jobs ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Update Subscriptions Table to include minimum_payments_required
ALTER TABLE Subscriptions ADD COLUMN IF NOT EXISTS minimum_payments_required INTEGER DEFAULT 4;
