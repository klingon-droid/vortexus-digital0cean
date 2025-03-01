import express from 'express';
import 'dotenv/config';
// Add debug log before importing telegramBot
console.log('Main index.ts: About to import telegramBot');
import './telegram/telegramBot';
console.log('Main index.ts: Successfully imported telegramBot');
import OpenAI from 'openai';
import helmet from 'helmet';
import cors from 'cors';
import { createAssistant } from './openai/createAssistant.ts';
import { getOrCreateThread } from './openai/createThread.ts';
import { createRun } from './openai/createRun.ts';
import { performRun } from './openai/performRun.ts';

const client = new OpenAI();

// Debugging: Log environment variables
console.log('Main index.ts: PORT environment variable:', process.env.PORT);

const app = express();
app.use(express.json());
app.use(helmet());

// Configure CORS with more explicit settings
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://vortexus.vercel.app',
    process.env.FRONTEND_URL, // Use environment variable
  ].filter(Boolean), // Filter out undefined values
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'User-Agent'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Special handling for OPTIONS requests (preflight)
app.options('*', cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://vortexus.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  optionsSuccessStatus: 204
}));

// Add a simple health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

app.post('/prompt', async (req, res) => {
  let { message, walletAddress, threadId } = req.body;
  if (typeof message !== 'string') {
    res.status(400).send({ error: 'Invalid message parameter' });
    return;
  }

  try {
    console.log('Received request to /prompt with message:', message);
    console.log('Using OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Key exists' : 'Key missing');
    console.log('Using ASSISTANT_ID:', process.env.ASSISTANT_ID);
    
    try {
      const assistant = await createAssistant(client);
      console.log('Assistant created/retrieved:', assistant.id);
      
      const thread = await getOrCreateThread(client, message, threadId);
      console.log('Thread created/retrieved:', thread.id);

      if (walletAddress) {
        message += `\nThe deployer/user wallet address is: ${walletAddress}`;
      }
      // Add the user's message to the thread
      await client.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: message,
      });
      console.log('Message added to thread');

      // Create and perform the run
      const run = await createRun(client, thread, assistant.id);
      console.log('Run created:', run.id);
      
      const result = await performRun(run, client, thread);
      console.log('Run completed successfully');

      res.status(200).send({ response: result.response, output: result.output, threadId: thread.id });
    } catch (innerError) {
      console.error('Error during OpenAI operations:', innerError instanceof Error ? innerError.stack : 'Unknown error');
      throw innerError; // Re-throw for outer catch
    }
  } catch (error) {
    console.error('Error during chat:', error instanceof Error ? error.stack : 'Unknown error');
    res.status(500).send({ error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Use API_PORT as a fallback before the generic PORT to be more explicit
const API_PORT = process.env.API_PORT || process.env.PORT || 3000;
// Add debug log for port listening
console.log(`Main index.ts: About to start server on port ${API_PORT}`);
app.listen(API_PORT, () => {
  console.log(`Main index.ts: Server is running on port ${API_PORT}`);
});
