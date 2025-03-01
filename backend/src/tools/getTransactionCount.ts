import { Connection, PublicKey } from '@solana/web3.js';
import { ToolConfig } from './allTools.ts';

interface GetTransactionCountArgs {
  wallet: string;
}

export const getTransactionCountTool: ToolConfig<GetTransactionCountArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'get_transaction_count',
      description: 'Get the transaction count of a wallet on Solana',
      parameters: {
        type: 'object',
        properties: {
          wallet: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The wallet address to get the transaction count of',
          },
        },
        required: ['wallet'],
      },
    },
  },
  handler: async ({ wallet }) => await getTransactionCount(wallet),
};

async function getTransactionCount(wallet: string) {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const publicKey = new PublicKey(wallet);
  const transactionSignatures = await connection.getSignaturesForAddress(publicKey);
  return transactionSignatures.length;
}
