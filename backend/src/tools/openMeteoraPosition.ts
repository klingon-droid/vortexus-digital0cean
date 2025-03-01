import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { MeteoraPairData } from 'src/types/meteora-pair-data';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import axios from 'axios';
import { ToolConfig } from './allTools.ts';

const SOL = 'So11111111111111111111111111111111111111112';

interface OpenMeteoraPositionArgs {
  dlmmAddress: string;
  buyAmount: number;
  userWallet: string;
}

export const openMeteoraPositionTool: ToolConfig<OpenMeteoraPositionArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'open_meteora_position',
      description: 'Open a position on a DLMM pool using SOL',
      parameters: {
        type: 'object',
        properties: {
          dlmmAddress: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The DLMM pool address',
          },
          buyAmount: {
            type: 'number',
            description: 'The amount of SOL to use for the position',
          },
          userWallet: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The wallet address to perform the trade from',
          },
        },
        required: ['dlmmAddress', 'buyAmount', 'userWallet'],
      },
    },
  },
  handler: async ({ dlmmAddress, buyAmount, userWallet }) => {
    try {
      const pairData = await getPairData(dlmmAddress);
      if (!pairData) {
        throw new Error(`Failed to get pair data for ${dlmmAddress}`);
      }

      if (pairData.mint_y !== SOL && pairData.mint_x !== SOL) {
        throw new Error(`Pool is not trading against SOL`);
      }

      const dlmmPool = await DLMM.create(
        new Connection('https://api.mainnet-beta.solana.com', 'confirmed'),
        new PublicKey(pairData.address),
      );

      const activeBin = await dlmmPool.getActiveBin();
      if (!activeBin) {
        throw new Error('Failed to get active bin');
      }

      const maxBinId = activeBin.binId;
      const minBinId = maxBinId - 60;

      if (minBinId > maxBinId) {
        throw new Error('Invalid bin range: minBinId is greater than maxBinId');
      }

      const newPosition = new Keypair();

      const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newPosition.publicKey,
        user: new PublicKey(userWallet),
        totalXAmount: new BN(pairData.mint_x === SOL ? buyAmount * LAMPORTS_PER_SOL : 0),
        totalYAmount: new BN(pairData.mint_y === SOL ? buyAmount * LAMPORTS_PER_SOL : 0),
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.BidAskImBalanced,
        },
        slippage: 23,
      });

      return JSON.stringify({
        success: true,
        poolAddress: pairData.address,
        positionPublicKey: newPosition.publicKey.toBase58(),
        transaction: createPositionTx.serialize().toString('base64'),
      });
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
      };
    }
  },
};

/**
 * Fetches pair data for a given pair address.
 * @param pairAddress - The address of the pair.
 * @returns The data of the pair.
 */
async function getPairData(pairAddress: string): Promise<MeteoraPairData> {
  try {
    const req = await axios.get(`https://dlmm-api.meteora.ag/pair/${pairAddress}`);
    return req.data;
  } catch (error) {
    console.error('Error in fetching pair data: ', error);
  }
}