-- Add bought_for_price to photos and groups
ALTER TABLE photos ADD COLUMN IF NOT EXISTS bought_for_price TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS bought_for_price TEXT;
