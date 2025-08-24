# Argentina Dataset - Comprehensive RAG Benchmark

This dataset provides comprehensive Spanish-language content about Argentina, designed for testing and evaluating RAG (Retrieval-Augmented Generation) systems. It contains ~15,000 words of structured, high-quality content covering multiple domains.

## 📊 Dataset Overview

- **Language**: Spanish
- **Content**: ~15,000 words across 5 documents
- **Chunks**: ~200 after processing
- **Domains**: Geography, History, Culture, Gastronomy, Cities
- **Format**: Markdown with hierarchical structure

## 📁 Dataset Structure

```
argentina-dataset/
├── README.md              # This file
├── content/               # Source documents
│   ├── geografia.md       # Geography: regions, climate, resources
│   ├── historia.md        # History: independence, peronism, democracy
│   ├── cultura.md         # Culture: tango, literature, football
│   ├── gastronomia.md     # Gastronomy: asado, mate, wines
│   └── ciudades.md        # Cities: Buenos Aires, Córdoba, etc.
├── queries/               # Ground truth queries
│   ├── geografia.json     # Geography-related questions
│   ├── historia.json      # History-related questions
│   ├── cultura.json       # Culture-related questions
│   ├── gastronomia.json   # Gastronomy-related questions
│   ├── ciudades.json      # Cities-related questions
│   └── integrated.json    # Cross-domain questions
└── metadata.json          # Dataset metadata
```

## 🎯 Use Cases

### RAG System Evaluation
- Test retrieval quality across multiple domains
- Evaluate answer generation in Spanish
- Benchmark cross-domain query handling
- Assess citation and context accuracy

### Research Applications
- Multilingual RAG system development
- Knowledge base construction
- Information retrieval studies
- Educational content analysis

### Production Testing
- End-to-end pipeline validation
- Performance benchmarking
- Quality assurance workflows
- Regression testing

## 📈 Expected Metrics

Based on testing with Orquel v0.1.0:

| Metric | Expected Range | Notes |
|--------|----------------|-------|
| Precision | 0.75-0.90 | High due to structured content |
| Recall | 0.70-0.85 | Good coverage across topics |
| F1 Score | 0.72-0.87 | Balanced performance |
| Hit Rate | 0.90-0.95 | Most queries find relevant content |
| Response Time | 2-5s per query | Using OpenAI embeddings |

## 🚀 Quick Start

### Using with Orquel

```typescript
import { createOrquel, RAGEvaluator } from '@orquel/core';
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { memoryStore } from '@orquel/store-memory';
import { openAIAnswerer } from '@orquel/answer-openai';
import { loadArgentinaDataset } from './argentina-dataset';

// Create RAG system
const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: memoryStore(),
  answerer: openAIAnswerer(),
});

// Load dataset
const { documents, groundTruth } = await loadArgentinaDataset();

// Index content
for (const doc of documents) {
  const { chunks } = await orq.ingest(doc);
  await orq.index(chunks);
}

// Run evaluation
const evaluator = new RAGEvaluator(orq);
const metrics = await evaluator.evaluate(groundTruth);

console.log(`F1 Score: ${metrics.f1Score.toFixed(3)}`);
```

### Manual Testing

```typescript
// Test specific queries
const queries = [
  '¿Cuáles son las principales regiones geográficas de Argentina?',
  '¿Cuándo se independizó Argentina y quiénes fueron sus principales próceres?',
  '¿Qué es el tango y dónde nació?',
];

for (const query of queries) {
  const { answer, contexts } = await orq.answer(query);
  console.log(`Q: ${query}`);
  console.log(`A: ${answer}`);
  console.log(`Sources: ${contexts.length} chunks\n`);
}
```

## 📝 Content Domains

### 1. Geography (geografia.md)
Comprehensive coverage of Argentina's geography including:
- Geographic regions (Pampa, Patagonia, Andes, etc.)
- Climate patterns and characteristics  
- Natural resources (lithium, oil, gas, water)
- Hydrography (rivers, lakes, coastline)
- Biodiversity and ecosystems

**Key topics**: regions, mountains, rivers, climate, resources, biodiversity

### 2. History (historia.md)
Argentina's historical development from pre-Columbian times to present:
- Pre-Columbian indigenous peoples
- Spanish colonization (1516-1810)
- Independence movement (1810-1816)
- National organization period
- Immigration era (1880-1930)
- 20th century political transformations
- Modern democracy (1983-present)

**Key topics**: independence, colonization, immigration, peronism, democracy

### 3. Culture (cultura.md)
Rich cultural expressions and traditions:
- Music and dance (tango, folklore, rock nacional)
- Literature (Borges, Cortázar, Sábato)
- Football culture and legendary figures
- Traditions (mate, asado, festivals)
- Art, architecture, and media
- Immigration influences and linguistic features

**Key topics**: tango, literature, football, traditions, immigration, language

### 4. Gastronomy (gastronomia.md)
Argentina's diverse culinary landscape:
- Traditional dishes (asado, empanadas, milanesas)
- Meat culture and preparation techniques
- Italian influences (pasta, pizza)
- Desserts and sweets (dulce de leche, alfajores)
- Beverages (mate, wine, fernet)
- Regional specialties
- Modern gastronomic trends

**Key topics**: asado, empanadas, mate, wine, regional cuisine, Italian influence

### 5. Cities (ciudades.md)
Major urban centers and their characteristics:
- Buenos Aires (capital, neighborhoods, attractions)
- Regional capitals (Córdoba, Rosario, Mendoza)
- Tourist destinations (Bariloche, Ushuaia, Salta)
- Economic centers and their specializations
- Urban planning and architecture
- Cultural and historical significance

