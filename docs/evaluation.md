# RAG System Evaluation

Evaluating Retrieval-Augmented Generation (RAG) systems is crucial for measuring and improving performance. Orquel provides a comprehensive evaluation framework with standardized metrics, automated testing, and performance benchmarking.

## Overview

The Orquel evaluation system measures:

- **Retrieval Quality**: How well the system finds relevant documents
- **Answer Quality**: How accurate and helpful generated answers are  
- **System Performance**: Response times and resource usage
- **User Experience**: End-to-end workflow effectiveness

## Quick Start

```typescript
import { createOrquel, RAGEvaluator, createSampleEvaluationDataset } from '@orquel/core';
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { memoryStore } from '@orquel/store-memory';
import { openAIAnswerer } from '@orquel/answer-openai';

// Create your RAG system
const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: memoryStore(),
  answerer: openAIAnswerer(),
});

// Set up evaluator
const evaluator = new RAGEvaluator(orq);

// Use sample dataset or create your own
const groundTruth = createSampleEvaluationDataset();

// Run evaluation
const metrics = await evaluator.evaluate(groundTruth);

console.log(`F1 Score: ${metrics.f1Score.toFixed(3)}`);
console.log(`Precision: ${metrics.precision.toFixed(3)}`);
console.log(`Recall: ${metrics.recall.toFixed(3)}`);

// Generate detailed report
const report = await evaluator.generateReport(groundTruth);
console.log(report);
```

## Core Metrics

### Retrieval Metrics

#### Precision
**Definition**: Fraction of retrieved chunks that are relevant to the query.

```
Precision = (Relevant chunks retrieved) / (Total chunks retrieved)
```

**Interpretation**:
- **High Precision (>0.8)**: System returns mostly relevant results
- **Low Precision (<0.5)**: System returns many irrelevant results

**Improving Precision**:
- Add reranking to filter out irrelevant results
- Improve embedding model quality
- Refine chunking strategy to reduce noise
- Use hybrid search to combine dense and lexical signals

#### Recall  
**Definition**: Fraction of relevant chunks that were actually retrieved.

```
Recall = (Relevant chunks retrieved) / (Total relevant chunks)
```

**Interpretation**:
- **High Recall (>0.8)**: System finds most relevant information
- **Low Recall (<0.5)**: System misses important relevant documents

**Improving Recall**:
- Increase retrieval parameter k (return more results)
- Use hybrid search to catch different types of relevance
- Improve document chunking to avoid splitting relevant content
- Experiment with different embedding models

#### F1 Score
**Definition**: Harmonic mean of precision and recall, providing a balanced metric.

```
F1 = 2 × (Precision × Recall) / (Precision + Recall)
```

**Interpretation**:
- **Excellent (>0.7)**: Well-balanced, high-quality retrieval
- **Good (>0.55)**: Solid performance with room for improvement  
- **Fair (>0.4)**: Functional but needs optimization
- **Poor (<0.4)**: Significant improvements needed

#### Mean Reciprocal Rank (MRR)
**Definition**: Average of reciprocal ranks of the first relevant result.

```
MRR = (1/N) × Σ(1/rank_i)
```

**Interpretation**:
- **High MRR (>0.8)**: Relevant results appear at top of rankings
- **Low MRR (<0.3)**: Relevant results buried in results

**Improving MRR**:
- Add reranking to improve result ordering
- Optimize embedding model for your domain
- Tune similarity thresholds
- Use query expansion techniques

#### Normalized Discounted Cumulative Gain (NDCG)
**Definition**: Measures ranking quality, giving higher weight to relevant results at top positions.

```
DCG@k = Σ(relevance_i / log2(i + 1))
NDCG@k = DCG@k / IDCG@k
```

**Interpretation**:
- **High NDCG (>0.8)**: Excellent ranking quality
- **Low NDCG (<0.5)**: Poor ranking, relevant results not prioritized

#### Hit Rate
**Definition**: Percentage of queries that retrieve at least one relevant result.

```
Hit Rate = (Queries with ≥1 relevant result) / (Total queries)
```

**Interpretation**:
- **High Hit Rate (>0.9)**: System reliably finds relevant information
- **Low Hit Rate (<0.7)**: System frequently fails to find anything relevant

### Answer Quality Metrics

#### Semantic Similarity
Measures overlap between generated answer and expected answer:

```typescript
// Built into RAGEvaluator
const groundTruth = [{
  query: "What is Argentina?",
  relevantChunkIds: ["geo-argentina-1"],
  expectedAnswer: "Argentina is a country in South America",
  expectedKeywords: ["country", "South America", "Argentina"]
}];

const metrics = await evaluator.evaluate(groundTruth, { 
  evaluateAnswers: true 
});
```

#### Custom Answer Scoring
You can provide custom answer evaluation functions:

