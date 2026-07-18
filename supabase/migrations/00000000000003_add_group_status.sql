ALTER TABLE groups ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE groups ADD COLUMN drive_folder_link TEXT;
ALTER TABLE groups ADD COLUMN error_message TEXT;
