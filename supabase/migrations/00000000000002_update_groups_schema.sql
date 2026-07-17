ALTER TABLE groups ADD COLUMN title TEXT DEFAULT 'Untitled';
ALTER TABLE groups ADD COLUMN category_path TEXT DEFAULT 'Woman/Other';
ALTER TABLE groups ADD COLUMN brand TEXT;
ALTER TABLE groups ADD COLUMN condition TEXT NOT NULL DEFAULT 'Very good';
