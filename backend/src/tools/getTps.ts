import { Connection } from '@solana/web3.js';
import { ToolConfig } from './allTools.ts';

interface GetTpsArgs {}

export const getTpsTool: ToolConfig<GetTpsArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'get_tps',
      description: 'Get the current transactions per second (TPS) on Solana',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  handler: async () => await getTps(),
};

async function getTps() {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const perfSamples = await connection.getRecentPerformanceSamples();

  if (!perfSamples.length || !perfSamples[0]?.numTransactions || !perfSamples[0]?.samplePeriodSecs) {
    return 'No performance samples available';
  }

  return perfSamples[0].numTransactions / perfSamples[0].samplePeriodSecs;
}
