import { getBalanceTool } from './getBalance.ts';
import { getTransactionReceiptTool } from './getTransactionReceipt.ts';
import { getSPLBalanceTool } from './getTokenBalance.ts';
import { getTransactionCountTool } from './getTransactionCount.ts';
import { buyTokensTool } from './buyTokens.ts';
import { createTokenTool } from './createToken.ts';
import { deployCollectionTool } from './deployCollection.ts';
import { getTpsTool } from './getTps.ts';
import { openMeteoraPositionTool } from './openMeteoraPosition.ts';

export interface ToolConfig<T = any> {
  definition: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  };
  handler: (args: T) => Promise<any>;
}

export const tools: Record<string, ToolConfig> = {
  // == READ == \\
  get_balance: getBalanceTool,
  // get_transaction_receipt: getTransactionReceiptTool,
  get_spl_balance: getSPLBalanceTool,
  get_transaction_count: getTransactionCountTool,
  get_tps: getTpsTool,
  // == WRITE == \\
  buy_tokens: buyTokensTool,
  create_token: createTokenTool,
  deploy_collection: deployCollectionTool,
  open_meteora_position: openMeteoraPositionTool,
};
