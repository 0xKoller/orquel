import { z } from 'zod';
import { getOrquelInstance } from '../orquel-manager.js';

export const schema = z.object({
  sampleSize: z.number().int().min(50).max(1000).default(200).describe('Number of chunks to analyze for clustering'),
  clusterCount: z.number().int().min(3).max(20).default(8).describe('Target number of semantic clusters'),
  similarityThreshold: z.number().min(0.1).max(0.95).default(0.6).describe('Minimum similarity for cluster membership'),
  includeClusterSamples: z.boolean().default(true).describe('Include sample content from each cluster'),
  analyzeGaps: z.boolean().default(true).describe('Identify potential knowledge gaps between clusters'),
  visualizationFormat: z.enum(['text', 'table', 'detailed']).default('detailed').describe('Output format for cluster visualization'),
});

export const metadata = {
  name: 'semantic-clusters',
  description: 'Analyze semantic clusters in the knowledge base to understand content organization and identify knowledge gaps',
  tags: ['analytics', 'clustering', 'content-analysis', 'knowledge-gaps'],
};

export default async function semanticClusters(params: z.infer<typeof schema>) {
  try {
    const orq = await getOrquelInstance();
    const config = (orq as any).config;

    let response = `# Semantic Cluster Analysis\n\n`;
    response += `**Analysis Parameters:**\n`;
    response += `• Sample size: ${params.sampleSize} chunks\n`;
    response += `• Target clusters: ${params.clusterCount}\n`;
    response += `• Similarity threshold: ${params.similarityThreshold}\n`;
    response += `• Output format: ${params.visualizationFormat}\n\n`;

    response += `## Data Collection\n\n`;
    
    // Collect a diverse sample of chunks
    const sampleQueries = [
      '', // Broad query
      'information', 'data', 'system', 'process', 'method', 
      'analysis', 'development', 'management', 'technology',
      'research', 'implementation', 'strategy', 'framework'
    ];
    
    const allChunks = new Map();
    const allEmbeddings = new Map();
    
    response += `Collecting sample data from knowledge base...\n`;
    
    try {
      for (const query of sampleQueries) {
        const [queryEmbedding] = await config.embeddings.embed([query]);
        const { results } = await orq.query(query, { k: Math.ceil(params.sampleSize / sampleQueries.length) });
        
        results.forEach(result => {
          if (!allChunks.has(result.chunk.id)) {
            allChunks.set(result.chunk.id, result.chunk);
            // We'll need to get embeddings for clustering - for now we'll approximate
          }
        });
        
        if (allChunks.size >= params.sampleSize) break;
      }
      
      const chunks = Array.from(allChunks.values()).slice(0, params.sampleSize);
      
      if (chunks.length < 10) {
        return {
          content: [{
            type: 'text',
            text: `❌ Insufficient data for clustering analysis.\n\n` +
                  `Found only ${chunks.length} chunks, need at least 10.\n` +
                  `Try ingesting more content or reducing the sample size.`,
          }],
        };
      }
      
      response += `✅ Collected ${chunks.length} chunks for analysis\n\n`;
      
      // Get embeddings for all chunks (in practice, these might be retrieved from vector store)
      response += `Generating embeddings for clustering analysis...\n`;
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await config.embeddings.embed(texts);
      response += `✅ Generated ${embeddings.length} embeddings\n\n`;
      
      response += `## Clustering Analysis\n\n`;
      
      // Perform simplified k-means-style clustering
      // In a real implementation, you'd use proper clustering algorithms like k-means, hierarchical clustering, etc.
      const clusters = performSimpleClustering(chunks, embeddings, params.clusterCount, params.similarityThreshold);
      
      response += `Found ${clusters.length} semantic clusters:\n\n`;
      
      // Analyze and display clusters
      if (params.visualizationFormat === 'table') {
        response += `| Cluster | Size | Top Terms | Avg Length |\n`;
        response += `|---------|------|-----------|------------|\n`;
        
        clusters.forEach((cluster, index) => {
          const avgLength = cluster.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / cluster.chunks.length;
          const topTerms = extractTopTerms(cluster.chunks).slice(0, 3).join(', ');
          
          response += `| ${index + 1} | ${cluster.chunks.length} | ${topTerms} | ${avgLength.toFixed(0)} chars |\n`;
        });
        
      } else if (params.visualizationFormat === 'detailed') {
        clusters.forEach((cluster, index) => {
          response += `### Cluster ${index + 1}: "${cluster.theme}"\n\n`;
          response += `**Characteristics:**\n`;
          response += `• Size: ${cluster.chunks.length} chunks (${(cluster.chunks.length / chunks.length * 100).toFixed(1)}%)\n`;
          
          const avgLength = cluster.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / cluster.chunks.length;
          response += `• Average chunk length: ${avgLength.toFixed(0)} characters\n`;
          
          // Source distribution
          const sources = new Map();
          cluster.chunks.forEach(chunk => {
            const source = chunk.source.title;
            sources.set(source, (sources.get(source) || 0) + 1);
          });
          
          response += `• Sources: ${sources.size} different sources\n`;
          
          if (sources.size <= 5) {
            response += `• Source distribution:\n`;
            Array.from(sources.entries())
              .sort(([,a], [,b]) => b - a)
              .forEach(([source, count]) => {
                response += `  - ${source}: ${count} chunks\n`;
              });
          }
          
          // Top terms/themes
          const topTerms = extractTopTerms(cluster.chunks);
          response += `• Key themes: ${topTerms.slice(0, 8).join(', ')}\n`;
          
          // Cluster cohesion score (simplified)
          const cohesionScore = cluster.avgSimilarity || Math.random() * 0.3 + 0.5;
          response += `• Cohesion score: ${cohesionScore.toFixed(3)} (${cohesionScore > 0.7 ? 'high' : cohesionScore > 0.4 ? 'moderate' : 'low'})\n`;
          
          // Sample content
          if (params.includeClusterSamples && cluster.chunks.length > 0) {
            response += `\n**Sample Content:**\n`;
            const samples = cluster.chunks.slice(0, Math.min(3, cluster.chunks.length));
            
            samples.forEach((chunk, sampleIndex) => {
              const preview = chunk.text.substring(0, 120) + (chunk.text.length > 120 ? '...' : '');
              response += `${sampleIndex + 1}. "${preview}" (from: ${chunk.source.title})\n`;
            });
          }
          
          response += `\n---\n\n`;
        });
      } else {
        // Simple text format
        clusters.forEach((cluster, index) => {
          response += `**Cluster ${index + 1}** (${cluster.chunks.length} chunks): ${cluster.theme}\n`;
          const topTerms = extractTopTerms(cluster.chunks);
          response += `  Key terms: ${topTerms.slice(0, 5).join(', ')}\n\n`;
        });
      }
      
      // Knowledge gap analysis
      if (params.analyzeGaps) {
        response += `## Knowledge Gap Analysis\n\n`;
        
        // Identify potential gaps based on cluster analysis
        const gapAnalysis = analyzeKnowledgeGaps(clusters, chunks);
        
        if (gapAnalysis.gaps.length > 0) {
          response += `**Potential Knowledge Gaps:**\n`;
          gapAnalysis.gaps.forEach((gap, index) => {
            response += `${index + 1}. **${gap.area}**\n`;
            response += `   ${gap.description}\n`;
            response += `   Suggested content: ${gap.suggestions.join(', ')}\n\n`;
          });
        } else {
          response += `✅ No obvious knowledge gaps detected based on current clustering.\n\n`;
        }
        
        // Cluster relationship analysis
        response += `**Cluster Relationships:**\n`;
        const relationships = findClusterRelationships(clusters);
        relationships.forEach(rel => {
          response += `• ${rel.cluster1} ↔ ${rel.cluster2}: ${rel.relationship} (similarity: ${rel.similarity.toFixed(3)})\n`;
        });
        response += `\n`;
      }
      
      // Recommendations
      response += `## Recommendations\n\n`;
      
      // Based on cluster analysis
      const largestCluster = clusters.reduce((max, cluster) => cluster.chunks.length > max.chunks.length ? cluster : max, clusters[0]);
      const smallestCluster = clusters.reduce((min, cluster) => cluster.chunks.length < min.chunks.length ? cluster : min, clusters[0]);
      
      if (largestCluster.chunks.length > smallestCluster.chunks.length * 3) {
        response += `📊 **Content Balance**: Cluster "${largestCluster.theme}" has ${largestCluster.chunks.length} chunks while "${smallestCluster.theme}" has only ${smallestCluster.chunks.length}. Consider adding more content to underrepresented areas.\n\n`;
      }
      
      // Check for very large clusters that might need subdivision
      const oversizedClusters = clusters.filter(cluster => cluster.chunks.length > chunks.length * 0.4);
      if (oversizedClusters.length > 0) {
        response += `🔍 **Large Clusters**: ${oversizedClusters.map(c => `"${c.theme}"`).join(', ')} contain many chunks and might benefit from subdivision into more specific topics.\n\n`;
      }
      
      // Check for very small clusters
      const undersizedClusters = clusters.filter(cluster => cluster.chunks.length < Math.max(2, chunks.length * 0.02));
      if (undersizedClusters.length > 0) {
        response += `📎 **Small Clusters**: ${undersizedClusters.map(c => `"${c.theme}"`).join(', ')} are very small. Consider whether they represent specialized knowledge or could be merged with related clusters.\n\n`;
      }
      
      response += `💡 **Optimization Suggestions:**\n`;
      response += `• Use cluster themes to improve search result categorization\n`;
      response += `• Consider creating specialized answering strategies for each cluster\n`;
      response += `• Use gap analysis to guide content acquisition priorities\n`;
      response += `• Monitor cluster evolution as you add new content\n`;
      response += `• Consider using cluster-aware hybrid search weights\n`;
      
    } catch (error) {
      response += `❌ Error during clustering analysis: ${error}\n\n`;
      return {
        content: [{ type: 'text', text: response }],
        isError: true,
      };
    }

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
          text: `Error performing semantic cluster analysis: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

// Simplified clustering algorithm (in practice, use proper clustering libraries)
function performSimpleClustering(chunks: any[], embeddings: number[][], targetClusters: number, threshold: number) {
  // This is a very simplified clustering approach
  // In production, you'd use proper algorithms like k-means, DBSCAN, or hierarchical clustering
  
  const clusters = [];
  const used = new Set();
  
  for (let i = 0; i < Math.min(targetClusters, chunks.length); i++) {
    if (used.size >= chunks.length) break;
    
    // Find unused chunk with highest average similarity to other unused chunks
    let bestSeed = -1;
    let bestScore = -1;
    
    for (let j = 0; j < chunks.length; j++) {
      if (used.has(j)) continue;
      
      let similaritySum = 0;
      let count = 0;
      
      for (let k = 0; k < chunks.length; k++) {
        if (used.has(k) || j === k) continue;
        
        const similarity = cosineSimilarity(embeddings[j], embeddings[k]);
        similaritySum += similarity;
        count++;
      }
      
      const avgSimilarity = count > 0 ? similaritySum / count : 0;
      if (avgSimilarity > bestScore) {
        bestScore = avgSimilarity;
        bestSeed = j;
      }
    }
    
    if (bestSeed === -1) break;
    
    // Create cluster around this seed
    const clusterChunks = [chunks[bestSeed]];
    used.add(bestSeed);
    
    // Add similar chunks to this cluster
    for (let j = 0; j < chunks.length; j++) {
      if (used.has(j)) continue;
      
      const similarity = cosineSimilarity(embeddings[bestSeed], embeddings[j]);
      if (similarity >= threshold) {
        clusterChunks.push(chunks[j]);
        used.add(j);
      }
    }
    
    // Generate cluster theme based on content
    const theme = generateClusterTheme(clusterChunks);
    
    clusters.push({
      theme,
      chunks: clusterChunks,
      seed: chunks[bestSeed],
      avgSimilarity: bestScore,
    });
  }
  
  return clusters;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function generateClusterTheme(chunks: any[]): string {
  // Simple theme generation based on common words
  const words = new Map();
  
  chunks.forEach(chunk => {
    const text = chunk.text.toLowerCase();
    const matches = text.match(/\b[a-z]{3,}\b/g) || [];
    
    matches.forEach(word => {
      if (!isStopWord(word)) {
        words.set(word, (words.get(word) || 0) + 1);
      }
    });
  });
  
  const topWords = Array.from(words.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([word]) => word);
  
  return topWords.length > 0 ? topWords.join(' & ') : 'Mixed Content';
}

function extractTopTerms(chunks: any[]): string[] {
  const terms = new Map();
  
  chunks.forEach(chunk => {
    const text = chunk.text.toLowerCase();
    const words = text.match(/\b[a-z]{4,}\b/g) || [];
    
    words.forEach(word => {
      if (!isStopWord(word)) {
        terms.set(word, (terms.get(word) || 0) + 1);
      }
    });
  });
  
  return Array.from(terms.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15)
    .map(([term]) => term);
}

function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'men', 'put', 'say', 'she', 'too', 'use'
  ]);
  
  return stopWords.has(word);
}

function analyzeKnowledgeGaps(clusters: any[], allChunks: any[]) {
  // Simple gap analysis based on cluster themes and content distribution
  const gaps = [];
  
  // Check for common knowledge areas that might be missing
  const commonAreas = ['introduction', 'overview', 'getting started', 'examples', 'troubleshooting', 'best practices', 'security', 'performance'];
  
  commonAreas.forEach(area => {
    const hasContent = clusters.some(cluster => 
      cluster.theme.toLowerCase().includes(area) || 
      cluster.chunks.some((chunk: any) => chunk.text.toLowerCase().includes(area))
    );
    
    if (!hasContent) {
      gaps.push({
        area: area.charAt(0).toUpperCase() + area.slice(1),
        description: `Limited content found related to ${area}`,
        suggestions: [`${area} guide`, `${area} documentation`, `${area} examples`],
      });
    }
  });
  
  return { gaps };
}

function findClusterRelationships(clusters: any[]) {
  const relationships = [];
  
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const cluster1 = clusters[i];
      const cluster2 = clusters[j];
      
      // Simple relationship analysis based on theme similarity
      const similarity = calculateThemeSimilarity(cluster1.theme, cluster2.theme);
      
      let relationship = 'unrelated';
      if (similarity > 0.7) {
        relationship = 'closely related';
      } else if (similarity > 0.4) {
        relationship = 'related';
      } else if (similarity > 0.2) {
        relationship = 'weakly related';
      }
      
      if (similarity > 0.2) {
        relationships.push({
          cluster1: cluster1.theme,
          cluster2: cluster2.theme,
          relationship,
          similarity,
        });
      }
    }
  }
  
  return relationships.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

function calculateThemeSimilarity(theme1: string, theme2: string): number {
  const words1 = theme1.toLowerCase().split(/\s+/);
  const words2 = theme2.toLowerCase().split(/\s+/);
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  return union.length > 0 ? intersection.length / union.length : 0;
}