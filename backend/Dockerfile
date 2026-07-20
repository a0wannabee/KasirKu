FROM node:20-slim AS base

# Install required system dependencies: OpenSSL (for Prisma Query Engine), postgresql-client (for pg_dump cron job), curl (for healthchecks), and ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    postgresql-client \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the backend source code
COPY . .

# Ensure entrypoint script is executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
