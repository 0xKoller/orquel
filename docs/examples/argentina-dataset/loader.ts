/**
 * Argentina Dataset Loader
 * 
 * Utility functions to load and use the Argentina benchmark dataset
 * for RAG system evaluation and testing.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface ArgentinaDatasetQuery {
  query: string;
  relevantChunkIds: string[];
  expectedAnswer: string;
  expectedKeywords: string[];
  domain: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'factual' | 'descriptive' | 'conceptual' | 'procedural' | 'analytical';
}

export interface ArgentinaDatasetDocument {
  filename: string;
  title: string;
  content: string;
  source: {
    title: string;
    kind: string;
  };
}

export interface ArgentinaDatasetMetadata {
  dataset: {
    name: string;
    version: string;
    language: string;
    description: string;
    total_words: number;
    total_documents: number;
    estimated_chunks: number;
    domains: string[];
  };
  documents: Array<{
    filename: string;
    title: string;
    domain: string;
    words: number;
    sections: number;
    topics: string[];
    key_entities: string[];
  }>;
  ground_truth: {
    total_queries: number;
    by_domain: Record<string, number>;
    by_difficulty: Record<string, number>;
    by_type: Record<string, number>;
  };
}

/**
 * Load all documents from the Argentina dataset
 */
export function loadArgentinaDocuments(datasetPath?: string): ArgentinaDatasetDocument[] {
  const basePath = datasetPath || join(__dirname, '.');
  const contentPath = join(basePath, 'content');
  
  const documents: ArgentinaDatasetDocument[] = [
    {
      filename: 'geografia.md',
      title: 'Geografía de Argentina',
      content: readFileSync(join(contentPath, 'geografia.md'), 'utf-8'),
      source: { title: 'Geografía de Argentina', kind: 'md' }
    },
    {
      filename: 'historia.md', 
      title: 'Historia de Argentina',
      content: readFileSync(join(contentPath, 'historia.md'), 'utf-8'),
      source: { title: 'Historia de Argentina', kind: 'md' }
    },
    {
      filename: 'cultura.md',
      title: 'Cultura Argentina', 
      content: readFileSync(join(contentPath, 'cultura.md'), 'utf-8'),
      source: { title: 'Cultura Argentina', kind: 'md' }
    },
    {
      filename: 'gastronomia.md',
      title: 'Gastronomía Argentina',
      content: readFileSync(join(contentPath, 'gastronomia.md'), 'utf-8'),
      source: { title: 'Gastronomía Argentina', kind: 'md' }
    },
    {
      filename: 'ciudades.md',
      title: 'Ciudades de Argentina',
      content: readFileSync(join(contentPath, 'ciudades.md'), 'utf-8'), 
      source: { title: 'Ciudades de Argentina', kind: 'md' }
    }
  ];

  return documents;
}

/**
 * Load ground truth queries from the Argentina dataset
 */
export function loadArgentinaGroundTruth(datasetPath?: string, domains?: string[]): ArgentinaDatasetQuery[] {
  const basePath = datasetPath || join(__dirname, '.');
  const queriesPath = join(basePath, 'queries');
  
  const allDomains = domains || ['geografia', 'historia', 'cultura', 'gastronomia', 'ciudades', 'integrated'];
  let allQueries: ArgentinaDatasetQuery[] = [];
  
  for (const domain of allDomains) {
    try {
      const queryFile = join(queriesPath, `${domain}.json`);
      const queries: ArgentinaDatasetQuery[] = JSON.parse(readFileSync(queryFile, 'utf-8'));
      allQueries = allQueries.concat(queries);
    } catch (error) {
      console.warn(`Could not load queries for domain ${domain}: ${error}`);
    }
  }
  
  return allQueries;
}

/**
 * Load dataset metadata
 */
export function loadArgentinaMetadata(datasetPath?: string): ArgentinaDatasetMetadata {
  const basePath = datasetPath || join(__dirname, '.');
  const metadataPath = join(basePath, 'metadata.json');
  
  return JSON.parse(readFileSync(metadataPath, 'utf-8'));
}

/**
 * Load complete Argentina dataset
 */
