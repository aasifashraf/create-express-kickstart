# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency manifests first for better layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ---- Production stage ----
FROM node:20-alpine

WORKDIR /usr/src/app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy installed dependencies from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application source
COPY . .

# Set correct ownership
RUN chown -R appuser:appgroup /usr/src/app

# Run as non-root user
USER appuser

# Expose port the app runs on
EXPOSE 8000

# Command to run the application
CMD [ "node", "src/server.js" ]
