# Vortexus - Solana Telegram Bot

A cryptocurrency bot for Telegram that allows users to create and manage Solana wallets directly from Telegram.

## Project Structure

- `backend/` - Node.js backend API and Telegram bot
- `frontend/` (if exists) - Web interface

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Telegram Bot token (from BotFather)
- OpenAI API key
- Solana RPC URL

### Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values
3. Install dependencies:
   ```
   cd backend
   npm install
   ```
4. Start the development server:
   ```
   npm run dev
   ```

This will start both the API server and the Telegram bot with ngrok tunnels for development.

## Production Deployment with Docker on DigitalOcean

### Prerequisites

- A DigitalOcean Droplet (recommended: 2GB RAM minimum)
- Docker and Docker Compose installed
- A domain name (optional but recommended)

### Deployment Steps

1. Set up your DigitalOcean Droplet
   - Create a new Droplet with Ubuntu
   - Recommended size: 2GB RAM / 1 CPU minimum
   - Enable SSH access

2. Install Docker and Docker Compose
   ```bash
   apt update
   apt install -y docker.io docker-compose
   systemctl enable docker
   systemctl start docker
   ```

3. Clone your repository
   ```bash
   git clone https://github.com/yourusername/vortexus.git
   cd vortexus
   ```

4. Create `.env` file with production settings
   ```bash
   cp .env.production .env
   # Edit the .env file with your credentials
   nano .env
   ```

5. Build and start the application
   ```bash
   docker-compose up -d
   ```

6. Configure Telegram Webhook (if using webhook mode)
   - If you have a domain, configure SSL with Let's Encrypt:
     ```bash
     apt install -y certbot
     certbot certonly --standalone -d yourdomain.com
     ```
   - Update your `.env` file with:
     ```
     TELEGRAM_WEBHOOK_URL=https://yourdomain.com/bot${TELEGRAM_BOT_TOKEN}
     ```
   - Restart the services:
     ```bash
     docker-compose down
     docker-compose up -d
     ```

7. Monitor your application
   ```bash
   docker-compose logs -f
   ```

## Telegram Bot Configuration

### Polling vs Webhook

The bot can run in two modes:

1. **Polling mode** (default for development)
   - The bot periodically checks for updates from Telegram
   - Easier for development and behind firewalls
   - Set `TELEGRAM_WEBHOOK_URL=` to use polling mode

2. **Webhook mode** (recommended for production)
   - Telegram sends updates directly to your server
   - More efficient and responsive
   - Requires a public HTTPS URL
   - Set `TELEGRAM_WEBHOOK_URL=https://yourdomain.com/bot${TELEGRAM_BOT_TOKEN}`

## Troubleshooting

### 409 Conflict Error

If you see a 409 Conflict error when starting the bot, it means the bot is trying to use both polling and webhook simultaneously. Choose one method by:

1. For polling mode:
   - Clear any existing webhook by visiting: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`
   - Make sure `TELEGRAM_WEBHOOK_URL` is blank in your .env file

2. For webhook mode:
   - Ensure your domain is properly configured with SSL
   - Set `TELEGRAM_WEBHOOK_URL` correctly
   - Restart the application

### Port Conflicts

The application uses two main ports:
- 3000 for the API
- 4001 for the Telegram bot

If you see port conflicts, check if these ports are already in use on your system and update the port numbers in your .env file if needed.
