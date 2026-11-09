-- 011_user_bio.sql — « petit mot » facultatif qui caractérise l'utilisateur (annuaire des IAmbassadeurs).
ALTER TABLE charte_ia.users ADD COLUMN IF NOT EXISTS bio VARCHAR(160);
