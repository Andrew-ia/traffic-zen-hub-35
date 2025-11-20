-- Remove foreign key constraint from user_preferences
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
