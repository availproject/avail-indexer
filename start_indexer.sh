#!/bin/bash

# Check if npm is installed and install it if not
if ! command -v npm &> /dev/null; then
  echo "npm is not installed. Installing npm..."
  curl -fsSL https://npmjs.org/install.sh | sh -
fi

# Checkout the main branch and pull the latest changes
echo "Checking out the main branch and pulling latest changes..."
git checkout main
git pull

# Install @subql/cli globally if not already installed
if ! command -v subql &> /dev/null; then
  echo "@subql/cli is not installed. Installing @subql/cli..."
  npm install -g @subql/cli@5.8.1
fi

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Generate code
echo "Generating code..."
npm run codegen

# Build the project
echo "Building the project..."
npm run build

# Pull Docker images
echo "Pulling Docker images..."
sudo docker-compose pull

# Start Docker containers
echo "Starting Docker containers..."
sudo docker-compose up --remove-orphans

# Continuous loop to check and restart the containers every 2 minutes
while true; do
  sleep 120  # Sleep for 2 minutes

  # List of container name prefixes to check
  container_name_prefixes=("avail-indexer-postgres" "avail-indexer-graphql-engine" "avail-indexer-subquery-node")

  containers_not_running=0

  # Loop through the container name prefixes and check if any containers are not running
  for prefix in "${container_name_prefixes[@]}"; do
    if ! sudo docker ps --format "{{.Names}}" | grep -q "^${prefix}"; then
      echo "Container with prefix '${prefix}' is not running."
      containers_not_running=1
    fi
  done

  # Check if any containers are not running and restart them
  if [ "$containers_not_running" -eq 1 ]; then
    echo "Restarting Docker containers..."
    sudo docker-compose down
    sudo docker-compose up --remove-orphans
  fi
done
