/**
 * Abstraction LLM — Interface commune pour tous les providers.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  call(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number; responseFormat?: 'json' }): Promise<LLMResponse>;
}
