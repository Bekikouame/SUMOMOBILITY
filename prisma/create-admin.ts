import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'sumo@smartex-expertises.com';
  const password = 'SumoAdmin2025!'; // Change ce mot de passe
  
  console.log(' Vérification si l\'admin existe déjà...');
  
  // Vérifier si l'admin existe déjà
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    console.log(' Cet admin existe déjà !');
    console.log('Email:', email);
    console.log('ID:', existing.id);
    console.log('\n Pour vous connecter, utilisez cet email et votre mot de passe.');
    return;
  }

  console.log(' Création du hash du mot de passe...');
  
  // Hash le mot de passe
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log(' Création de l\'utilisateur admin...');
  
  // Crée l'utilisateur admin
  const admin = await prisma.user.create({
    data: {
      email,
      phone: '+2250700000000',
      firstName: 'Sumo',
      lastName: 'Admin',
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });
  
  console.log('\n Admin créé avec succès !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Email       :', email);
  console.log(' Mot de passe :', password);
  console.log(' ID          :', admin.id);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n Connectez-vous sur : http://localhost:3001/login');
  console.log('\n  IMPORTANT : Notez bien votre mot de passe !');
}

main()
  .catch((e) => {
    console.error(' Erreur lors de la création de l\'admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });