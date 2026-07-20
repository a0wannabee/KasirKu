const { PrismaClient } = require('@prisma/client');

// Single shared Prisma instance. Using Prisma's parametrized query builder
// everywhere means user input is NEVER concatenated into raw SQL strings,
// which is our primary defense against SQL injection.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
