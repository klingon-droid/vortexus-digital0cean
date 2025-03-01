import OpenAI from 'openai';
import { Thread } from 'openai/resources/beta/threads/threads';

export async function getOrCreateThread(client: OpenAI, message?: string, threadId?: string): Promise<Thread> {
  if (threadId) {
    return await client.beta.threads.retrieve(threadId);
  }

  const thread = await client.beta.threads.create();

  if (message) {
    await client.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message,
    });
  }

  return thread;
}
