-- Migration: Ajouter le champ expoPushToken à la table User
-- À exécuter via votre client PostgreSQL (pgAdmin, psql, DBeaver, etc.)

-- Ajouter la colonne expoPushToken
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "expoPushToken" TEXT;

-- Vérifier que la colonne a été ajoutée
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'User'
AND column_name = 'expoPushToken';
