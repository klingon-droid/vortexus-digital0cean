import { TOKENS } from 'solana-agent-kit/dist/constants/index';
import { ToolConfig } from './allTools.ts';
import { createJupiterApiClient } from '@jup-ag/api';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface BuyTokensArgs {
  outputMint: string;
  inputAmount: number;
  userWallet: string;
}

export const buyTokensTool: ToolConfig<BuyTokensArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'buy_tokens',
      description: 'Obtain a raw unsigned transaction to buy a token with SOL using Jupiter Exchange',
      parameters: {
        type: 'object',
        properties: {
          outputMint: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The mint address of the output token',
          },
          inputAmount: {
            type: 'number',
            description: 'The amount of SOL to spend',
          },
          userWallet: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The wallet address to perform the trade from',
          },
        },
        required: ['outputMint', 'inputAmount', 'userWallet'],
      },
    },
  },
  handler: async ({ outputMint, inputAmount, userWallet }) => {
    const jupiterQuoteApi = createJupiterApiClient();

    try {
      const quoteResponse = await jupiterQuoteApi.quoteGet({
        inputMint: TOKENS.SOL.toBase58(),
        outputMint,
        amount: inputAmount * LAMPORTS_PER_SOL,
        slippageBps: 2 * 100,
        onlyDirectRoutes: true,
        asLegacyTransaction: false,
        maxAccounts: 20,
      });

      const { swapTransaction } = await jupiterQuoteApi.swapPost({
        swapRequest: {
          quoteResponse,
          userPublicKey: userWallet.toString(),
          prioritizationFeeLamports: 'auto',
        },
      });

      return JSON.stringify({ success: true, transaction: swapTransaction });
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
      };
    }
  },
};
