#!/bin/bash

# Vortexus Deployment Script
# This script automates the deployment process for the Vortexus application on Digital Ocean
# Optimized to use existing environment variables from backend/.env
# Updated for macOS compatibility

# Color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
  echo -e "\n${BLUE}==== $1 ====${NC}\n"
}

# Function to print success messages
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error messages
print_error() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

# Function to print warning messages
print_warning() {
  echo -e "${YELLOW}! $1${NC}"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to update file with cross-platform sed
update_file() {
  local search="$1"
  local replace="$2"
  local file="$3"
  
  # Check if on macOS or Linux
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|$search|$replace|" "$file"
  else
    # Linux
    sed -i "s|$search|$replace|" "$file"
  fi
}

# Welcome message
clear
echo -e "${GREEN}"
echo "  __      __       _                       "
echo "  \ \    / /      | |                      "
echo "   \ \  / /__  _ __| |_ _____  ___   _ ___ "
echo "    \ \/ / _ \| '__| __/ _ \ \/ / | | / __|"
echo "     \  / (_) | |  | ||  __/>  <| |_| \__ \\"
echo "      \/ \___/|_|   \__\___/_/\_\\__,_|___/"
echo -e "${NC}"
echo "Optimized Deployment Script"
echo "=========================="
echo "This script will deploy Vortexus on Digital Ocean using your existing configuration."
echo

# Check if we're on macOS - skip the Digital Ocean check in this case
if [[ "$OSTYPE" == "darwin"* ]]; then
  print_warning "Running on macOS. This is a local test run, not an actual deployment."
  
  # Ask for an IP to use for testing
  read -p "Enter an IP address to use for configuration (or press enter for localhost): " MANUAL_IP
  if [ -z "$MANUAL_IP" ]; then
    MANUAL_IP="127.0.0.1"
  fi
else
  # Check if running on the Digital Ocean droplet
  if ! grep -q "DigitalOcean" /proc/cpuinfo 2>/dev/null && ! grep -q "DigitalOcean" /sys/devices/virtual/dmi/id/sys_vendor 2>/dev/null; then
    print_warning "This script should be run on your Digital Ocean droplet."
    read -p "Are you running this on your Digital Ocean droplet? (y/n): " on_droplet
    if [[ $on_droplet != "y" && $on_droplet != "Y" ]]; then
      print_error "Please run this script on your Digital Ocean droplet."
    fi
  fi
fi

# Step 1-3: Digital Ocean Droplet Setup
print_section "STEP 1-3: Digital Ocean Droplet Setup"

echo "Checking if Docker is installed..."
if ! command_exists docker; then
  echo "Docker is not installed. Installing Docker..."
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    print_warning "Docker needs to be installed manually on macOS. Please download Docker Desktop from https://www.docker.com/products/docker-desktop"
  else
    # Update the package lists
    sudo apt update || print_error "Failed to update package lists."
    
    # Install required packages
    sudo apt install -y apt-transport-https ca-certificates curl software-properties-common || print_error "Failed to install required packages."
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up the stable repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update the package lists again
    sudo apt update || print_error "Failed to update package lists after adding Docker repository."
    
    # Install Docker
    sudo apt install -y docker-ce docker-ce-cli containerd.io || print_error "Failed to install Docker."
  fi
  
  print_success "Docker installed successfully."
else
  print_success "Docker is already installed."
fi

echo "Checking if Docker Compose is installed..."
if ! command_exists docker-compose && ! docker compose version > /dev/null 2>&1; then
  echo "Docker Compose is not installed. Installing Docker Compose..."
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    print_warning "Docker Compose is included with Docker Desktop for macOS."
  else
    # Install Docker Compose
    sudo apt install -y docker-compose-plugin || print_error "Failed to install Docker Compose."
  fi
  
  print_success "Docker Compose installed successfully."
else
  print_success "Docker Compose is already installed."
fi

# Step 4: Configure Environment Variables
print_section "STEP 4: Configure Environment Variables"

# Get the Digital Ocean IP
if [[ "$OSTYPE" == "darwin"* ]]; then
  DROPLET_IP="$MANUAL_IP"
else
  DROPLET_IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || hostname -I | awk '{print $1}')
