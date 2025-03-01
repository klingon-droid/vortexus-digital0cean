import OpenAI from 'openai';
import { Assistant } from 'openai/resources/beta/assistants';
import { tools } from '../tools/allTools.ts';
import { assistantPrompt } from '../const/prompt.ts';

export async function createAssistant(client: OpenAI): Promise<Assistant> {
  try {
    // Try to retrieve the existing assistant
    if (process.env.ASSISTANT_ID) {
      try {
        return await client.beta.assistants.retrieve(process.env.ASSISTANT_ID);
      } catch (error) {
        console.log('Error retrieving assistant, will create a new one:', error.message);
        // If assistant not found, continue to create a new one
      }
    }
    
    // Create a new assistant
    console.log('Creating a new assistant...');
    const assistant = await client.beta.assistants.create({
      model: 'gpt-4o-mini',
      name: 'Vortexus',
      instructions: assistantPrompt,
      tools: Object.values(tools).map((tool) => tool.definition),
    });
    
    console.log('New assistant created with ID:', assistant.id);
    console.log('IMPORTANT: Update your .env ASSISTANT_ID with:', assistant.id);
    
    return assistant;
  } catch (error) {
    console.error('Error in createAssistant:', error);
    throw error;
  }
}
