// Fichier : G:\SumoMobility\backend\prisma\prisma.config.js


require('dotenv').config({ path: '../.env' }); 

const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');


module.exports = {
  // L'URL de base pour d'autres outils CLI
  databaseUrl: process.env.DATABASE_URL, 
  
  migrations: {
    // Adapter : utilise l'objet Pool et non l'URL brute
    adapter: new PrismaPg(
      new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    ),
  },
};