**Key topics**: Buenos Aires, provinces, tourism, urban planning, regional characteristics

## 🔍 Sample Queries by Domain

### Geography
- ¿Cuáles son las principales regiones geográficas de Argentina?
- ¿Cuál es la montaña más alta de Argentina y cuánto mide?
- Describeme la Patagonia argentina
- ¿Qué recursos naturales tiene Argentina?

### History  
- ¿Cuándo se independizó Argentina y quiénes fueron sus principales próceres?
- ¿Qué fue el peronismo y quién fue Eva Perón?
- Contame sobre la última dictadura militar argentina
- ¿Cómo fue el proceso de inmigración europea?

### Culture
- ¿Qué es el tango y dónde nació?
- ¿Quién fue Jorge Luis Borges?
- Explicame la importancia del fútbol en la cultura argentina
- ¿Qué tradiciones son características de Argentina?

### Gastronomy
- ¿Qué es el asado argentino y por qué es tan importante?
- ¿Qué es el mate y cómo se toma?
- Describeme las empanadas argentinas y sus variaciones regionales
- ¿Por qué Argentina es famosa por sus vinos?

### Cities
- ¿Cuáles son las ciudades más importantes de Argentina?
- Contame sobre Buenos Aires, la capital argentina
- ¿Por qué Mendoza es famosa mundialmente?
- ¿Qué características tiene la ciudad de Córdoba?

### Integrated (Cross-domain)
- ¿Cómo influyó la inmigración europea en Argentina?
- ¿Qué características geográficas hacen única a Argentina?
- Resumime los aspectos más distintivos de la cultura argentina
- ¿Cómo se relacionan la geografía y la gastronomía argentina?

## 📊 Ground Truth Structure

Each query file contains entries with this structure:

```json
{
  "query": "¿Cuáles son las principales regiones geográficas de Argentina?",
  "relevantChunkIds": ["geografia-regiones-1", "geografia-regiones-2"],
  "expectedAnswer": "Las principales regiones geográficas son la Región Pampeana, la Patagonia, la Región Andina, el Noroeste Argentino, el Noreste Argentino y la Región de Cuyo.",
  "expectedKeywords": ["pampeana", "patagonia", "andes", "noroeste", "noreste", "cuyo"],
  "domain": "geografia",
  "difficulty": "easy",
  "type": "factual"
}
```

## 📋 Dataset Statistics

| Document | Words | Sections | Topics |
|----------|-------|----------|---------|
| geografia.md | ~3,200 | 12 | regions, climate, resources, hydrography |
| historia.md | ~3,500 | 15 | periods, figures, events, transformations |
| cultura.md | ~2,800 | 11 | music, literature, sports, traditions |
| gastronomia.md | ~3,000 | 13 | dishes, beverages, regions, influences |
| ciudades.md | ~2,500 | 14 | major cities, characteristics, attractions |

**Total**: ~15,000 words across 65 major sections

## 🛠️ Technical Specifications

### Content Format
- **Markup**: Standard Markdown with headers (H1-H4)
- **Structure**: Hierarchical with clear sections
- **Encoding**: UTF-8 with Spanish characters
- **Line endings**: LF (Unix style)

### Chunking Recommendations
- **Strategy**: Recursive splitting by headers then sentences
- **Max chunk size**: 500-800 characters for optimal performance
- **Overlap**: 50-100 characters between chunks
- **Preserve structure**: Maintain header context

### Embedding Considerations
- **Language**: Optimized for Spanish text
- **Model compatibility**: Works with multilingual embeddings
- **Semantic density**: High information content per chunk
- **Domain coverage**: Balanced across all topics

## 🧪 Evaluation Guidelines

### Basic Evaluation
```typescript
const metrics = await evaluator.evaluate(groundTruth);
// Expected: F1 > 0.7, Precision > 0.75, Recall > 0.7
```

### Advanced Evaluation
```typescript
const metrics = await evaluator.evaluate(groundTruth, {
  k: 10,                    // More retrieval results
  evaluateAnswers: true,    // Test answer quality
  hybrid: true,             // If using hybrid search
  rerank: true,             // If using reranking
});
```

### Performance Benchmarking
- Measure indexing time for all documents
- Track query response times across domains
- Monitor memory usage during operation
- Assess API costs for complete evaluation

## 🔧 Customization

### Adding New Content
1. Create new `.md` files following the existing structure
2. Update `metadata.json` with new document information
3. Add corresponding ground truth queries
4. Test with your RAG system

### Modifying Queries
1. Edit the appropriate query JSON files
2. Ensure `relevantChunkIds` match your chunking strategy
3. Validate expected answers and keywords
4. Run evaluation to confirm changes

### Domain-Specific Testing
Focus on specific domains by filtering queries:

```typescript
const geographyQueries = groundTruth.filter(q => q.domain === 'geografia');
const culturalQueries = groundTruth.filter(q => q.domain === 'cultura');
```

## 📚 References and Attribution

This dataset is based on factual information about Argentina and is intended for educational and research purposes. Content is compiled from public sources and formatted for RAG system evaluation.

## 📄 License

This dataset is available under the MIT License. See the main project license for details.

## 🤝 Contributing

Contributions to improve the dataset are welcome:
- Add more diverse queries
- Include additional domains
- Improve ground truth accuracy
- Enhance metadata and structure

Submit improvements via pull requests to the main Orquel repository.