export function loadArgentinaDataset(datasetPath?: string) {
  return {
    documents: loadArgentinaDocuments(datasetPath),
    groundTruth: loadArgentinaGroundTruth(datasetPath),
    metadata: loadArgentinaMetadata(datasetPath)
  };
}

/**
 * Filter ground truth by domain
 */
export function filterByDomain(groundTruth: ArgentinaDatasetQuery[], domain: string): ArgentinaDatasetQuery[] {
  return groundTruth.filter(q => q.domain === domain);
}

/**
 * Filter ground truth by difficulty
 */
export function filterByDifficulty(groundTruth: ArgentinaDatasetQuery[], difficulty: string): ArgentinaDatasetQuery[] {
  return groundTruth.filter(q => q.difficulty === difficulty);
}

/**
 * Filter ground truth by query type
 */
export function filterByType(groundTruth: ArgentinaDatasetQuery[], type: string): ArgentinaDatasetQuery[] {
  return groundTruth.filter(q => q.type === type);
}

/**
 * Get sample queries for quick testing
 */
export function getSampleQueries(count: number = 5): ArgentinaDatasetQuery[] {
  const groundTruth = loadArgentinaGroundTruth();
  
  // Get diverse sample across domains
  const domains = ['geografia', 'historia', 'cultura', 'gastronomia', 'ciudades'];
  const sample: ArgentinaDatasetQuery[] = [];
  
  for (let i = 0; i < count && i < domains.length; i++) {
    const domainQueries = filterByDomain(groundTruth, domains[i]);
    if (domainQueries.length > 0) {
      sample.push(domainQueries[0]); // Get first query from each domain
    }
  }
  
  // Fill remaining slots with random queries if needed
  while (sample.length < count && sample.length < groundTruth.length) {
    const remaining = groundTruth.filter(q => !sample.includes(q));
    if (remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      sample.push(remaining[randomIndex]);
    } else {
      break;
    }
  }
  
  return sample.slice(0, count);
}

/**
 * Validate dataset integrity
 */
export function validateDataset(datasetPath?: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Check documents exist and are readable
    const documents = loadArgentinaDocuments(datasetPath);
    if (documents.length !== 5) {
      errors.push(`Expected 5 documents, found ${documents.length}`);
    }
    
    // Check each document has content
    for (const doc of documents) {
      if (!doc.content || doc.content.length < 1000) {
        errors.push(`Document ${doc.filename} appears to be empty or too short`);
      }
    }
    
    // Check ground truth exists and has expected structure
    const groundTruth = loadArgentinaGroundTruth(datasetPath);
    if (groundTruth.length < 30) {
      errors.push(`Expected at least 30 ground truth queries, found ${groundTruth.length}`);
    }
    
    // Validate query structure
    for (const query of groundTruth.slice(0, 5)) { // Sample check
      if (!query.query || !query.expectedAnswer || !query.domain) {
        errors.push(`Invalid query structure detected`);
        break;
      }
    }
    
    // Check metadata
    const metadata = loadArgentinaMetadata(datasetPath);
    if (!metadata.dataset || !metadata.documents) {
      errors.push('Invalid metadata structure');
    }
    
  } catch (error) {
    errors.push(`Error validating dataset: ${error}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Example usage and testing function
 */
export async function exampleUsage() {
  console.log('🇦🇷 Argentina Dataset Example Usage\n');
  
  // Load complete dataset
  const { documents, groundTruth, metadata } = loadArgentinaDataset();
  
  console.log(`📚 Loaded ${documents.length} documents`);
  console.log(`❓ Loaded ${groundTruth.length} ground truth queries`);
  console.log(`📊 Dataset: ${metadata.dataset.name} v${metadata.dataset.version}\n`);
  
  // Show sample document
  console.log('📄 Sample Document:');
  console.log(`Title: ${documents[0].title}`);
  console.log(`Content preview: ${documents[0].content.substring(0, 200)}...\n`);
  
  // Show sample queries
  console.log('❓ Sample Queries:');
  const sampleQueries = getSampleQueries(3);
  for (const query of sampleQueries) {
    console.log(`- [${query.domain}/${query.difficulty}] ${query.query}`);
  }
  
  console.log('\n✅ Dataset loaded successfully!');
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}