import OpenAI from 'openai';
import { Thread } from 'openai/resources/beta/threads/threads';
import { Run } from 'openai/resources/beta/threads/runs/runs';
import { handleRunToolCalls } from './handleRunToolCalls.ts';
import { TextContentBlock } from 'openai/resources/beta/threads/messages';

export async function performRun(
  run: Run,
  client: OpenAI,
  thread: Thread,
): Promise<{ response: string; output: string }> {
  let output = '';

  while (run.status === 'requires_action') {
    const { run: updatedRun, output: toolOutput } = await handleRunToolCalls(run, client, thread);
    run = updatedRun;
    output = toolOutput;
  }

  if (run.status === 'failed') {
    const errorMessage = `I encountered an error: ${run.last_error?.message || 'Unknown error'}`;
    console.error('Run failed:', run.last_error);
    await client.beta.threads.messages.create(thread.id, {
      role: 'assistant',
      content: errorMessage,
    });
    return {
      response: errorMessage,
      output,
    };
  }

  const messages = await client.beta.threads.messages.list(thread.id);
  const assistantMessage = messages.data.find((message) => message.role === 'assistant');

  const textContent = assistantMessage?.content[0] as TextContentBlock;

  return {
    response: textContent?.text?.value || 'No response from assistant',
    output,
  };
}
