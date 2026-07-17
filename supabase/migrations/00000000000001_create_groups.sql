-- Create the groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL,
  size TEXT NOT NULL,
  notes TEXT,
  cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add group_id to photos table
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
