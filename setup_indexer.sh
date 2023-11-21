#!/bin/bash

function color() {
    # Usage: color "31;5" "string"
    # Some valid values for color:
    # - 5 blink, 1 strong, 4 underlined
    # - fg: 31 red,  32 green, 33 yellow, 34 blue, 35 purple, 36 cyan, 37 white
    # - bg: 40 black, 41 red, 44 blue, 45 purple
    printf '\033[%sm%s\033[0m\n' "$@"
}

# Taking user input for websocket and genesis hash
color "33" "Enter the websocket endpoint of the network you want to deploy the indexer for:"

read WS

color "33" "Enter the hash of block height 0 ie. genesis hash:"

read HASH

# Check if npm is installed and install it if not

if ! command -v npm &> /dev/null ; then
  echo "npm or node is not installed. Installing..."
  sudo apt-get install -y ca-certificates curl gnupg
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
  sudo apt-get update
  sudo apt-get install nodejs -y
fi

# Check if subql package is installed and install it if not
if ! command -v subql &> /dev/null; then
  echo "@subql/cli is not installed. Installing @subql/cli..."
  sudo npm install -g @subql/cli
fi

# Check if docker is installed and install it if not
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed. Installing..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
fi

# Cloning the indexer repo
git clone https://github.com/kaustubhkapatral/avail-indexer.git ~/avail-indexer
cd ~/avail-indexer

# Changing values of genesis hash and ws endpoint in project.yaml file
sed -i "s/<blockhash>/$HASH/g" project.yaml

sed -i "s@<ws-endpoint>@$WS@g" project.yaml

# Install npm dependencies
echo "Installing npm dependencies..."
sudo npm install

# Generate code
echo "Generating code..."
sudo npm run codegen

# Build the project
echo "Building the project..."
sudo npm run build

# Pull Docker images
echo "Pulling Docker images..."
sudo docker compose pull

# Start Docker containers
echo "Starting Docker containers..."
sudo docker compose up -d

# Setting up cron job for container autorestart script
crontab -l > ~/mycron

echo "* * * * * bash /home/ubuntu/avail-indexer/autorestart.sh" >> ~/mycron

crontab ~/mycron

rm ~/mycron

