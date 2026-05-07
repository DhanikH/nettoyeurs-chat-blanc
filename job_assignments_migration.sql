-- Create JobAssignments table
CREATE TABLE IF NOT EXISTS JobAssignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES Jobs(id),
    cleaner_id UUID REFERENCES Users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing cleaner_id to JobAssignments
INSERT INTO JobAssignments (job_id, cleaner_id)
SELECT id, cleaner_id
FROM Jobs
WHERE cleaner_id IS NOT NULL;

-- Remove cleaner_id from Jobs table
ALTER TABLE Jobs DROP COLUMN cleaner_id;
