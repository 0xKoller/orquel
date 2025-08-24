import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';
import { mergeHybridResults, analyzeHybridOverlap } from '@orquel/core';

export const schema = z.object({
  query: z.string().describe('Search query for hybrid search'),
  k: z.number().int().min(1).max(50).default(10).describe('Number of results to return'),
  denseWeight: z.number().min(0).max(1).default(0.7).describe('Weight for dense (vector) search results'),
  lexicalWeight: z.number().min(0).max(1).default(0.3).describe('Weight for lexical search results'),
  normalizationMethod: z.enum(['rrf', 'minmax', 'zscore']).default('rrf').describe('Score normalization method'),
  showAnalytics: z.boolean().default(true).describe('Show detailed hybrid search analytics'),
  compareWeights: z.array(z.object({
    dense: z.number().min(0).max(1),
    lexical: z.number().min(0).max(1),
    name: z.string().optional(),
  })).optional().describe('Compare different weight configurations'),
});

export const metadata = {
  name: 'hybrid-search',
  description: 'Advanced hybrid search with configurable dense/lexical weights and detailed analytics',
  tags: ['search', 'hybrid', 'analytics', 'optimization'],
};

export default async function hybridSearch(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    
    // Validate weights sum to 1.0 (approximately)
    const totalWeight = params.denseWeight + params.lexicalWeight;
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️  Weight Configuration Error\n\n` +
                  `Dense weight (${params.denseWeight}) + Lexical weight (${params.lexicalWeight}) = ${totalWeight}\n` +
                  `Weights should sum to 1.0 for proper normalization.\n\n` +
                  `Try: { "denseWeight": 0.7, "lexicalWeight": 0.3 }`,
          },
        ],
        isError: true,
      };
    }

    // Check if lexical adapter is available
    const config = (orq as any).config;
    if (!config?.lexical) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Hybrid Search Not Available\n\n` +
                  `No lexical search adapter configured. Hybrid search requires both:\n` +
                  `• Vector store adapter (✅ available)\n` +
                  `• Lexical search adapter (❌ missing)\n\n` +
                  `Configure a lexical adapter like @orquel/lexical-postgres to enable hybrid search.\n` +
                  `Falling back to vector-only search...`,
          },
        ],
      };
    }

    let response = `# Hybrid Search Results\n\n`;
    response += `**Query:** "${params.query}"\n`;
    response += `**Configuration:**\n`;
    response += `• Dense weight: ${params.denseWeight}\n`;
    response += `• Lexical weight: ${params.lexicalWeight}\n`;
    response += `• Normalization: ${params.normalizationMethod}\n`;
    response += `• Results requested: ${params.k}\n\n`;

    // Perform hybrid search with custom weights
    const [queryEmbedding] = await config.embeddings.embed([params.query]);
    const denseResults = await config.vector.searchByVector(queryEmbedding, params.k);
    const lexicalResults = await config.lexical.search(params.query, params.k);

    // Analyze search overlap if analytics are enabled
    let overlapAnalysis = null;
    if (params.showAnalytics) {
      overlapAnalysis = analyzeHybridOverlap(denseResults, lexicalResults);
      
      response += `## Search Analytics\n\n`;
      response += `**Individual Results:**\n`;
      response += `• Dense (vector) results: ${denseResults.length}\n`;
      response += `• Lexical results: ${lexicalResults.length}\n\n`;
      
      response += `**Overlap Analysis:**\n`;
      response += `• Shared results: ${overlapAnalysis.overlapCount}\n`;
      response += `• Dense-only results: ${overlapAnalysis.denseOnlyCount}\n`;
      response += `• Lexical-only results: ${overlapAnalysis.lexicalOnlyCount}\n`;
      response += `• Complementary score: ${(overlapAnalysis.complementaryScore * 100).toFixed(1)}%\n\n`;
      
      // Interpretation of complementary score
      if (overlapAnalysis.complementaryScore > 0.7) {
        response += `💡 **High complementarity**: Dense and lexical search find very different results. Hybrid search provides significant value.\n\n`;
      } else if (overlapAnalysis.complementaryScore > 0.3) {
        response += `💡 **Moderate complementarity**: Some overlap between search methods. Hybrid search provides moderate benefit.\n\n`;
      } else {
        response += `💡 **Low complementarity**: High overlap between search methods. Vector search alone might be sufficient.\n\n`;
      }
    }

    // Merge results using specified configuration
    const hybridOptions = {
      denseWeight: params.denseWeight,
      lexicalWeight: params.lexicalWeight,
      normalizationMethod: params.normalizationMethod,
    };
    
    const mergedResults = mergeHybridResults(
      denseResults,
      lexicalResults,
      { ...hybridOptions, k: params.k }
    );

    // Display merged results
    response += `## Hybrid Results (${mergedResults.length})\n\n`;
    
    if (mergedResults.length === 0) {
      response += `No results found for query: "${params.query}"\n`;
    } else {
      mergedResults.forEach((result, index) => {
        const rank = index + 1;
        const chunk = result.chunk;
        
        response += `### ${rank}. ${chunk.source.title} (Score: ${result.score.toFixed(3)})\n`;
        response += `${chunk.text}\n\n`;
      });
    }

    // Compare different weight configurations if requested
    if (params.compareWeights && params.compareWeights.length > 0) {
      response += `## Weight Comparison\n\n`;
      
      for (const weightConfig of params.compareWeights) {
        const configName = weightConfig.name || `${weightConfig.dense}/${weightConfig.lexical}`;
        
        // Validate weights
        if (Math.abs((weightConfig.dense + weightConfig.lexical) - 1.0) > 0.001) {
          response += `⚠️  ${configName}: Weights don't sum to 1.0 (${weightConfig.dense + weightConfig.lexical})\n\n`;
          continue;
        }
        
        const compareResults = mergeHybridResults(
          denseResults,
          lexicalResults,
          {
            denseWeight: weightConfig.dense,
            lexicalWeight: weightConfig.lexical,
            normalizationMethod: params.normalizationMethod,
            k: Math.min(5, params.k), // Show top 5 for comparison
          }
        );
        
        response += `**${configName} (Dense: ${weightConfig.dense}, Lexical: ${weightConfig.lexical})**\n`;
        
        if (compareResults.length > 0) {
          compareResults.forEach((result, index) => {
            response += `${index + 1}. ${result.chunk.source.title} (${result.score.toFixed(3)})\n`;
          });
        } else {
          response += `No results\n`;
        }
        response += `\n`;
      }
    }

    // Optimization suggestions
    response += `## Optimization Suggestions\n\n`;
    
    if (overlapAnalysis) {
      if (overlapAnalysis.complementaryScore > 0.7) {
        response += `🎯 **High complementarity detected**: Consider balanced weights (0.5/0.5) to leverage both search methods equally.\n`;
      } else if (overlapAnalysis.complementaryScore < 0.2) {
        response += `🎯 **Low complementarity detected**: Consider vector-only search (1.0/0.0) for better performance.\n`;
      }
    }
    
    response += `💡 **General Tips:**\n`;
    response += `• Use higher dense weights (0.7-0.8) for semantic/conceptual queries\n`;
    response += `• Use higher lexical weights (0.6-0.7) for exact term/keyword matching\n`;
    response += `• RRF normalization works well for most use cases\n`;
    response += `• Use "optimize-search" tool for automated weight tuning\n`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error performing hybrid search: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}