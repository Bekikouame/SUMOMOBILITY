// src/modules/rides/seeds/cancellation-causes.seed.ts
import { randomUUID } from 'crypto';

export const CANCELLATION_CAUSES_SEED = [
  // Causes CLIENT
  { id: randomUUID(), label: 'Changement d\'avis', category: 'CLIENT', description: 'Le client ne souhaite plus effectuer le trajet' },
  { id: randomUUID(), label: 'Mauvaise adresse', category: 'CLIENT', description: 'Erreur dans l\'adresse de départ ou d\'arrivée' },
  { id: randomUUID(), label: 'Urgence personnelle', category: 'CLIENT', description: 'Situation d\'urgence empêchant le voyage' },
  { id: randomUUID(), label: 'Attente trop longue', category: 'CLIENT', description: 'Délai d\'attente du chauffeur trop important' },
  { id: randomUUID(), label: 'Prix trop élevé', category: 'CLIENT', description: 'Tarif estimé non acceptable' },

  // Causes DRIVER
  { id: randomUUID(), label: 'Trafic important', category: 'DRIVER', description: 'Embouteillages empêchant d\'arriver à temps' },
  { id: randomUUID(), label: 'Problème véhicule', category: 'DRIVER', description: 'Panne ou problème technique du véhicule' },
  { id: randomUUID(), label: 'Distance trop importante', category: 'DRIVER', description: 'Trajet trop long par rapport au rayon d\'action' },
  { id: randomUUID(), label: 'Client introuvable', category: 'DRIVER', description: 'Impossible de localiser le client au point de RDV' },
  { id: randomUUID(), label: 'Urgence personnelle', category: 'DRIVER', description: 'Situation d\'urgence empêchant la course' },

  // Causes SYSTÈME
  { id: randomUUID(), label: 'Erreur technique', category: 'SYSTEM', description: 'Problème technique de l\'application' },
  { id: randomUUID(), label: 'Paiement refusé', category: 'SYSTEM', description: 'Échec du traitement du paiement' },
  { id: randomUUID(), label: 'Conditions météo', category: 'SYSTEM', description: 'Conditions météorologiques dangereuses' },
];