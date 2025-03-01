import { ToolConfig } from './allTools.ts';
import { Keypair } from '@solana/web3.js';

interface CreateTokenArgs {
  tokenName: string;
  tokenTicker: string;
  description: string;
  imageUrl: string;
  initialLiquiditySOL?: number;
  slippage?: number;
  priorityFee?: number;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export const createTokenTool: ToolConfig<CreateTokenArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'create_token',
      description:
        'Creates a launch transaction for a new token on Pump.fun with specified metadata and options. Replies with the transaction data, token mint and metadata uri',
      parameters: {
        type: 'object',
        properties: {
          tokenName: {
            type: 'string',
            description: 'Name of the token',
          },
          tokenTicker: {
            type: 'string',
            description: 'Ticker symbol of the token',
          },
          description: {
            type: 'string',
            description: 'Description of the token',
          },
          imageUrl: {
            type: 'string',
            description: 'URL of the token image',
          },
          initialLiquiditySOL: {
            type: 'number',
            description: 'Initial liquidity in SOL (default: 0.0001)',
          },
          slippage: {
            type: 'number',
            description: 'Slippage in basis points (default: 5)',
          },
          priorityFee: {
            type: 'number',
            description: 'Priority fee in SOL (default: 0.00005)',
          },
          twitter: {
            type: 'string',
            description: 'Twitter handle (optional)',
          },
          telegram: {
            type: 'string',
            description: 'Telegram handle (optional)',
          },
          website: {
            type: 'string',
            description: 'Website URL (optional)',
          },
        },
        required: ['tokenName', 'tokenTicker', 'description', 'imageUrl'],
      },
    },
  },
  handler: async ({
    tokenName,
    tokenTicker,
    description,
    imageUrl,
    initialLiquiditySOL = 0.0001,
    slippage = 5,
    priorityFee = 0.00005,
    twitter,
    telegram,
    website,
  }) => {
    try {
      // Generate mint keypair
      const mintKeypair = Keypair.generate();
      console.log('Mint public key:', mintKeypair.publicKey.toBase58());

      // Create metadata object
      const formData = new URLSearchParams();
      formData.append('name', tokenName);
      formData.append('symbol', tokenTicker);
      formData.append('description', description);
      formData.append('showName', 'true');

      if (twitter) formData.append('twitter', twitter);
      if (telegram) formData.append('telegram', telegram);
      if (website) formData.append('website', website);

      // Fetch and process image
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      const imageFile = new File([imageBlob], 'token_image.png', {
        type: 'image/png',
      });

      // Create final form data
      const finalFormData = new FormData();
      for (const [key, value] of formData.entries()) {
        finalFormData.append(key, value);
      }
      finalFormData.append('file', imageFile);

      // Upload metadata to IPFS
      const metadataResponse = await fetch('https://pump.fun/api/ipfs', {
        method: 'POST',
        body: finalFormData,
      });

      if (!metadataResponse.ok) {
        throw new Error(`Metadata upload failed: ${metadataResponse.statusText}`);
      }

      const metadataResult = await metadataResponse.json();

      // Create token transaction
      const payload = {
        publicKey: mintKeypair.publicKey.toBase58(),
        action: 'create',
        tokenMetadata: {
          name: metadataResult.metadata.name,
          symbol: metadataResult.metadata.symbol,
          uri: metadataResult.metadataUri,
        },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: 'true',
        amount: initialLiquiditySOL,
        slippage,
        priorityFee,
        pool: 'pump',
      };

      const txResponse = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!txResponse.ok) {
        const errorText = await txResponse.text();
        throw new Error(`Transaction creation failed: ${txResponse.status} - ${errorText}`);
      }

      const transaction = Buffer.from(await txResponse.arrayBuffer()).toString('base64');

      const res = {
        success: true,
        mint: mintKeypair.publicKey.toBase58(),
        metadataUri: metadataResult.metadataUri,
        transaction,
      };

      console.log(res);
      return JSON.stringify(res);
    } catch (error) {
      console.error('Error in create_token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
