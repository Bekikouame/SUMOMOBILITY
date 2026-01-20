// Script pour nettoyer les véhicules en double
// Usage: npx ts-node scripts/clean-duplicate-vehicles.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDuplicateVehicles() {
  try {
    console.log('🔍 Recherche des véhicules en double...');

    // Trouver tous les véhicules avec la plaque AB123CD
    const vehicles = await prisma.vehicle.findMany({
      where: { plateNumber: 'AB123CD' },
      include: {
        driver: {
          include: { user: true }
        }
      }
    });

    console.log(`\n📋 Véhicules trouvés: ${vehicles.length}`);

    vehicles.forEach((v, index) => {
      console.log(`\n${index + 1}. Véhicule ID: ${v.id}`);
      console.log(`   Plaque: ${v.plateNumber}`);
      console.log(`   Marque/Modèle: ${v.brand} ${v.model}`);
      console.log(`   Chauffeur: ${v.driver?.user?.firstName} ${v.driver?.user?.lastName}`);
      console.log(`   Email: ${v.driver?.user?.email}`);
      console.log(`   Statut: ${v.status}`);
    });

    // Supprimer tous les véhicules sauf le dernier créé
    if (vehicles.length > 1) {
      const vehiclesToDelete = vehicles.slice(0, -1); // Garder le dernier

      console.log(`\n🗑️  Suppression de ${vehiclesToDelete.length} véhicule(s) en double...`);

      for (const vehicle of vehiclesToDelete) {
        await prisma.vehicle.delete({ where: { id: vehicle.id } });
        console.log(`   ✅ Véhicule ${vehicle.id} supprimé`);
      }

      console.log(`\n✅ Nettoyage terminé! ${vehicles.length - 1} véhicule(s) supprimé(s)`);
    } else {
      console.log('\n✅ Aucun doublon trouvé');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicateVehicles();
