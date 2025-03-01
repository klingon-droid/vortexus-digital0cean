import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createCollection, ruleSet } from '@metaplex-foundation/mpl-core';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import { ToolConfig } from './allTools.ts';

interface DeployCollectionArgs {
  walletAddress: string;
  name: string;
  uri: string;
  royaltyPercent?: number;
  creators?: { address: string; percentage: number }[];
}

export const deployCollectionTool: ToolConfig<DeployCollectionArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'deploy_collection',
      description: 'Return transaction data for deploying a new NFT collection on Solana blockchain via Metaplex',
      parameters: {
        type: 'object',
        properties: {
          walletAddress: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{44}$',
            description: 'The wallet address to deploy the collection from',
          },
          name: {
            type: 'string',
            description: 'The name of the NFT collection',
          },
          uri: {
            type: 'string',
            description: 'The URI of the NFT collection metadata',
          },
          royaltyPercent: {
            type: 'number',
            description: 'The royalty % for the collection (default 5%)',
          },
          creators: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9]{44}$',
                  description: "The creator's wallet address",
                },
                percentage: {
                  type: 'number',
                  description: 'The percentage of royalties for the creator',
                },
              },
              required: ['address', 'percentage'],
            },
            description: 'List of creators with their royalty percentages. Defaults to the creator wallet with 100%',
          },
        },
        required: ['walletAddress', 'name', 'uri'],
      },
    },
  },
  handler: async ({ walletAddress, name, uri, royaltyPercent, creators }) => {
    try {
      // Initialize Metaplex Umi
      const umi = createUmi('https://api.devnet.solana.com').use(mplTokenMetadata());

      // Format creators if provided
      const formattedCreators = creators?.map((creator) => ({
        address: publicKey(creator.address),
        percentage: creator.percentage,
      })) || [{ address: publicKey(walletAddress), percentage: 100 }];

      // Create collection
      const tx = await createCollection(umi, {
        collection: generateSigner(umi),
        name,
        uri,
        plugins: [
          {
            type: 'Royalties',
            basisPoints: (royaltyPercent || 5) * 100, // Default 5%
            creators: formattedCreators,
            ruleSet: ruleSet('None'), // Compatibility rule set
          },
        ],
      }).sendAndConfirm(umi);

      const res = {
        success: true,
        collectionAddress: toWeb3JsPublicKey(generateSigner(umi).publicKey),
        signature: tx.signature,
      };
      console.log(res);
      return JSON.stringify(res);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        status: 'error',
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
      });
    }
  },
};
