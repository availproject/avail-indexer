#!/bin/bash

# Checking to see if all the containers are operational. If any container is down then docker compose pulls it down and restarts it 
CONTAINERS=$(sudo docker ps --format '{{.Names}}' | wc -l)

if [ $CONTAINERS -lt 3 ]; then
    echo "Restarting Docker containers..."
    cd ~/avail-indexer
    sudo docker compose down
    sudo docker compose up -d
    echo "Restarted"
fi

echo "All Containers running"