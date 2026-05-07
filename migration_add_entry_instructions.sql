-- Add entry_instructions to Properties table
ALTER TABLE Properties ADD COLUMN IF NOT EXISTS entry_instructions TEXT;

-- Add homeowner_preferences to Jobs table
ALTER TABLE Jobs ADD COLUMN IF NOT EXISTS homeowner_preferences TEXT;
