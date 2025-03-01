import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import { Keypair, Transaction, VersionedTransaction, Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import express from 'express';

// Add debugging log at the top of the file
console.log('telegramBot.ts: Starting initialization');

// Add process ID for tracking purposes
console.log(`telegramBot.ts: Process ID: ${process.pid}`);

// Check if ports are already in use with OS specific command
const { execSync } = require('child_process');
try {
  const portCheckCommand = process.platform === 'win32' 
    ? `netstat -ano | findstr :4000`
    : `lsof -i :4000`;
  
  console.log('telegramBot.ts: Checking if port 4000 is already in use');
  const portCheck = execSync(portCheckCommand).toString();
  console.log(`telegramBot.ts: Port check result: ${portCheck}`);
} catch (error) {
  console.log('telegramBot.ts: Port appears to be available (or command failed)');
}

dotenv.config();

interface UserState {
  awaitingPasswordSet?: boolean;
  awaitingPasswordUnlock?: boolean;
  awaitingTransferRecipient?: boolean;
  awaitingTransferAmount?: boolean;
  transferDetails?: {
    recipient?: string;
    amount?: number;
  };
  pendingTransaction?: {
    data: string; 
    messageId: number;
    details?: any;
  };
  lastMessageId?: number;
}

interface ThreadContext {
  hasAcknowledgedWallet: boolean;
  lastResponse?: string;
}

const threadContexts: {
  [threadId: string]: ThreadContext;
} = {};

const userStates: {
  [chatId: number]: UserState;
} = {};

const app = express();
console.log('telegramBot.ts: Created Express app instance');
app.use(express.json());

// Determine whether to use webhook or polling based on environment
const useWebhook = process.env.TELEGRAM_WEBHOOK_URL && process.env.TELEGRAM_WEBHOOK_URL.trim() !== '';
console.log(`telegramBot.ts: Using ${useWebhook ? 'webhook' : 'polling'} mode`);

// Create the bot with either webhook or polling configuration
let bot;
if (useWebhook) {
  console.log(`telegramBot.ts: Configuring webhook mode with URL: ${process.env.TELEGRAM_WEBHOOK_URL}`);
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: false
  });
  // Set webhook
  bot.setWebHook(process.env.TELEGRAM_WEBHOOK_URL)
    .then(() => console.log('Webhook set successfully'))
    .catch(error => console.error('Error setting webhook:', error));
  
  // Configure webhook endpoint
  app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  console.log('telegramBot.ts: Configuring polling mode');
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: {
      interval: 2000, // Poll every 2 seconds
      autoStart: true,
      params: {
        timeout: 10 // Higher timeout value
      }
    },
    request: {
      proxy: undefined, // Set to a proxy if needed in your environment
      agentOptions: {
        keepAlive: true,
        keepAliveMsecs: 10000,
        timeout: 60000 // Higher timeout for requests
      }
    }
  });
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const connection = new Connection(process.env.SOLANA_URL!);
const IV_LENGTH = 16;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const ENCRYPTION_ALGORITHM = process.env.ENCRYPTION_ALGORITHM;
const AI_AGENT_API_URL = process.env.AI_AGENT_API_URL!;

// Set up commands for Telegram UI hamburger menu
bot.setMyCommands([
  { command: 'start', description: 'Initialize a new Solana wallet' },
  { command: 'help', description: 'Display complete list of commands & information' },
  { command: 'lock', description: 'Lock your wallet or set a password' },
  { command: 'unlock', description: 'Unlock your wallet' },
  { command: 'checkaddress', description: 'View your wallet\'s public address' },
  { command: 'balance', description: 'Check your wallet balance' },
  { command: 'transfer', description: 'Send SOL to another wallet' }
]).catch(error => {
  console.error('Error setting bot commands:', error);
});

app.get('/', (req, res) => {
  res.status(200).send('Solana Bot Service is running');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    botMode: 'polling'
  });
});

// Use a different environment variable for Telegram bot server
// This is the key change that prevents port conflict
const TELEGRAM_PORT = process.env.TELEGRAM_PORT || process.env.BOT_PORT || 4000;
// Add debugging for port conflict
console.log(`telegramBot.ts: About to start server on port ${TELEGRAM_PORT}, environment TELEGRAM_PORT=${process.env.TELEGRAM_PORT}, PORT=${process.env.PORT}`);

// Add debugging to check if this is really where the conflict occurs
console.log(`telegramBot.ts: Creating server with Express app.listen() on port ${TELEGRAM_PORT}`);

