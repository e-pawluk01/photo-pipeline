-- Create sequence tracking table
CREATE TABLE IF NOT EXISTS sku_sequences (
    prefix VARCHAR(10) PRIMARY KEY,
    last_number INT NOT NULL DEFAULT 0
);

-- Function to atomically get and increment the next SKU for a given prefix
CREATE OR REPLACE FUNCTION generate_next_sku(sku_prefix VARCHAR) RETURNS TEXT AS $$
DECLARE
    next_num INT;
BEGIN
    INSERT INTO sku_sequences (prefix, last_number)
    VALUES (sku_prefix, 1)
    ON CONFLICT (prefix) DO UPDATE
    SET last_number = sku_sequences.last_number + 1
    RETURNING last_number INTO next_num;

    -- Return format like 'J001' (pads to 3 digits)
    RETURN sku_prefix || TO_CHAR(next_num, 'FM000');
END;
$$ LANGUAGE plpgsql;

-- Add sku and sourced columns to groups
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS sourced TEXT;
