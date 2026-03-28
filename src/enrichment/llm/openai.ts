/**
 * Provider OpenAI — GPT-4o-mini par défaut (low-cost).
 */
import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMResponse } from './provider';

export function createOpenAIProvider(options?: {
  apiKey?: string;
  model?: string;
}): LLMProvider {
  const model = options?.model ?? 'gpt-4o-mini';
  const client = new OpenAI({
    apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY,
  });

  return {
    name: 'openai',
    async call(messages: LLMMessage[], opts): Promise<LLMResponse> {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: opts?.temperature ?? 0.2,
        max_tokens: opts?.maxTokens ?? 2000,
        ...(opts?.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      });

      const choice = response.choices[0];
      return {
        content: choice.message.content ?? '',
        model,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    },
  };
}
