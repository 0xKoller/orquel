import 'dotenv/config';
import { createOrquel, OrquelUtils } from '@orquel/core';
import { openAIEmbeddings } from '@orquel/embeddings-openai';
import { memoryStore } from '@orquel/store-memory';
import { openAIAnswerer } from '@orquel/answer-openai';
import { readFileSync } from 'fs';
import { join } from 'path';

const orq = createOrquel({
  embeddings: openAIEmbeddings(),
  vector: memoryStore(),
  answerer: openAIAnswerer(),
  debug: process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true'
});

async function loadArgentineData() {
  console.log('🇦🇷 Cargando datos sobre Argentina...\n');

  const dataFiles = [
    { file: 'geografia.md', title: 'Geografía de Argentina' },
    { file: 'cultura.md', title: 'Cultura Argentina' },
    { file: 'historia.md', title: 'Historia de Argentina' },
    { file: 'gastronomia.md', title: 'Gastronomía Argentina' },
    { file: 'ciudades.md', title: 'Ciudades de Argentina' },
  ];

  let totalChunks = 0;

  for (const { file, title } of dataFiles) {
    console.log(`📄 Procesando: ${title}...`);
    
    const content = readFileSync(join(process.cwd(), 'data', file), 'utf-8');
    
    const { chunks } = await orq.ingest({
      source: { title, kind: 'md' },
      content
    });

    await orq.index(chunks);
    
    console.log(`✅ ${chunks.length} chunks indexados de ${title}`);
    totalChunks += chunks.length;
  }

  console.log(`\n🎯 Total: ${totalChunks} chunks sobre Argentina indexados exitosamente\n`);
  return totalChunks;
}

async function runQueries() {
  console.log('🔍 Realizando consultas sobre Argentina...\n');

  const queries = [
    // Geografía
    '¿Cuáles son las principales regiones geográficas de Argentina?',
    '¿Cuál es la montaña más alta de Argentina y cuánto mide?',
    'Describeme la Patagonia argentina',
    
    // Historia
    '¿Cuándo se independizó Argentina y quiénes fueron sus principales próceres?',
    '¿Qué fue el peronismo y quién fue Eva Perón?',
    'Contame sobre la última dictadura militar argentina',
    
    // Cultura
    '¿Qué es el tango y dónde nació?',
    '¿Quién fue Jorge Luis Borges?',
    'Explicame la importancia del fútbol en la cultura argentina',
    
    // Gastronomía
    '¿Qué es el asado argentino y por qué es tan importante?',
    '¿Qué es el mate y cómo se toma?',
    'Describeme las empanadas argentinas y sus variaciones regionales',
    
    // Ciudades
    '¿Cuáles son las ciudades más importantes de Argentina?',
    'Contame sobre Buenos Aires, la capital argentina',
    '¿Por qué Mendoza es famosa mundialmente?',
    
    // Preguntas integradoras
    '¿Cómo influyó la inmigración europea en Argentina?',
    '¿Qué características geográficas hacen única a Argentina?',
    'Resumime los aspectos más distintivos de la cultura argentina',
  ];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 Pregunta ${i + 1}/${queries.length}`);
    console.log(`❓ ${query}`);
    console.log(`${'='.repeat(80)}`);
    
    try {
      // Búsqueda semántica
      console.log(`🔎 Buscando información relevante...`);
      const { results } = await orq.query(query, { k: 5 });
      
      console.log(`📊 Encontrados ${results.length} chunks relevantes:`);
      console.log(OrquelUtils.formatSearchResults(results).split('\n').map(line => `   ${line}`).join('\n'));

      // Generación de respuesta
      console.log(`🤖 Generando respuesta...`);
      const { answer, contexts } = await orq.answer(query, { topK: 3 });
      
      console.log(`\n💡 Respuesta:`);
      console.log(`${answer}\n`);
      
      console.log(`📚 ${OrquelUtils.summarizeContexts(contexts)}`);

    } catch (error) {
      console.error(`❌ Error procesando la pregunta: ${error}`);
      
      // Provide helpful error suggestions
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.log('💡 Sugerencia: Verifica tu OpenAI API key');
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          console.log('💡 Sugerencia: Has alcanzado el límite de tasa, espera un momento');
        } else if (error.message.includes('chunk')) {
          console.log('💡 Sugerencia: Posible problema con la estructura de datos');
          console.log('🔧 Activando inspección de chunks...');
          
          // Try to inspect a chunk if available from a previous query
          try {
            const { results } = await orq.query("test", { k: 1 });
            if (results.length > 0) {
              OrquelUtils.inspectChunk(results[0].chunk);
            }
          } catch (inspectionError) {
            console.log('⚠️  No se pudo inspeccionar la estructura de chunks');
          }
        }
      }
    }
    
    // Pausa pequeña entre preguntas para no saturar la API
    if (i < queries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function displayStatistics() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('📈 ESTADÍSTICAS DE LA DEMO');
  console.log(`${'='.repeat(80)}`);
  
  // Simular estadísticas básicas
  console.log('🎯 Base de conocimiento creada exitosamente');
  console.log('📁 5 documentos sobre Argentina procesados');
  console.log('🧠 Sistema RAG funcional con datos reales');
  console.log('✨ Búsqueda semántica y generación de respuestas activas');
  console.log('\n🎉 ¡Demo de Orquel completada exitosamente!');
  console.log('\n🔗 Para continuar:');
  console.log('   • Experimenta con tus propias preguntas');
  console.log('   • Agrega más documentos al directorio data/');
  console.log('   • Explora otros adapters de Orquel');
}

async function main() {
  console.log('🚀 DEMO DE ORQUEL - SISTEMA RAG CON DATOS ARGENTINOS');
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Verificar variables de entorno
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Error: OPENAI_API_KEY no está configurada');
      console.log('📋 Para continuar:');
      console.log('   1. Copia .env.example a .env');
      console.log('   2. Agrega tu OpenAI API key');
      console.log('   3. Ejecuta nuevamente con: pnpm dev');
      process.exit(1);
    }

    console.log('✅ OpenAI API Key configurada correctamente\n');

    // Cargar datos
    await loadArgentineData();
    
    // Realizar consultas
    await runQueries();
    
    // Mostrar estadísticas
    await displayStatistics();

  } catch (error) {
    console.error('\n❌ Error durante la ejecución:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        console.log('\n🔑 Problema de autenticación con OpenAI:');
        console.log('   • Verifica que tu API key sea válida');
        console.log('   • Asegúrate de tener créditos disponibles');
      } else if (error.message.includes('rate limit')) {
        console.log('\n⏱️  Límite de tasa alcanzado:');
        console.log('   • Espera un momento y vuelve a intentar');
        console.log('   • Considera usar un plan de mayor capacidad');
      }
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('💥 Error crítico:', error);
  process.exit(1);
});