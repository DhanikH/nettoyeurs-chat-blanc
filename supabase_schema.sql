-- Supabase SQL Schema Migration Script
-- Run this in the Supabase SQL Editor

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    id UUID PRIMARY KEY,
    contact_email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_designation TEXT NOT NULL CHECK (role_designation IN ('homeowner', 'cleaner', 'admin')),
    phone_number TEXT,
    address TEXT,
    profile_picture TEXT,
    bio TEXT,
    cv TEXT,
    is_approved INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    loyalty_subscription_tier TEXT DEFAULT 'none',
    preferences TEXT, -- JSON string
    abandoned_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties Table
CREATE TABLE IF NOT EXISTS Properties (
    id UUID PRIMARY KEY,
    owner_id UUID REFERENCES Users(id),
    address TEXT,
    square_feet INTEGER,
    bedrooms INTEGER,
    bathrooms INTEGER,
    living_rooms INTEGER,
    windows INTEGER,
    offices INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs Table
CREATE TABLE IF NOT EXISTS Jobs (
    id UUID PRIMARY KEY,
    property_id UUID REFERENCES Properties(id),
    homeowner_id UUID REFERENCES Users(id),
    cleaner_id UUID REFERENCES Users(id),
    scheduled_date TEXT NOT NULL,
    scheduled_end_date TEXT,
    specific_date TEXT,
    calculated_base_price REAL,
    final_transaction_price REAL,
    cleaner_payout REAL,
    job_lifecycle_status TEXT NOT NULL CHECK (job_lifecycle_status IN ('pending_quote', 'pending_claim', 'claimed', 'claimed_scheduled', 'completed', 'cancelled')),
    special_instructions TEXT,
    window_cleaning INTEGER DEFAULT 0,
    oven_cleaning INTEGER DEFAULT 0,
    deep_cleaning INTEGER DEFAULT 0,
    frequency TEXT DEFAULT 'none',
    is_abandoned INTEGER DEFAULT 0,
    paid INTEGER DEFAULT 0,
    cleaner_paid INTEGER DEFAULT 0,
    rating INTEGER,
    review_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CustomerNotes Table
CREATE TABLE IF NOT EXISTS CustomerNotes (
    id UUID PRIMARY KEY,
    customer_id UUID REFERENCES Users(id),
    author_id UUID REFERENCES Users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS Notifications (
    id UUID PRIMARY KEY,
    target_user_id UUID REFERENCES Users(id),
    target_role TEXT,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback Table (General App Feedback)
CREATE TABLE IF NOT EXISTS Feedback (
    id UUID PRIMARY KEY,
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
