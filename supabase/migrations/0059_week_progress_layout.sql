-- User-defined row/section order for the week progress view ("Hur det går").
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS week_progress_layout jsonb;
