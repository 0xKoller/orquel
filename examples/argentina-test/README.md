# Orquel Argentina Test - Sistema RAG con Datos Argentinos

Este ejemplo demuestra las capacidades completas de Orquel v0.1.0 usando un conjunto rico de datos sobre Argentina. Es perfecto para probar el sistema RAG con contenido real y diverso.

## 🎯 Objetivo

Demostrar cómo Orquel puede:
- ✅ **Ingestar** múltiples documentos markdown extensos
- ✅ **Chunking inteligente** de contenido estructurado
- ✅ **Indexación** con embeddings de OpenAI
- ✅ **Búsqueda semántica** precisa y relevante
- ✅ **Generación de respuestas** con contexto y citaciones
- ✅ **Funcionamiento completo** de extremo a extremo

## 📁 Estructura del Proyecto

```
examples/argentina-test/
├── src/
│   └── index.ts           # Script principal de demostración
├── data/                  # Documentos fuente sobre Argentina
│   ├── geografia.md       # Geografía: regiones, clima, recursos
│   ├── cultura.md         # Cultura: tango, literatura, fútbol
│   ├── historia.md        # Historia: independencia, peronismo, democracia
│   ├── gastronomia.md     # Gastronomía: asado, mate, vinos
│   └── ciudades.md        # Ciudades: Buenos Aires, Córdoba, etc.
├── package.json           # Dependencias de Orquel
├── tsconfig.json          # Configuración TypeScript
├── .env.example           # Plantilla de variables de entorno
└── README.md              # Este archivo
```

## 🚀 Configuración Rápida

### 1. Instalar Dependencias
```bash
cd examples/argentina-test
pnpm install
```

### 2. Configurar OpenAI API Key
```bash
# Copiar la plantilla
cp .env.example .env

# Editar .env y agregar tu API key
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

> 💡 **Obtén tu API key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 3. Ejecutar la Demo
```bash
pnpm dev
```

## 🎬 ¿Qué Verás?

La demo ejecutará un flujo completo:

### Fase 1: Carga de Datos 📚
```
🇦🇷 Cargando datos sobre Argentina...

📄 Procesando: Geografía de Argentina...
✅ 45 chunks indexados de Geografía de Argentina

📄 Procesando: Cultura Argentina...
✅ 52 chunks indexados de Cultura Argentina

... (continúa con todos los archivos)
```

### Fase 2: Consultas Inteligentes 🧠
La demo ejecuta 18 preguntas sobre Argentina, mostrando:

**Búsqueda Semántica:**
```
🔎 Buscando información relevante...
📊 Encontrados 5 chunks relevantes:
   1. Geografía de Argentina (score: 0.847)
   2. Historia de Argentina (score: 0.782)
   ...
```

**Generación de Respuestas:**
```
💡 Respuesta:
Argentina se independizó el 9 de julio de 1816 durante el Congreso de Tucumán. 
Los principales próceres fueron José de San Martín (El Libertador), Manuel 
Belgrano (creador de la bandera) y Martín Miguel de Güemes (héroe gaucho)...

📚 Basado en 3 fragmentos de:
   • Historia de Argentina
   • Cultura Argentina
