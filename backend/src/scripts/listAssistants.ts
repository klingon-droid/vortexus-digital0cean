import OpenAI from 'openai';
import 'dotenv/config';

async function listAssistants() {
  const client = new OpenAI();
  
  try {
    console.log('Listing all assistants...');
    const assistants = await client.beta.assistants.list();
    
    console.log('Found', assistants.data.length, 'assistants:');
    for (const assistant of assistants.data) {
      console.log('ID:', assistant.id);
      console.log('Name:', assistant.name);
      console.log('Created at:', new Date(assistant.created_at * 1000).toLocaleString());
      console.log('---');
    }
  } catch (error) {
    console.error('Error listing assistants:', error);
  }
}

listAssistants(); 