fi
echo "Using IP address for configuration: $DROPLET_IP"

# Check if backend/.env exists
if [ -f "backend/.env" ]; then
  echo "Found existing environment variables in backend/.env"
  # Copy backend/.env to root .env
  cp backend/.env .env || print_error "Failed to copy backend/.env to root directory"
  print_success "Used existing environment variables from backend/.env"
else
  # Check if .env.production exists
  if [ -f ".env.production" ]; then
    echo "No backend/.env found. Creating .env from .env.production template..."
    cp .env.production .env || print_error "Failed to create .env file from template."
    print_success ".env file created from template."
  elif [ -f "backend/.env.production" ]; then
    echo "No backend/.env found. Creating .env from backend/.env.production template..."
    cp backend/.env.production .env || print_error "Failed to create .env file from backend template."
    print_success ".env file created from backend template."
  else
    print_error "No environment variable templates found. Please create a .env file manually."
  fi
fi

# Configure environment variables for polling mode
echo "Configuring Telegram bot for polling mode..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS requires an empty string for the sed pattern
  sed -i '' 's/^TELEGRAM_WEBHOOK_URL=.*/TELEGRAM_WEBHOOK_URL=/' .env || print_error "Failed to update TELEGRAM_WEBHOOK_URL in .env"
else
  # Linux version
  sed -i 's/^TELEGRAM_WEBHOOK_URL=.*/TELEGRAM_WEBHOOK_URL=/' .env || print_error "Failed to update TELEGRAM_WEBHOOK_URL in .env"
fi

# Update frontend URL
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS version
  sed -i '' "s|^FRONTEND_URL=.*|FRONTEND_URL=http://$DROPLET_IP|" .env || print_error "Failed to update FRONTEND_URL in .env"
else
  # Linux version
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=http://$DROPLET_IP|" .env
fi
print_success "Updated FRONTEND_URL to http://$DROPLET_IP"

# Update PUBLIC_API_URL if it exists
if grep -q "^PUBLIC_API_URL=" .env; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS version
    sed -i '' "s|^PUBLIC_API_URL=.*|PUBLIC_API_URL=http://$DROPLET_IP/prompt|" .env
  else
    # Linux version
    sed -i "s|^PUBLIC_API_URL=.*|PUBLIC_API_URL=http://$DROPLET_IP/prompt|" .env
  fi
  print_success "Updated PUBLIC_API_URL to http://$DROPLET_IP/prompt"
else
  # Add PUBLIC_API_URL if it doesn't exist
  echo "PUBLIC_API_URL=http://$DROPLET_IP/prompt" >> .env
  print_success "Added PUBLIC_API_URL as http://$DROPLET_IP/prompt"
fi

print_success "Environment variables configured successfully."

# Step 5: Configure Frontend Environment
print_section "STEP 5: Configure Frontend Environment"

# Extract Solana URL from .env
SOLANA_URL=$(grep "^SOLANA_URL=" .env | cut -d '=' -f2)

# Create .env.local file for frontend
if [ -d "frontend" ]; then
  echo "Creating .env.local for frontend..."
  cat > frontend/.env.local << EOF
NEXT_PUBLIC_BACKEND_API_URL=http://$DROPLET_IP/prompt
NEXT_PUBLIC_SOLANA_RPC_URL=$SOLANA_URL
EOF
  print_success "Created frontend/.env.local with necessary environment variables."
fi

# Step 6: Configure Nginx
print_section "STEP 6: Configure Nginx"