```typescript
const customEvaluator = new RAGEvaluator(orq);

const metrics = await customEvaluator.evaluate(groundTruth, {
  evaluateAnswers: true,
  answerScorer: (actual, expected) => {
    // Your custom scoring logic
    return calculateCustomScore(actual, expected);
  }
});
```

### Performance Metrics

#### Response Time
Average time to complete queries:

```typescript
const metrics = await evaluator.evaluate(groundTruth);
console.log(`Average response time: ${metrics.avgResponseTime}ms`);
```

**Performance Targets**:
- **Excellent (<500ms)**: Interactive user experience
- **Good (<2s)**: Acceptable for most applications
- **Slow (>5s)**: User experience suffers

## Creating Ground Truth Datasets

### Manual Curation

```typescript
const groundTruth = [
  {
    query: "What is the capital of Argentina?",
    relevantChunkIds: ["argentina-capital-1", "buenos-aires-overview-1"], 
    expectedAnswer: "Buenos Aires is the capital of Argentina",
    expectedKeywords: ["Buenos Aires", "capital"]
  },
  {
    query: "Tell me about Argentine culture",
    relevantChunkIds: ["culture-overview-1", "traditions-1", "arts-1"],
    expectedAnswer: "Argentine culture is heavily influenced by European immigration",
    expectedKeywords: ["culture", "European", "immigration", "traditions"]
  }
];
```

### Automated Generation

```typescript
import { generateGroundTruth } from './utils/ground-truth-generator';

// Generate synthetic queries from your document corpus
const syntheticGroundTruth = await generateGroundTruth({
  chunks: yourDocumentChunks,
  numQueries: 50,
  questionTypes: ['factual', 'conceptual', 'comparative']
});
```

### Domain-Specific Datasets

```typescript
// Load domain-specific evaluation data
import { loadLegalDataset } from '@orquel/datasets-legal';
import { loadMedicalDataset } from '@orquel/datasets-medical'; 
import { loadFinancialDataset } from '@orquel/datasets-financial';

const legalGroundTruth = await loadLegalDataset();
const medicalGroundTruth = await loadMedicalDataset();
```

## Evaluation Configurations

### Basic Evaluation
```typescript
// Default: k=10, dense search only, no answer evaluation
const metrics = await evaluator.evaluate(groundTruth);
```

### Comprehensive Evaluation
```typescript
const metrics = await evaluator.evaluate(groundTruth, {
  k: 20,                    // Retrieve top 20 results
  hybrid: true,             // Use dense + lexical search
  rerank: true,             // Apply reranking
  evaluateAnswers: true,    // Evaluate answer quality
});
```

### A/B Testing Configuration
```typescript
// Test different configurations
const configs = [
  { name: 'Dense Only', k: 10, hybrid: false, rerank: false },
  { name: 'Hybrid', k: 10, hybrid: true, rerank: false },
  { name: 'Hybrid + Rerank', k: 10, hybrid: true, rerank: true },
  { name: 'High Recall', k: 50, hybrid: true, rerank: true },
];

for (const config of configs) {
  const metrics = await evaluator.evaluate(groundTruth, config);
  console.log(`${config.name}: F1=${metrics.f1Score.toFixed(3)}`);
}
```

## Advanced Evaluation Techniques

### Cross-Validation

```typescript
import { createCrossValidationSets } from './utils/evaluation';

// Split dataset for cross-validation
const folds = createCrossValidationSets(groundTruth, 5);

let totalF1 = 0;
for (let i = 0; i < folds.length; i++) {
  const trainSet = folds.filter((_, idx) => idx !== i).flat();
  const testSet = folds[i];
  
  // Train/optimize on trainSet, evaluate on testSet
  const metrics = await evaluator.evaluate(testSet);
  totalF1 += metrics.f1Score;
}

const avgF1 = totalF1 / folds.length;
console.log(`Cross-validation F1: ${avgF1.toFixed(3)}`);
```

### Statistical Significance Testing

```typescript
import { performSignificanceTest } from './utils/stats';

// Compare two configurations
const config1Metrics = await evaluator.evaluate(groundTruth, configA);
const config2Metrics = await evaluator.evaluate(groundTruth, configB);

const significance = performSignificanceTest(
  config1Metrics.queryResults,
  config2Metrics.queryResults
);

if (significance.pValue < 0.05) {
  console.log(`Configuration B significantly better (p=${significance.pValue})`);
}
```

### Error Analysis

```typescript
// Detailed error analysis
const detailedResults = await evaluator.evaluateWithDetails(groundTruth);

// Analyze failed queries
const failedQueries = detailedResults.filter(r => r.f1Score < 0.3);

console.log('Failed queries:');
failedQueries.forEach(result => {
  console.log(`Query: ${result.query}`);
  console.log(`Expected: ${result.relevantChunkIds.join(', ')}`);
  console.log(`Retrieved: ${result.retrievedChunkIds.join(', ')}`);
  console.log(`F1: ${result.f1Score}`);
  console.log('---');
});
```

## Automated Reporting

### Performance Reports

