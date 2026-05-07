-- 1. Enable RLS on the job_media table
ALTER TABLE job_media ENABLE ROW LEVEL SECURITY;

-- 2. Create policy to allow authenticated users to SELECT their job media
DROP POLICY IF EXISTS "Allow authenticated users to select job media" ON job_media;
CREATE POLICY "Allow authenticated users to select job media" ON job_media
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. Create policy to allow public users to INSERT job media
DROP POLICY IF EXISTS "Allow authenticated users to insert job media" ON job_media;
DROP POLICY IF EXISTS "Allow public users to insert job media" ON job_media;
CREATE POLICY "Allow public users to insert job media" ON job_media
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 4. Create policy to allow authenticated users to UPDATE their job media
DROP POLICY IF EXISTS "Allow authenticated users to update job media" ON job_media;
CREATE POLICY "Allow authenticated users to update job media" ON job_media
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
