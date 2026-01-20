-- Script pour supprimer le véhicule avec la plaque AB123CD
-- Utilisez ce script en développement uniquement

-- Voir les véhicules avec cette plaque
SELECT * FROM vehicles WHERE "plateNumber" = 'AB123CD';

-- Supprimer le véhicule (décommentez si vous êtes sûr)
-- DELETE FROM vehicles WHERE "plateNumber" = 'AB123CD';
