import { Connection, PublicKey } from '@solana/web3.js';
import { ToolConfig } from './allTools.ts';

interface GetSPLBalanceArgs {
  tokenMintAddress: string;
  walletAddress: string;
}

export const getSPLBalanceTool: ToolConfig<GetSPLBalanceArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'get_spl_balance',
      description: 'Get the SPL token balance of a wallet address on Solana',
      parameters: {
        type: 'object',
        properties: {
          tokenMintAddress: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The SPL token mint address',
          },
          walletAddress: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The wallet address to check the balance of',
          },
        },
        required: ['tokenMintAddress', 'walletAddress'],
      },
    },
  },
  handler: async ({ tokenMintAddress, walletAddress }) => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(walletAddress), {
      mint: new PublicKey(tokenMintAddress),
    });

    return tokenAccounts.value.reduce((acc, accountInfo) => {
      const amount = accountInfo.account.data.parsed.info.tokenAmount.uiAmount;
      return acc + amount;
    }, 0);
  },
};
