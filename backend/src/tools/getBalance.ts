import { Connection, PublicKey } from '@solana/web3.js';
import { ToolConfig } from './allTools.ts';

interface GetBalanceArgs {
  wallet: string;
}

export const getBalanceTool: ToolConfig<GetBalanceArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'get_balance',
      description: 'Get the SOL balance of a wallet on Solana',
      parameters: {
        type: 'object',
        properties: {
          wallet: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The wallet address to get the SOL balance of',
          },
        },
        required: ['wallet'],
      },
    },
  },
  handler: async ({ wallet }) => await getBalance(wallet),
};

async function getBalance(wallet: string) {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const publicKey = new PublicKey(wallet);
  const balance = await connection.getBalance(publicKey);
  return balance / 1e9; // Convert lamports to SOL
}
