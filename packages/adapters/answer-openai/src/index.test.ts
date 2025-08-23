import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openAIAnswerer } from './index.js';
import type { Chunk } from '@orquel/core';

// Mock the OpenAI client
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

// Mock the openai module
vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}));

describe('openAIAnswerer', () => {
  const sampleChunks: Chunk[] = [
    {
      id: 'chunk-1',
      text: 'Argentina is a country in South America.',
      metadata: {
        source: { title: 'Geography of Argentina', kind: 'md' },
        chunkIndex: 0,
        hash: 'hash-1',
      },
    },
    {
      id: 'chunk-2', 
      text: 'Buenos Aires is the capital city of Argentina.',
      metadata: {
        source: { title: 'Cities of Argentina', kind: 'md' },
        chunkIndex: 0,
        hash: 'hash-2',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Default successful response
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: 'Argentina is a South American country with Buenos Aires as its capital.',
        },
      }],
      usage: { total_tokens: 50 },
    });
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('adapter creation', () => {
    it('should create adapter with default configuration', () => {
      const adapter = openAIAnswerer();
      
      expect(adapter.name).toBe('openai-gpt-4');
      expect(typeof adapter.answer).toBe('function');
    });

    it('should create adapter with custom model', () => {
      const adapter = openAIAnswerer({
        model: 'gpt-3.5-turbo',
      });
      
      expect(adapter.name).toBe('openai-gpt-3.5-turbo');
    });

    it('should create adapter with custom API key', () => {
      const customKey = 'custom-api-key';
      const adapter = openAIAnswerer({
        apiKey: customKey,
      });
      
      expect(adapter.name).toBe('openai-gpt-4');
    });

    it('should throw error if no API key available', () => {
      delete process.env.OPENAI_API_KEY;
      
      expect(() => openAIAnswerer()).toThrow(
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey option.'
      );
    });
  });

  describe('answer generation', () => {
    it('should generate answer from contexts', async () => {
      const adapter = openAIAnswerer();
      
      const result = await adapter.answer({
        query: 'What is Argentina?',
        contexts: sampleChunks,
      });
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('You are a helpful assistant that answers questions based on the provided context'),
          },
          {
            role: 'user',
            content: expect.stringContaining('What is Argentina?'),
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        stream: false,
      });
      
      expect(result).toBe('Argentina is a South American country with Buenos Aires as its capital.');
    });

    it('should include all contexts in the prompt', async () => {
      const adapter = openAIAnswerer();
      
      await adapter.answer({
        query: 'Tell me about Argentina',
        contexts: sampleChunks,
      });
      
      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = call.messages.find((m: any) => m.role === 'user');
      
      expect(userMessage.content).toContain('Argentina is a country in South America.');
      expect(userMessage.content).toContain('Buenos Aires is the capital city of Argentina.');
      expect(userMessage.content).toContain('[1]');
      expect(userMessage.content).toContain('[2]');
    });

    it('should handle empty contexts gracefully', async () => {
      const adapter = openAIAnswerer();
      
      const result = await adapter.answer({
        query: 'What can you tell me?',
        contexts: [],
      });
      
      expect(result).toBe("I don't have enough context to answer your question.");
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should use custom model configuration', async () => {
      const adapter = openAIAnswerer({
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 500,
      });
      
      await adapter.answer({
        query: 'Test query',
        contexts: sampleChunks,
      });
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: expect.any(Array),
        temperature: 0.5,
        max_tokens: 500,
        stream: false,
      });
    });

    it('should use custom system prompt', async () => {
      const customPrompt = 'You are an expert on Argentina.';
      const adapter = openAIAnswerer({
        systemPrompt: customPrompt,
      });
      
      await adapter.answer({
        query: 'Tell me about Argentina',
        contexts: sampleChunks,
      });
      
      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemMessage = call.messages.find((m: any) => m.role === 'system');
      
      expect(systemMessage.content).toBe(customPrompt);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const adapter = openAIAnswerer();
      
      const apiError = new Error('OpenAI API Error: Rate limit exceeded');
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);
      
      await expect(
        adapter.answer({
          query: 'Test query',
          contexts: sampleChunks,
        })
      ).rejects.toThrow('Failed to generate answer: OpenAI API Error: Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      const adapter = openAIAnswerer();
      
      const networkError = new Error('Network timeout');
      mockOpenAI.chat.completions.create.mockRejectedValue(networkError);
      
      await expect(
        adapter.answer({
          query: 'Test query',
          contexts: sampleChunks,
        })
      ).rejects.toThrow('Failed to generate answer: Network timeout');
    });

    it('should handle malformed API responses', async () => {
      const adapter = openAIAnswerer();
      
      // Response without choices
      mockOpenAI.chat.completions.create.mockResolvedValue({
        usage: { total_tokens: 10 },
      });
      
      await expect(
        adapter.answer({
          query: 'Test query',
          contexts: sampleChunks,
        })
      ).rejects.toThrow('Failed to generate answer:');
    });

    it('should handle empty response content', async () => {
      const adapter = openAIAnswerer();
      
      // Response with empty content
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: '' },
        }],
        usage: { total_tokens: 10 },
      });
      
      await expect(
        adapter.answer({
          query: 'Test query',
          contexts: sampleChunks,
        })
      ).rejects.toThrow('Failed to generate answer: No answer generated');
    });

    it('should handle null response content', async () => {
      const adapter = openAIAnswerer();
      
      // Response with null content
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: null },
        }],
        usage: { total_tokens: 10 },
      });
      
      await expect(
        adapter.answer({
          query: 'Test query',
          contexts: sampleChunks,
        })
      ).rejects.toThrow('Failed to generate answer: No answer generated');
    });
  });

  describe('context handling', () => {
    it('should format context with numbered references', async () => {
      const adapter = openAIAnswerer();
      
      const multipleChunks: Chunk[] = [
        {
          id: 'chunk-1',
          text: 'First piece of information.',
          metadata: {
            source: { title: 'Doc 1' },
            chunkIndex: 0,
            hash: 'hash-1',
          },
        },
        {
          id: 'chunk-2',
          text: 'Second piece of information.',
          metadata: {
            source: { title: 'Doc 2' },
            chunkIndex: 0,
            hash: 'hash-2',
          },
        },
        {
          id: 'chunk-3',
          text: 'Third piece of information.',
          metadata: {
            source: { title: 'Doc 3' },
            chunkIndex: 0,
            hash: 'hash-3',
          },
        },
      ];
      
      await adapter.answer({
        query: 'Tell me about the information',
        contexts: multipleChunks,
      });
      
      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = call.messages.find((m: any) => m.role === 'user');
      
      expect(userMessage.content).toContain('[1] First piece of information.');
      expect(userMessage.content).toContain('[2] Second piece of information.');
      expect(userMessage.content).toContain('[3] Third piece of information.');
    });

    it('should handle long contexts appropriately', async () => {
      const adapter = openAIAnswerer();
      
      const longChunk: Chunk = {
        id: 'long-chunk',
        text: 'A'.repeat(5000), // Very long text
        metadata: {
          source: { title: 'Long Document' },
          chunkIndex: 0,
          hash: 'long-hash',
        },
      };
      
      await adapter.answer({
        query: 'Test query',
        contexts: [longChunk],
      });
      
      // Should have made the API call without errors
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should trim whitespace from chunk text', async () => {
      const adapter = openAIAnswerer();
      
      const chunkWithWhitespace: Chunk = {
        id: 'whitespace-chunk',
        text: '   Content with extra whitespace   \n\n',
        metadata: {
          source: { title: 'Whitespace Doc' },
          chunkIndex: 0,
          hash: 'whitespace-hash',
        },
      };
      
      await adapter.answer({
        query: 'Test query',
        contexts: [chunkWithWhitespace],
      });
      
      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = call.messages.find((m: any) => m.role === 'user');
      
      expect(userMessage.content).toContain('Content with extra whitespace');
      expect(userMessage.content).not.toMatch(/^\s+/);
      expect(userMessage.content).not.toMatch(/\s+$/);
    });
  });

  describe('prompt engineering', () => {
    it('should construct proper system prompt with instructions', async () => {
      const adapter = openAIAnswerer();
      
      await adapter.answer({
        query: 'Test query',
        contexts: sampleChunks,
      });
      
      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemMessage = call.messages.find((m: any) => m.role === 'system');
      
      expect(systemMessage.content).toContain('helpful assistant');
      expect(systemMessage.content).toContain('provided context');
      expect(systemMessage.content).toContain('guidelines');
    });

    it('should format user prompt with query and contexts', async () => {
      const adapter = openAIAnswerer();
      
      await adapter.answer({
        query: 'What is the capital of Argentina?',
        contexts: sampleChunks,
      });
      
      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = call.messages.find((m: any) => m.role === 'user');
      
      expect(userMessage.content).toContain('What is the capital of Argentina?');
      expect(userMessage.content).toContain('Context:');
      expect(userMessage.content).toContain('Question:');
      expect(userMessage.content).toContain('Answer:');
    });

    it('should handle special characters in query', async () => {
      const adapter = openAIAnswerer();
      
      const specialQuery = 'What about émojis 🇦🇷 and símbolos?';
      
      await adapter.answer({
        query: specialQuery,
        contexts: sampleChunks,
      });
      
      const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = call.messages.find((m: any) => m.role === 'user');
      
      expect(userMessage.content).toContain(specialQuery);
    });
  });

  describe('performance and reliability', () => {
    it('should handle concurrent requests', async () => {
      const adapter = openAIAnswerer();
      
      // Mock different responses for concurrent calls
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Answer 1' } }],
          usage: { total_tokens: 20 },
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Answer 2' } }],
          usage: { total_tokens: 25 },
        });
      
      const [result1, result2] = await Promise.all([
        adapter.answer({ query: 'Query 1', contexts: sampleChunks }),
        adapter.answer({ query: 'Query 2', contexts: sampleChunks }),
      ]);
      
      expect(result1).toBe('Answer 1');
      expect(result2).toBe('Answer 2');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should handle large context sets efficiently', async () => {
      const adapter = openAIAnswerer();
      
      const largeContexts = Array.from({ length: 50 }, (_, i) => ({
        id: `large-chunk-${i}`,
        text: `Large context piece ${i} with substantial content about the topic.`,
        metadata: {
          source: { title: `Large Document ${i}` },
          chunkIndex: i,
          hash: `large-hash-${i}`,
        },
      }));
      
      const result = await adapter.answer({
        query: 'Summarize everything',
        contexts: largeContexts,
      });
      
      expect(result).toBe('Argentina is a South American country with Buenos Aires as its capital.');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });
  });
});