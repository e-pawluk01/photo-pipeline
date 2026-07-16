-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  upload_timestamp TIMESTAMPTZ DEFAULT now(),
  session_id TEXT NOT NULL
);

-- Enable RLS (Row Level Security) but allow all for now since we use service role anyway,
-- or keep it disabled. We will leave it default (disabled) or enabled.
-- ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