// Use a try-catch to better log any errors that occur at server creation time
try {
  const server = app.listen(TELEGRAM_PORT, async () => {
    console.log(`telegramBot.ts: Server is running on port ${TELEGRAM_PORT}`);
    console.log('Bot is running in polling mode');
  });
  
  server.on('error', (error) => {
    console.error(`telegramBot.ts: Server error on port ${TELEGRAM_PORT}:`, error);
    if ((error as any).code === 'EADDRINUSE') {
      console.error(`telegramBot.ts: Port ${TELEGRAM_PORT} is already in use. This could be another instance of the app or ngrok.`);
    }
  });
} catch (error) {
  console.error(`telegramBot.ts: Failed to create server on port ${TELEGRAM_PORT}:`, error);
}

app.on('error', (error) => {
  console.error('Express server error:', error);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

interface AiAgentResponse {
  response: string;
  output?: {
    success?: boolean;
    transaction?: string;
  };
  threadId?: string;
}

async function sendMessageToAI(
  message: string,
  threadId: string | null,
  publicKey: string | null
): Promise<AiAgentResponse> {
  try {
    const requestBody = {
      message,
      threadId,
      ...((!threadId) && { walletAddress: publicKey })
    };
    const response = await fetch(AI_AGENT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json() as AiAgentResponse;
  } catch (error) {
    console.error('Error in sendMessageToAI:', error);
    throw error;
  }
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(text: string): string {
  const [iv, encryptedText] = text.split(':');
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex'),
  );
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, 'hex')), decipher.final()]);
  return decrypted.toString();
}

async function isWalletLocked(chatId: number): Promise<boolean> {
  try {
    const result = await db.query('SELECT is_locked FROM user_wallets WHERE telegram_id = $1', [chatId]);
    return result.rows[0]?.is_locked === true;
  } catch (error) {
    console.error('Error checking wallet lock status:', error);
    return true;
  }
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const result = await db.query('SELECT public_key FROM user_wallets WHERE telegram_id = $1', [chatId]);
    if (result.rows.length > 0) {
      bot.sendMessage(chatId, 'You already have a wallet initialized.');
      return;
    }

    const wallet = Keypair.generate();
    const publicKey = wallet.publicKey.toBase58();
    const privateKey = encrypt(Buffer.from(wallet.secretKey).toString('base64'));

    await db.query(
      `INSERT INTO user_wallets (telegram_id, public_key, private_key, is_locked) VALUES ($1, $2, $3, $4)`,
      [chatId, publicKey, privateKey, false],
    );

    bot.sendMessage(
      chatId,
      `Welcome! A dedicated wallet has been created for you.\n\n` +
        `Your wallet address:\n\n\`${publicKey}\`\n\n` +
        '⚡️ Tap the address above to copy it\n' +
        '⚠️ Always verify the address after copying',
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.error('Error during /start:', error instanceof Error ? error.message : 'Unknown error');
    bot.sendMessage(chatId, 'An error occurred while creating your wallet. Please try again.');
  }
});

