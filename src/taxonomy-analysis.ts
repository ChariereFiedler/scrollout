/**
 * Analyse de la taxonomie 5 niveaux sur les posts enrichis existants.
 * Re-classifie tous les posts avec le nouveau système multi-niveaux
 * et compare avec l'enrichissement stocké.
 */
import prisma from './db/client';
import { getTaxonomyStats, getAllPreciseSubjects, getPreciseSubjectsForTheme } from './enrichment/dictionaries';
import { applyRules } from './enrichment/rules-engine';

interface AnalysisRow {
  postId: string;
  username: string;
  textPreview: string;
  storedTopics: string[];
  newDomains: string[];
  newThemes: string[];
  newSubjects: { id: string; label: string; themeId: string }[];
  candidatePreciseSubjects: { id: string; statement: string }[];
  politicalScore: number;
  polarizationScore: number;
}

async function main() {
  // ── Stats taxonomie ──
  const stats = getTaxonomyStats();
  console.log('\n═══ TAXONOMIE 5 NIVEAUX — STATS ═══');
  console.log(`  Domaines:         ${stats.domains}`);
  console.log(`  Thèmes:           ${stats.themes}`);
  console.log(`  Sujets:           ${stats.subjects}`);
  console.log(`  Sujets précis:    ${stats.preciseSubjects}`);
  console.log(`  Total positions:  ${getAllPreciseSubjects().reduce((sum, ps) => sum + ps.knownPositions.length, 0)}`);

  // ── Charger tous les posts enrichis avec leur post parent ──
  const enriched = await prisma.postEnriched.findMany({
    include: { post: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`\n═══ ANALYSE SUR ${enriched.length} POSTS ENRICHIS ═══\n`);

  const rows: AnalysisRow[] = [];
  const domainDistrib: Record<string, number> = {};
  const themeDistrib: Record<string, number> = {};
  const subjectDistrib: Record<string, number> = {};
  const preciseSubjectHits: Record<string, { count: number; statement: string }> = {};
  let postsWithSubjects = 0;
  let postsWithPreciseCandidates = 0;

  for (const pe of enriched) {
    const post = pe.post;
    const text = pe.normalizedText || `${post.caption} ${post.imageDesc} ${post.allText}`;
    const hashtags: string[] = (() => { try { return JSON.parse(post.hashtags); } catch { return []; } })();
    const storedTopics: string[] = (() => { try { return JSON.parse(pe.mainTopics); } catch { return []; } })();

    // Re-classify with new taxonomy
    const result = classifyTopicsEnriched(text);
    const rulesResult = applyRules({ normalizedText: text, hashtags, username: post.username });

    // Domain distribution
    for (const d of result.domains) {
      domainDistrib[d.id] = (domainDistrib[d.id] || 0) + 1;
    }

    // Theme distribution
    for (const t of result.themes) {
      themeDistrib[t.id] = (themeDistrib[t.id] || 0) + 1;
    }

    // Subject distribution
    for (const s of result.subjects) {
      subjectDistrib[s.id] = (subjectDistrib[s.id] || 0) + 1;
    }
    if (result.subjects.length > 0) postsWithSubjects++;

    // Precise subject candidates
    const candidatePs: { id: string; statement: string }[] = [];
    for (const tId of rulesResult.mainTopics) {
      const ps = getPreciseSubjectsForTheme(tId);
      for (const p of ps) {
        candidatePs.push({ id: p.id, statement: p.statement });
        preciseSubjectHits[p.id] = preciseSubjectHits[p.id] || { count: 0, statement: p.statement };
        preciseSubjectHits[p.id].count++;
      }
    }
    if (candidatePs.length > 0) postsWithPreciseCandidates++;

    rows.push({
      postId: post.id,
      username: post.username,
      textPreview: text.substring(0, 80).replace(/\n/g, ' '),
      storedTopics,
      newDomains: result.domains.map(d => d.id),
      newThemes: result.themes.map(t => t.id),
      newSubjects: result.subjects.slice(0, 5).map(s => ({ id: s.id, label: s.label, themeId: s.themeId })),
      candidatePreciseSubjects: candidatePs.slice(0, 5),
      politicalScore: pe.politicalExplicitnessScore,
      polarizationScore: pe.polarizationScore,
    });
  }

  // ── Résultats globaux ──
  console.log('─── COUVERTURE ───');
  console.log(`  Posts avec sujets détectés:           ${postsWithSubjects}/${enriched.length} (${Math.round(postsWithSubjects/enriched.length*100)}%)`);
  console.log(`  Posts avec sujets précis candidats:   ${postsWithPreciseCandidates}/${enriched.length} (${Math.round(postsWithPreciseCandidates/enriched.length*100)}%)`);

  console.log('\n─── DISTRIBUTION DOMAINES ───');
  const sortedDomains = Object.entries(domainDistrib).sort((a, b) => b[1] - a[1]);
  for (const [id, count] of sortedDomains) {
    const bar = '█'.repeat(Math.round(count / enriched.length * 40));
    console.log(`  ${id.padEnd(25)} ${String(count).padStart(4)} ${bar}`);
  }

  console.log('\n─── TOP 15 THÈMES ───');
  const sortedThemes = Object.entries(themeDistrib).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [id, count] of sortedThemes) {
    const bar = '█'.repeat(Math.round(count / enriched.length * 40));
    console.log(`  ${id.padEnd(25)} ${String(count).padStart(4)} ${bar}`);
  }

  console.log('\n─── TOP 20 SUJETS ───');
  const sortedSubjects = Object.entries(subjectDistrib).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [id, count] of sortedSubjects) {
    const bar = '█'.repeat(Math.round(count / enriched.length * 40));
    console.log(`  ${id.padEnd(30)} ${String(count).padStart(4)} ${bar}`);
  }

  console.log('\n─── SUJETS PRÉCIS CANDIDATS (top 15) ───');
  const sortedPs = Object.entries(preciseSubjectHits).sort((a, b) => b[1].count - a[1].count).slice(0, 15);
  for (const [id, { count, statement }] of sortedPs) {
    console.log(`  ${id.padEnd(35)} ${String(count).padStart(3)}x  "${statement.substring(0, 60)}"`);
  }

  // ── Échantillons détaillés (10 posts intéressants) ──
  console.log('\n─── ÉCHANTILLONS DÉTAILLÉS ───');
  const interesting = rows
    .filter(r => r.newSubjects.length > 0)
    .sort((a, b) => b.candidatePreciseSubjects.length - a.candidatePreciseSubjects.length)
    .slice(0, 10);

  for (const r of interesting) {
    console.log(`\n  @${r.username} [pol=${r.politicalScore} polar=${r.polarizationScore}]`);
    console.log(`  "${r.textPreview}..."`);
    console.log(`  Domaines: ${r.newDomains.join(', ')}`);
    console.log(`  Thèmes:   ${r.newThemes.join(', ')}`);
    console.log(`  Sujets:   ${r.newSubjects.map(s => s.id).join(', ')}`);
    if (r.candidatePreciseSubjects.length > 0) {
      console.log(`  Sujets précis candidats:`);
      for (const ps of r.candidatePreciseSubjects) {
        console.log(`    → ${ps.id}: "${ps.statement.substring(0, 70)}"`);
      }
    }
  }

  // ── Sujets jamais matchés ──
  const allPs = getAllPreciseSubjects();
  const unmatchedPs = allPs.filter(ps => !preciseSubjectHits[ps.id]);
  console.log(`\n─── SUJETS PRÉCIS JAMAIS MATCHÉS (${unmatchedPs.length}/${allPs.length}) ───`);
  for (const ps of unmatchedPs.slice(0, 15)) {
    console.log(`  ${ps.id.padEnd(35)} "${ps.statement.substring(0, 60)}"`);
  }

  // ── Sujets thème-level jamais matchés ──
  const allSubjectIds = new Set(Object.keys(subjectDistrib));
  const allSubjects: { id: string; themeId: string }[] = [];
  const { THEMES } = await import('./enrichment/dictionaries/taxonomy');
  for (const t of THEMES) {
    for (const s of t.subjects) {
      allSubjects.push({ id: s.id, themeId: t.id });
    }
  }
  const unmatchedSubjects = allSubjects.filter(s => !allSubjectIds.has(s.id));
  console.log(`\n─── SUJETS (LVL 3) JAMAIS MATCHÉS (${unmatchedSubjects.length}/${allSubjects.length}) ───`);
  for (const s of unmatchedSubjects.slice(0, 20)) {
    console.log(`  ${s.themeId.padEnd(20)} → ${s.id}`);
  }

  console.log('\n═══ FIN ANALYSE ═══\n');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