```typescript
// Generate comprehensive HTML report
const report = await evaluator.generateReport(groundTruth, {
  includeCharts: true,
  includeSamples: true,
  outputFormat: 'html'
});

await fs.writeFile('evaluation-report.html', report);
```

### Continuous Monitoring

```typescript
// Set up continuous evaluation monitoring
import { EvaluationMonitor } from '@orquel/monitoring';

const monitor = new EvaluationMonitor({
  evaluator,
  groundTruth,
  schedule: '0 2 * * *', // Daily at 2 AM
  alertThresholds: {
    f1Score: 0.6,       // Alert if F1 drops below 0.6
    avgResponseTime: 2000, // Alert if response time > 2s
  }
});

await monitor.start();
```

### Integration with Monitoring Systems

```typescript
// Export metrics to Prometheus
import { PrometheusExporter } from '@orquel/prometheus';

const exporter = new PrometheusExporter();
await exporter.exportMetrics(metrics);

// Send to DataDog
import { DataDogReporter } from '@orquel/datadog';

const reporter = new DataDogReporter({ apiKey: process.env.DATADOG_API_KEY });
await reporter.reportMetrics(metrics);
```

## Best Practices

### Dataset Quality

1. **Representative Queries**: Include questions your users actually ask
2. **Diverse Complexity**: Mix simple factual and complex analytical queries  
3. **Multiple Judgments**: Have multiple annotators label relevance
4. **Regular Updates**: Refresh datasets as your content evolves
5. **Domain Coverage**: Ensure all important topics are represented

### Evaluation Frequency

```typescript
// Development workflow
const quickEval = await evaluator.evaluate(sampleQueries.slice(0, 10));

// Pre-deployment validation
const fullEval = await evaluator.evaluate(completeGroundTruth);

// Production monitoring
const ongoingEval = await evaluator.evaluate(liveUserQueries);
```

### Metric Interpretation

| F1 Score | Quality Level | Action Required |
|----------|---------------|-----------------|
| >0.8     | Excellent     | Monitor for regression |
| 0.7-0.8  | Good          | Minor optimizations |
| 0.5-0.7  | Fair          | Systematic improvements needed |
| 0.3-0.5  | Poor          | Major rework required |
| <0.3     | Broken        | Fundamental issues |

### Common Pitfalls

1. **Over-fitting to Evaluation Set**: Ensure train/test separation
2. **Unrealistic Ground Truth**: Avoid perfectionist relevance judgments
3. **Ignoring User Intent**: Consider why users ask questions
4. **Static Evaluation**: Update datasets as system evolves
5. **Single Metric Focus**: Balance multiple metrics (precision, recall, speed)

## Domain-Specific Considerations

### Legal Documents
- Emphasize precision over recall (false positives costly)
- Include citation accuracy in evaluation
- Test with complex legal reasoning queries

### Medical Information  
- Strict accuracy requirements
- Evaluate against medical guidelines
- Include safety-critical error analysis

### E-commerce
- Focus on conversion-related metrics
- Evaluate product recommendation accuracy
- Include business metrics (click-through rates)

### Technical Documentation
- Test procedural question answering
- Evaluate code example accuracy
- Include troubleshooting scenario performance

## Benchmarking

### Standard Datasets

```typescript
// Use community benchmark datasets
import { loadMSMARCO, loadNaturalQuestions } from '@orquel/benchmarks';

const msMarcoResults = await evaluator.evaluate(await loadMSMARCO());
const nqResults = await evaluator.evaluate(await loadNaturalQuestions());

// Compare against published baselines
console.log('MSMARCO Performance:');
console.log(`F1: ${msMarcoResults.f1Score.toFixed(3)} (Baseline: 0.65)`);
```

### Custom Benchmarks

```typescript
// Create reproducible benchmarks for your domain
export const createCustomBenchmark = () => ({
  name: 'Customer Support FAQ',
  version: '1.0',
  queries: customerSupportQueries,
  expectedMetrics: {
    f1Score: { min: 0.7, target: 0.8 },
    avgResponseTime: { max: 1500, target: 800 }
  }
});
```

## Troubleshooting

### Low Precision Issues
- **Symptom**: Many irrelevant results returned
- **Solutions**: Add reranking, improve chunking, tune similarity thresholds
- **Debug**: Analyze false positive examples

### Low Recall Issues  
- **Symptom**: Missing relevant information
- **Solutions**: Increase k, use hybrid search, improve embeddings
- **Debug**: Analyze false negative examples

### Slow Performance
- **Symptom**: High response times
- **Solutions**: Optimize vector search, cache embeddings, use approximation
- **Debug**: Profile bottlenecks with performance monitoring

### Inconsistent Results
- **Symptom**: High variance in evaluation metrics
- **Solutions**: Increase evaluation dataset size, improve ground truth quality
- **Debug**: Analyze query difficulty distribution

This comprehensive evaluation framework helps you build, optimize, and maintain high-quality RAG systems with confidence.