bot.onText(/\/checkaddress/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const result = await db.query('SELECT public_key FROM user_wallets WHERE telegram_id = $1', [chatId]);
    const publicKey = result.rows[0]?.public_key;

    if (!publicKey) {
      bot.sendMessage(chatId, 'You do not have a wallet. Use /start to initialize one.');
      return;
    }

    bot.sendMessage(
      chatId,
      `Your wallet address:\n\n\`${publicKey}\`\n\n` +
        '⚡️ Tap the address above to copy it\n' +
        '⚠️ Always verify the address after copying',
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.error('Error during /checkaddress:', error);
    bot.sendMessage(chatId, 'An error occurred while retrieving your address. Please try again.');
  }
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
*Wallet Bot Commands:*

*Wallet Management:*
• /start - Initialize a new Solana wallet
• /lock - Lock your wallet or set a password
• /unlock - Unlock your wallet
• /checkaddress - View your wallet's public address

*Wallet Operations:*
• /balance - Check your wallet balance
• /transfer - Send SOL to another wallet

*Security Features:*
- Set a password to protect your wallet
- Wallet can be locked/unlocked
- Passwords cannot be recovered
- Sensitive messages are automatically deleted
- Each user has a unique, secure Solana wallet

*How to Use:*
1. Start by initializing your wallet with /start
2. Set a password using /lock
3. Use /balance to check funds
4. Use /transfer to send SOL
5. Always keep your password secure!
6. Chat and sign transactions with the AI-agent

*Important Notes:*
- Locked wallets cannot perform transactions
- Your private key is securely encrypted
- Choose a strong, memorable password
- Passwords cannot be recovered!
`;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/lock/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const result = await db.query('SELECT password FROM user_wallets WHERE telegram_id = $1', [chatId]);

    if (!result.rows[0]?.password) {
      bot.sendMessage(
        chatId,
        'Please set a password for your wallet by sending your desired password in the next message. Passwords can not be recovered.',
      );
      userStates[chatId] = { awaitingPasswordSet: true };
    } else {
      await db.query('UPDATE user_wallets SET is_locked = $1 WHERE telegram_id = $2', [true, chatId]);
      bot.sendMessage(chatId, 'Your wallet has been locked.');
    }
  } catch (error) {
    console.error('Error during /lock:', error);
    bot.sendMessage(chatId, 'An error occurred while processing your request. Please try again.');
  }
});

bot.onText(/\/unlock/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const result = await db.query('SELECT password FROM user_wallets WHERE telegram_id = $1', [chatId]);

    if (!result.rows[0]?.password) {
      bot.sendMessage(chatId, 'You have not set a password yet. Use /lock to set a password first.');
    } else {
      bot.sendMessage(chatId, 'Please enter your wallet password.');
      userStates[chatId] = { awaitingPasswordUnlock: true };
    }
  } catch (error) {
    console.error('Error during /unlock:', error);
    bot.sendMessage(chatId, 'An error occurred while processing your request. Please try again.');
  }
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;

  if (await isWalletLocked(chatId)) {
    bot.sendMessage(chatId, 'Wallet is locked. Please /unlock to use this command.');
    return;
  }

  try {
    const result = await db.query('SELECT public_key FROM user_wallets WHERE telegram_id = $1', [chatId]);
    const publicKey = result.rows[0]?.public_key;

    if (!publicKey) {
      bot.sendMessage(chatId, 'You do not have a wallet. Use /start to initialize one.');
      return;
    }

    const balance = await connection.getBalance(new PublicKey(publicKey));
    bot.sendMessage(chatId, `Your wallet balance is: ${(balance / 1e9).toFixed(2)} SOL`);
  } catch (error) {
    console.error('Error during /balance:', error);
    bot.sendMessage(chatId, 'An error occurred while fetching your balance. Please try again.');
  }
});

bot.onText(/\/transfer/, async (msg) => {
  const chatId = msg.chat.id;

  if (await isWalletLocked(chatId)) {
    bot.sendMessage(chatId, 'Wallet is locked. Please /unlock to use this command.');
    return;
  }

  bot.sendMessage(chatId, 'Please provide the recipient wallet address.');
  userStates[chatId] = { awaitingTransferRecipient: true };
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const messageId = msg.message_id;

  if (!text || text.startsWith('/')) return;

  const state = userStates[chatId];;

  if (state) {
    if (state.awaitingTransferRecipient) {
      try {
        if (!PublicKey.isOnCurve(text)) {
          bot.sendMessage(chatId, 'Invalid wallet address. Please provide a valid Solana wallet address.');
          return;
        }
        state.transferDetails = { recipient: text };
        userStates[chatId] = { awaitingTransferAmount: true, transferDetails: state.transferDetails };
        bot.sendMessage(chatId, 'Please enter the amount to transfer (in SOL).');
      } catch (error) {
        console.error('Error handling recipient address:', error);
        bot.sendMessage(chatId, 'An error occurred. Please try again.');
        delete userStates[chatId];
      }
      return;
    }

    if (state.awaitingTransferAmount) {
      try {
        const amount = parseFloat(text);

        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(chatId, 'Invalid amount. Please enter a valid number greater than 0.');
          return;
        }

        const result = await db.query('SELECT public_key, private_key FROM user_wallets WHERE telegram_id = $1', [
          chatId,
        ]);
        const privateKey = result.rows[0]?.private_key ? decrypt(result.rows[0].private_key) : null;
        const fromPublicKey = result.rows[0]?.public_key;

        if (!privateKey || !fromPublicKey) {
          bot.sendMessage(chatId, 'Wallet details not found.');
          delete userStates[chatId];
          return;
        }

        const wallet = Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'));
        const senderPublicKey = new PublicKey(fromPublicKey);
        const balance = (await connection.getBalance(senderPublicKey)) / 1e9;

        const estimatedFee = 0.000005;
        if (balance < amount + estimatedFee) {
          bot.sendMessage(
            chatId,
            `Insufficient balance. Your wallet has ${balance.toFixed(2)} SOL, but you need at least ${(
              amount + estimatedFee
            ).toFixed(2)} SOL.`,
          );
          delete userStates[chatId];
          return;
        }

        const recipientPublicKey = new PublicKey(state.transferDetails!.recipient!);
        const latestBlockhash = await connection.getLatestBlockhash();

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: recipientPublicKey,
            lamports: amount * 1_000_000_000,
          }),
        );

        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = wallet.publicKey;

        transaction.sign(wallet);

        const signature = await connection.sendRawTransaction(transaction.serialize());

        await connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });

        bot.sendMessage(
          chatId,
          `Transfer of ${amount} SOL successful! Transaction signature: [${signature}](https://solscan.io/tx/${signature})`,
          {
            parse_mode: 'Markdown',
          },
        );

        delete userStates[chatId];
      } catch (error) {
        console.error('Transfer error:', error);

        if (error.logs) {
          console.error('Transaction logs:', error.logs);
        }

        bot.sendMessage(chatId, 'An error occurred during the transfer. Please try again.');
        delete userStates[chatId];
      }
      return;
    }
  }

  const deleteSensitiveMessage = async () => {
    try {
      if (state?.lastMessageId) {
        await bot.deleteMessage(chatId, state.lastMessageId);
        delete state.lastMessageId;
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  if (state?.awaitingPasswordSet) {
    try {
      state.lastMessageId = messageId;

      const hashedPassword = await bcrypt.hash(text, 10);
      await db.query('UPDATE user_wallets SET password = $1, is_locked = $2 WHERE telegram_id = $3', [
        hashedPassword,
        true,
        chatId,
      ]);

      await deleteSensitiveMessage();

      bot.sendMessage(chatId, 'Password set successfully. Your wallet is now locked.');
      delete userStates[chatId];
    } catch (error) {
      console.error('Error setting password:', error);
      bot.sendMessage(chatId, 'An error occurred while setting your password. Please try again.');
      await deleteSensitiveMessage();
    }
    return;
  }

  if (state?.awaitingPasswordUnlock) {
    try {
      state.lastMessageId = messageId;

      const result = await db.query('SELECT password FROM user_wallets WHERE telegram_id = $1', [chatId]);
      const hashedPassword = result.rows[0]?.password;

      if (hashedPassword && (await bcrypt.compare(text, hashedPassword))) {
        await db.query('UPDATE user_wallets SET is_locked = $1 WHERE telegram_id = $2', [false, chatId]);

        await deleteSensitiveMessage();

        bot.sendMessage(chatId, 'Your wallet has been unlocked successfully.');
        delete userStates[chatId];
      } else {
        await deleteSensitiveMessage();

        bot.sendMessage(chatId, 'Incorrect password. Please try again.');
      }
    } catch (error) {
      console.error('Error unlocking wallet:', error);

      await deleteSensitiveMessage();

      bot.sendMessage(chatId, 'An error occurred while unlocking your wallet. Please try again.');
    }
    return;
  }

  try {
    if (await isWalletLocked(chatId)) {
      bot.sendMessage(chatId, 'Wallet is locked. /unlock to continue.');
      return;
    }

    const processingMessage = await bot.sendMessage(
      chatId, 
      '🤔 Processing your request...\n\n_VORTEXUS is analyzing your message..._', 
      { parse_mode: 'Markdown' }
    );

    const walletResult = await db.query(
      'SELECT thread_id, public_key FROM user_wallets WHERE telegram_id = $1',
      [chatId]
    );

    if (!walletResult.rows[0]) {
      await bot.deleteMessage(chatId, processingMessage.message_id);
      bot.sendMessage(chatId, 'No wallet found. Use /start to create one.');
      return;
    }

    const { thread_id, public_key } = walletResult.rows[0];

    const aiResponse = await sendMessageToAI(text, thread_id, public_key);

    await bot.deleteMessage(chatId, processingMessage.message_id);

    let transactionData = null;

    if (aiResponse.output) {
      try {
        const outputData = typeof aiResponse.output === 'string' 
          ? JSON.parse(aiResponse.output)
          : aiResponse.output;
        
        if (outputData.success && outputData.transaction) {
          transactionData = outputData.transaction;
        }
      } catch (parseError) {
        console.log('Structured output parsing failed:', parseError);
      }
    }

    if (!transactionData) {
      const transactionRegex = /Transaction Data: ([A-Za-z0-9+/=]+)/;
      const match = transactionRegex.exec(aiResponse.response);
      if (match) {
        transactionData = match[1];
      }
    }

    if (transactionData) {
      try {
        const serializedTx = Buffer.from(transactionData, 'base64');
        let txType = 'Transaction';
        let additionalInfo = '';

        try {
          const tx = VersionedTransaction.deserialize(serializedTx);
        } catch (parseError) {
          console.log('Transaction parsing error:', parseError);
        }

        const confirmationMsg = await bot.sendMessage(
          chatId,
          `🔄 *New ${txType} Request*\n\n` +
          `Network: Solana Mainnet\n` +
          `${additionalInfo}\n\n` +
          `⚠️ Please review before confirming.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Confirm Transaction', callback_data: 'confirm_transaction' }],
                [{ text: '❌ Cancel', callback_data: 'cancel_transaction' }]
              ]
            }
          }
        );

        userStates[chatId] = {
          ...userStates[chatId],
          pendingTransaction: {
            data: transactionData,
            messageId: confirmationMsg.message_id
          }
        };
      } catch (error) {
        console.error('Error preparing transaction:', error);
        bot.sendMessage(
          chatId,
          '❌ Error preparing transaction. Please try again.',
          { parse_mode: 'Markdown' }
        );
      }
    } else {
      await bot.sendMessage(chatId, aiResponse.response, { parse_mode: 'Markdown' });
    }

  } catch (error) {
    console.error('Error handling message:', error);
    bot.sendMessage(
      chatId,
      '❌ An error occurred. Please try again later.',
      { parse_mode: 'Markdown' }
    );
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId || !callbackQuery.message) return;

  const action = callbackQuery.data;
  const state = userStates[chatId];

  if (state?.pendingTransaction && (action === 'confirm_transaction' || action === 'cancel_transaction')) {
    try {
      await bot.deleteMessage(chatId, state.pendingTransaction.messageId);

      if (action === 'cancel_transaction') {
        await bot.sendMessage(
          chatId,
          '❌ Transaction cancelled.\n_Your wallet remains unchanged._',
          { parse_mode: 'Markdown' }
        );
        const { pendingTransaction, ...remainingState } = userStates[chatId];
        userStates[chatId] = remainingState;
        return;
      }

      const processingMsg = await bot.sendMessage(
        chatId,
        '🔄 *Processing Transaction*\n\n' +
        '_Please wait while we complete your transaction..._\n\n' +
        '⚡️ Submitting to Solana network...',
        { parse_mode: 'Markdown' }
      );

      try {
        const walletResult = await db.query(
          'SELECT private_key FROM user_wallets WHERE telegram_id = $1',
          [chatId]
        );
        const privateKey = decrypt(walletResult.rows[0].private_key);
        const wallet = Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'));

        const serializedTx = Buffer.from(state.pendingTransaction.data, 'base64');
        let transaction;
        let isVersioned = true;

        try {
          transaction = VersionedTransaction.deserialize(serializedTx);
        } catch (e) {
          isVersioned = false;
          transaction = Transaction.from(serializedTx);
        }

        const latestBlockhash = await connection.getLatestBlockhash();

        if (isVersioned) {
          if (!transaction.message.recentBlockhash) {
            transaction.message.recentBlockhash = latestBlockhash.blockhash;
          }
          transaction.sign([wallet]);
        } else {
          transaction.recentBlockhash = latestBlockhash.blockhash;
          transaction.feePayer = wallet.publicKey;
          transaction.sign(wallet);
        }

        const signature = await connection.sendRawTransaction(
          isVersioned ? transaction.serialize() : transaction.serialize()
        );

        await connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });

        await bot.deleteMessage(chatId, processingMsg.message_id);
        await bot.sendMessage(
          chatId,
          '✅ *Transaction Successful!*\n\n' +
          `View on Solscan: [View Transaction](https://solscan.io/tx/${signature})\n\n` +
          '_Your wallet has been updated._',
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        );

      } catch (txError) {
        console.error('Transaction error:', txError);
    
        let errorMessage = '❌ *Transaction Failed*\n\n';
        
        if (txError instanceof Error) {
          if (txError.message.includes('insufficient funds')) {
            errorMessage += 'Your wallet has insufficient funds to complete this transaction.\n\n' +
                          'Please check your balance and try again.';
          } else if (txError.message.includes('blockhash')) {
            errorMessage += 'The transaction timed out.\n\n' +
                          'Please try submitting your transaction again.';
          } else {
            errorMessage += `There was an error processing your transaction:\n${txError.message}`;
          }
        } else {
          errorMessage += 'An unexpected error occurred.\n\n' +
                         'Please try your transaction again.';
        }

        await bot.deleteMessage(chatId, processingMsg.message_id);
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      }

      const { pendingTransaction, ...remainingState } = userStates[chatId];
      userStates[chatId] = remainingState;

    } catch (error) {
      console.error('Error handling callback:', error);
      bot.sendMessage(
        chatId,
        '❌ *Error*\n\nAn error occurred while processing your request.\n\nPlease try again.',
        { parse_mode: 'Markdown' }
      );
    }
  }
});