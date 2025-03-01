# Deploying to Digital Ocean

This guide will walk you through deploying the Vortexus application to a Digital Ocean droplet using Docker.

## Prerequisites

- A Digital Ocean account
- A domain name (optional but recommended for production)
- Your OpenAI API key
- Your Telegram Bot token

## Step 1: Create a Digital Ocean Droplet

1. Log in to your Digital Ocean account
2. Click on "Create" > "Droplets"
3. Choose an image: Ubuntu 22.04 LTS
4. Choose a plan: Basic (Shared CPU)
   - We recommend at least 2GB RAM / 1 CPU
5. Choose a datacenter region close to your users
6. Add your SSH key or set up a password
7. Create the droplet

## Step 2: Connect to Your Droplet

```bash
ssh root@your-droplet-ip
```

## Step 3: Install Docker and Docker Compose

```bash
# Update the package lists
apt update

# Install required packages
apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update the package lists again
apt update

# Install Docker
apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
apt install -y docker-compose-plugin

# Verify installations
docker --version
docker compose version
```

## Step 4: Set Up the Application

1. Clone your repository:

```bash
git clone https://github.com/yourusername/vortexus.git
cd vortexus
```

2. Create and edit the `.env` file:

```bash
cp .env.production .env
nano .env
```

3. Fill in your secrets and configuration:

```
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
ASSISTANT_ID=your_assistant_id

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
SOLANA_URL=your_solana_url
ENCRYPTION_KEY=your_encryption_key
ENCRYPTION_ALGORITHM=aes-256-cbc

# API Configuration
AI_AGENT_API_URL=http://backend:3000/prompt

# Telegram Bot Configuration - Choose ONE option:
# Option 1: For domain with HTTPS (recommended)
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/bot${TELEGRAM_BOT_TOKEN}
# Option 2: For IP-only (less secure)
# TELEGRAM_WEBHOOK_URL=http://your.server.ip.address/bot${TELEGRAM_BOT_TOKEN}
# Option 3: For polling mode (easier but less efficient)
# TELEGRAM_WEBHOOK_URL=

# Frontend URL - Update with your domain or IP
FRONTEND_URL=https://yourdomain.com
# OR
# FRONTEND_URL=http://your.server.ip.address

# For frontend to find the API
PUBLIC_API_URL=https://yourdomain.com/prompt
# OR
# PUBLIC_API_URL=http://your.server.ip.address/prompt
```

## Step 5: Configure Nginx (if using a domain)

If you're using a domain, update the Nginx configuration:

```bash
# Replace example.com with your domain
sed -i 's/example.com/yourdomain.com/g' nginx/conf.d/default.conf
```

For initial deployment without a domain, use the no-SSL config:

```bash
mv nginx/conf.d/default-no-ssl.conf nginx/conf.d/default.conf
```

## Step 6: Start the Application

```bash
# Build and start all services
docker compose up -d
```

## Step 7: Set Up SSL with Let's Encrypt (if using a domain)

If you're using a domain and want HTTPS:

```bash
# Install certbot
apt install -y certbot

# Stop nginx temporarily
docker compose stop nginx

# Get certificates
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Update Nginx config with your domain
sed -i 's/example.com/yourdomain.com/g' nginx/conf.d/default.conf

# Start nginx again
docker compose start nginx
```

## Step 8: Verify the Telegram Bot

If using webhook mode:

```bash
# Check if webhook is set correctly
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo | jq
```

Expected output:
```json
{
  "ok": true,
  "result": {
    "url": "https://yourdomain.com/bot7639220859:AAF8eRqNv7Pb2xSTta5fVv5XBWPfobo-jY0",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40,
    "ip_address": "your.server.ip",
    "allowed_updates": ["message", "callback_query"]
  }
}
```

## Troubleshooting

### Webhook Issues

If your webhook is not working, check:

1. Is your domain properly set up with DNS pointing to your droplet?
2. Is SSL configured correctly?
3. Is the webhook URL formatted correctly? It should be `https://yourdomain.com/botYOUR_BOT_TOKEN`

To manually set or clear the webhook:

```bash
# Set webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://yourdomain.com/bot${TELEGRAM_BOT_TOKEN}"

# Or clear webhook to use polling instead
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

### Service Issues

To check logs:

```bash
# Check all logs
docker compose logs

# Check specific service logs
docker compose logs backend
docker compose logs nginx
```

### Access the PostgreSQL Database

```bash
docker compose exec postgres psql -U postgres -d arcturus
```

## Maintenance

### Updating the Application

```bash
# Pull the latest code
git pull

# Rebuild and restart the services
docker compose down
docker compose up -d --build
```

### Backing Up the Database

```bash
docker compose exec postgres pg_dump -U postgres arcturus > backup_$(date +%Y-%m-%d).sql
``` 