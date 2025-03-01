#!/usr/bin/env node

/**
 * This script fetches and displays all active ngrok tunnel URLs.
 * It uses ngrok's local API to get the information.
 */

const http = require('http');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

console.log(`\n${colors.bright}${colors.magenta}=== NGROK TUNNELS ===${colors.reset}\n`);

// Try both possible ngrok ports
const checkPort = (port) => {
  const options = {
    hostname: 'localhost',
    port: port,
    path: '/api/tunnels',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const tunnelsInfo = JSON.parse(data);
        
        if (!tunnelsInfo.tunnels || tunnelsInfo.tunnels.length === 0) {
          console.log(`${colors.yellow}No active tunnels found on port ${port}.${colors.reset}`);
          return;
        }
        
        console.log(`${colors.green}Found ${tunnelsInfo.tunnels.length} active tunnels on port ${port}:${colors.reset}\n`);
        
        tunnelsInfo.tunnels.forEach((tunnel) => {
          const localPort = tunnel.config.addr.split(':')[1];
          console.log(`${colors.bright}${colors.blue}Port ${localPort}:${colors.reset} ${tunnel.public_url}`);
          
          // Identify if it's API or Telegram based on the port
          if (localPort === '3000') {
            console.log(`${colors.yellow}   → This is your API URL (add to AI_AGENT_API_URL in .env)${colors.reset}`);
          } else if (localPort === '4001') {
            console.log(`${colors.yellow}   → This is your Telegram Bot URL${colors.reset}`);
          }
          console.log();
        });
        
        console.log(`${colors.bright}${colors.green}Add these URLs to your .env file as needed.${colors.reset}\n`);
        
      } catch (error) {
        console.error(`${colors.yellow}Error parsing ngrok API response from port ${port}: ${error.message}${colors.reset}`);
      }
    });
  });

  req.on('error', (error) => {
    // Don't output anything if connection refused - will try next port
    if (error.code !== 'ECONNREFUSED') {
      console.error(`${colors.yellow}Error connecting to ngrok API on port ${port}: ${error.message}${colors.reset}`);
    }
  });

  req.end();
};

// Try multiple ports where ngrok might have its API
checkPort(4040);
checkPort(4041);

console.log(`${colors.yellow}Checking for ngrok on ports 4040 and 4041...${colors.reset}`);
console.log(`${colors.yellow}If you see no results, make sure ngrok is running.${colors.reset}\n`); 