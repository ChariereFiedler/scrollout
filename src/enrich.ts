/**
 * ECHA Enrichment CLI — Enrichit les posts non enrichis dans la base.
 *
 * Usage:
 *   npx tsx src/enrich.ts                    # Ollama (défaut), batch 20
 *   npx tsx src/enrich.ts --rules-only       # Rules seulement (pas de LLM)
 *   npx tsx src/enrich.ts --openai           # Utilise OpenAI
 *   npx tsx src/enrich.ts --batch 50         # Batch de 50
 *   npx tsx src/enrich.ts --dry-run          # Ne persiste pas
 *   npx tsx src/enrich.ts --post-id "xxx"    # Enrichit un post spécifique
 */
import 'dotenv/config';
import { enrichBatch } from './enrichment/pipeline';
import { createOllamaProvider } from './enrichment/llm/ollama';
import { createOpenAIProvider } from './enrichment/llm/openai';

async function main() {
  const args = process.argv.slice(2);

  const useOpenAI = args.includes('--openai');
  const rulesOnly = args.includes('--rules-only');
  const dryRun = args.includes('--dry-run');

  const batchIdx = args.indexOf('--batch');
  const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : 20;

  const postIdIdx = args.indexOf('--post-id');
  const postIds = postIdIdx !== -1 ? [args[postIdIdx + 1]] : undefined;

  // Choisir le provider
  let llmProvider;
  if (rulesOnly) {
    // Dummy provider (ne sera pas appelé)
    llmProvider = createOllamaProvider();
    console.log('[enrich] Mode rules-only (pas de LLM)');
  } else if (useOpenAI) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[enrich] OPENAI_API_KEY non défini dans .env');
      process.exit(1);
    }
    llmProvider = createOpenAIProvider();
    console.log('[enrich] Provider: OpenAI (gpt-4o-mini)');
  } else {
    llmProvider = createOllamaProvider();
    console.log('[enrich] Provider: Ollama (llama3.1:8b)');
  }

  console.log(`[enrich] Batch: ${batchSize}, dryRun: ${dryRun}`);

  const result = await enrichBatch({
    llmProvider,
    batchSize,
    rulesOnly,
    dryRun,
    postIds,
    delayMs: useOpenAI ? 200 : 100, // Ollama local = pas de rate limit strict
  });

  console.log(`[enrich] Résultat final:`, result);
  process.exit(0);
}

main().catch(err => {
  console.error('[enrich] Fatal:', err);
  process.exit(1);
});
