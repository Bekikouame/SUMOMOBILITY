// src/modules/rides/seeds/cancellation-causes.seed.ts
export const CANCELLATION_CAUSES_SEED = [
  // Causes CLIENT
  { label: 'Changement d\'avis', category: 'CLIENT', description: 'Le client ne souhaite plus effectuer le trajet' },
  { label: 'Mauvaise adresse', category: 'CLIENT', description: 'Erreur dans l\'adresse de départ ou d\'arrivée' },
  { label: 'Urgence personnelle', category: 'CLIENT', description: 'Situation d\'urgence empêchant le voyage' },
  { label: 'Attente trop longue', category: 'CLIENT', description: 'Délai d\'attente du chauffeur trop important' },
  { label: 'Prix trop élevé', category: 'CLIENT', description: 'Tarif estimé non acceptable' },

  // Causes DRIVER
  { label: 'Trafic important', category: 'DRIVER', description: 'Embouteillages empêchant d\'arriver à temps' },
  { label: 'Problème véhicule', category: 'DRIVER', description: 'Panne ou problème technique du véhicule' },
  { label: 'Distance trop importante', category: 'DRIVER', description: 'Trajet trop long par rapport au rayon d\'action' },
  { label: 'Client introuvable', category: 'DRIVER', description: 'Impossible de localiser le client au point de RDV' },
  { label: 'Urgence personnelle', category: 'DRIVER', description: 'Situation d\'urgence empêchant la course' },

  // Causes SYSTÈME
  { label: 'Erreur technique', category: 'SYSTEM', description: 'Problème technique de l\'application' },
  { label: 'Paiement refusé', category: 'SYSTEM', description: 'Échec du traitement du paiement' },
  { label: 'Conditions météo', category: 'SYSTEM', description: 'Conditions météorologiques dangereuses' },
];
