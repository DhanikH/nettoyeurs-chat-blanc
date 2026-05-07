ALTER TABLE Jobs DROP CONSTRAINT jobs_job_lifecycle_status_check;
ALTER TABLE Jobs ADD CONSTRAINT jobs_job_lifecycle_status_check CHECK (job_lifecycle_status IN ('pending_quote', 'pending_claim', 'claimed', 'claimed_scheduled', 'completed', 'cancelled', 'pending_homeowner_approval', 'homeowner_rejected', 'pending_invoice'));
