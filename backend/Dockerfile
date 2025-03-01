FROM node:20-alpine

WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build TypeScript code
RUN npm run build

# Expose the ports your application uses
EXPOSE 3000
EXPOSE 4001

# Start the application
CMD ["npm", "start"]