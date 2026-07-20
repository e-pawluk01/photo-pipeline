ALTER TABLE public.groups 
ADD COLUMN measurements TEXT,
ADD COLUMN generate_cover BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN reference_photo_id TEXT;