```

### Fase 3: Estadísticas 📈
```
📈 ESTADÍSTICAS DE LA DEMO
🎯 Base de conocimiento creada exitosamente
📁 5 documentos sobre Argentina procesados
🧠 Sistema RAG funcional con datos reales
✨ Búsqueda semántica y generación de respuestas activas
```

## 🔍 Preguntas de Ejemplo

La demo incluye preguntas diversas sobre:

### Geografía 🗺️
- "¿Cuáles son las principales regiones geográficas de Argentina?"
- "¿Cuál es la montaña más alta de Argentina y cuánto mide?"
- "Describeme la Patagonia argentina"

### Historia 📜
- "¿Cuándo se independizó Argentina y quiénes fueron sus principales próceres?"
- "¿Qué fue el peronismo y quién fue Eva Perón?"
- "Contame sobre la última dictadura militar argentina"

### Cultura 🎭
- "¿Qué es el tango y dónde nació?"
- "¿Quién fue Jorge Luis Borges?"
- "Explicame la importancia del fútbol en la cultura argentina"

### Gastronomía 🥩
- "¿Qué es el asado argentino y por qué es tan importante?"
- "¿Qué es el mate y cómo se toma?"
- "Describeme las empanadas argentinas y sus variaciones regionales"

### Ciudades 🏙️
- "¿Cuáles son las ciudades más importantes de Argentina?"
- "Contame sobre Buenos Aires, la capital argentina"
- "¿Por qué Mendoza es famosa mundialmente?"

## 🧪 Experimentación

### Agregar Más Contenido
1. Crea nuevos archivos `.md` en el directorio `data/`
2. El script los cargará automáticamente
3. Formatos soportados: Markdown con headers, párrafos, listas

### Hacer Tus Propias Preguntas
Modifica el array `queries` en `src/index.ts`:
```typescript
const queries = [
  'Tu pregunta personalizada aquí',
  '¿Qué otros temas te interesan?',
  // ...
];
```

### Ajustar Parámetros
```typescript
// Más resultados en búsqueda
const { results } = await orq.query(query, { k: 10 });

// Más contexto para respuestas
const { answer } = await orq.answer(query, { topK: 5 });
```

## 📊 Información Técnica

### Datos Incluidos
- **~15,000 palabras** de contenido sobre Argentina
- **~200 chunks** después del procesamiento
- **Contenido estructurado** con headers y párrafos
- **Temas diversos** para probar capacidades cross-domain

### Configuración de Orquel
```typescript
const orq = createOrquel({
  embeddings: openAIEmbeddings(),    // text-embedding-3-small
  vector: memoryStore(),             // Almacenamiento en memoria
  answerer: openAIAnswerer(),        // gpt-4o-mini para respuestas
});
```

### Métricas Esperadas
- **Tiempo de indexación**: ~30-60 segundos
- **Tiempo por pregunta**: ~2-5 segundos
- **Costos OpenAI**: ~$0.10-0.20 por ejecución completa
- **Precisión**: Alta gracias a contenido estructurado

## 🚨 Resolución de Problemas

### Error: API Key no configurada
```
❌ Error: OPENAI_API_KEY no está configurada
```
**Solución**: Asegúrate de copiar `.env.example` a `.env` y agregar tu API key válida.

### Error: 401 Unauthorized
```
🔑 Problema de autenticación con OpenAI
```
**Solución**: Verifica que tu API key sea válida y tengas créditos disponibles.

### Error: Rate limit exceeded
```
⏱️  Límite de tasa alcanzado
```
**Solución**: Espera unos minutos o considera un plan de OpenAI de mayor capacidad.

### Instalación de dependencias
Si encuentras problemas con `pnpm install`:
```bash
# Desde la raíz del proyecto
pnpm build

# Luego en el directorio del ejemplo
cd examples/argentina-test
pnpm install
```

## 🎓 Casos de Uso Similares

Este ejemplo es perfecto como base para:

### 📚 Base de Conocimientos Empresarial
- Reemplaza `data/` con documentación interna
- Ajusta las preguntas a casos de uso específicos

### 🎓 Sistema Educativo
- Carga contenido académico
- Genera preguntas de evaluación automáticas

### 📖 Asistente de Investigación
- Procesa papers o artículos
- Genera resúmenes y responde consultas específicas

### 🌐 Sitio Web Inteligente
- Indexa contenido web
- Implementa chat inteligente con tu información

## 🔗 Próximos Pasos

Después de probar esta demo, considera:

1. **Explorar otros adapters**: pgvector, Qdrant para producción
2. **Implementar en tu aplicación**: Integra con tu stack existente  
3. **Escalar a producción**: Usa las guías en `NEXT-STEPS.md`
4. **Contribuir al proyecto**: Agrega nuevos adapters o ejemplos

## 📞 Soporte

- 📖 **Documentación**: [docs/](../../docs/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/0xkoller/orquel/issues)
- 💬 **Discusiones**: [GitHub Discussions](https://github.com/0xkoller/orquel/discussions)

---

¡Disfruta explorando las capacidades de Orquel con datos reales sobre Argentina! 🇦🇷✨