echo "Using no-SSL configuration for Nginx..."
if [ -f "nginx/conf.d/default-no-ssl.conf" ]; then
  cp nginx/conf.d/default-no-ssl.conf nginx/conf.d/default.conf || print_error "Failed to copy Nginx configuration."
  
  # Update the server_name in the Nginx config
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS version
    sed -i '' "s/server_name .*;/server_name $DROPLET_IP;/" nginx/conf.d/default.conf
  else
    # Linux version
    sed -i "s/server_name .*;/server_name $DROPLET_IP;/" nginx/conf.d/default.conf
  fi
  
  print_success "Configured Nginx to use no-SSL configuration with IP address: $DROPLET_IP"
else
  print_warning "Could not find nginx/conf.d/default-no-ssl.conf. Skipping Nginx configuration."
fi

# Step 7: Verify Telegram Webhook is Cleared
print_section "STEP 7: Verify Telegram Webhook is Cleared"

TELEGRAM_BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env | cut -d '=' -f2)

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  echo "Checking current webhook status..."
  WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo")
  
  # Check if there's an existing webhook
  if echo "$WEBHOOK_INFO" | grep -q '"url":"[^"]*"'; then
    echo "Clearing existing webhook..."
    CLEAR_RESULT=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook")
    if echo "$CLEAR_RESULT" | grep -q '"ok":true'; then
      print_success "Webhook cleared successfully. Bot will use polling mode."
    else
      print_warning "Failed to clear webhook. Please check your Telegram Bot Token."
    fi
  else
    print_success "No webhook is set. Bot is ready for polling mode."
  fi
else
  print_warning "Telegram Bot Token not available. Skipping webhook verification."
fi

# Step 8: Start the Application
print_section "STEP 8: Start the Application"

if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Building and starting all services..."
  docker compose down
  docker compose up -d --build
else
  echo "Building and starting all services..."
  sudo docker compose down
  sudo docker compose up -d --build
fi

if [ $? -eq 0 ]; then
  print_success "Application started successfully!"
else
  print_error "Failed to start the application. Check docker-compose logs for details."
fi

# Step 9: Verify Services
print_section "STEP 9: Verify Services"

echo "Waiting for services to initialize (30 seconds)..."
sleep 30

echo "Checking service status..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  if docker compose ps | grep -q "Exit"; then
    print_warning "Some services are not running. Checking logs..."
    docker compose logs --tail 50
  else
    print_success "All services are running!"
  fi
else
  if sudo docker compose ps | grep -q "Exit"; then
    print_warning "Some services are not running. Checking logs..."
    sudo docker compose logs --tail 50
  else
    print_success "All services are running!"
  fi
fi

# Step 10: Final Instructions
print_section "STEP 10: Final Instructions"

echo "Deployment is complete! Here's how to access your services:"
echo
echo "Frontend: http://$DROPLET_IP"
echo "Backend API: http://$DROPLET_IP/prompt"
echo "Telegram Bot: The bot should be running in polling mode"
echo
echo "To monitor your services and check logs:"
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "  - View all logs: docker compose logs"
  echo "  - View specific service logs: docker compose logs [service]"
  echo "    Available services: frontend, backend, postgres, nginx"
  echo
  echo "To view Telegram bot logs specifically:"
  echo "  docker compose logs backend | grep 'telegram'"
  echo
  echo "To rebuild and restart a specific service:"
  echo "  docker compose up -d --build [service]"
  echo
  echo "To stop all services:"
  echo "  docker compose down"
else
  echo "  - View all logs: sudo docker compose logs"
  echo "  - View specific service logs: sudo docker compose logs [service]"
  echo "    Available services: frontend, backend, postgres, nginx"
  echo
  echo "To view Telegram bot logs specifically:"
  echo "  sudo docker compose logs backend | grep 'telegram'"
  echo
  echo "To rebuild and restart a specific service:"
  echo "  sudo docker compose up -d --build [service]"
  echo
  echo "To stop all services:"
  echo "  sudo docker compose down"
fi
echo

if [[ "$OSTYPE" == "darwin"* ]]; then
  print_warning "NOTE: This was a local test deployment. For actual production deployment, run this script on your Digital Ocean droplet."
fi

print_success "Vortexus has been successfully deployed!" 