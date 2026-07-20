#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL database to be ready..."
# Loop until prisma can connect to database or migrate deploy succeeds
until npx prisma migrate deploy; do
  echo "⚠️ Database not ready yet, retrying in 3 seconds..."
  sleep 3
done

echo "✅ Prisma migrations deployed successfully!"

echo "🌱 Running database seeding..."
node prisma/seed.js || echo "ℹ️ Seeding completed or already seeded."

echo "🚀 Starting backend server..."
exec "$@"
