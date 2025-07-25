#!/bin/bash

# Deployment script for Inventory Management API
set -e

echo "🚀 Starting deployment process..."

# Configuration
ENVIRONMENT=${1:-production}
DOCKER_IMAGE="inventory-api"
CONTAINER_NAME="inventory-app"

echo "📋 Environment: $ENVIRONMENT"

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ Environment file .env.$ENVIRONMENT not found"
    exit 1
fi

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi

# Check if required environment variables are set
required_vars=("MONGODB_URI" "JWT_SECRET" "JWT_REFRESH_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

echo "✅ Pre-deployment checks passed"

# Build Docker image
echo "🏗️  Building Docker image..."
docker build -t $DOCKER_IMAGE:latest .
echo "✅ Docker image built successfully"

# Stop existing container
echo "🛑 Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Run database migrations (if any)
echo "🗄️  Running database migrations..."
# Add migration commands here if needed

# Start new container
echo "🚀 Starting new container..."
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
else
    docker-compose up -d
fi

# Wait for application to start
echo "⏳ Waiting for application to start..."
sleep 30

# Health check
echo "🏥 Performing health check..."
max_attempts=10
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost:${PORT:-5000}/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
        break
    else
        echo "⏳ Health check failed, attempt $attempt/$max_attempts"
        sleep 10
        ((attempt++))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Health check failed after $max_attempts attempts"
    echo "📋 Container logs:"
    docker logs $CONTAINER_NAME --tail 50
    exit 1
fi

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

echo "🎉 Deployment completed successfully!"
echo "📊 Application is running at http://localhost:${PORT:-5000}"
echo "📚 API documentation available at http://localhost:${PORT:-5000}/api-docs"