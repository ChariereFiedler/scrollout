/**
 * Scrollout Visualizer — Client-side dashboard with tabs.
 */

// ─── State ───────────────────────────────────────────────────────────

const state = {
  ws: null,
  connected: false,
  eventCount: 0,
  postCount: 0,
  errorCount: 0,
  mlkitCount: 0,
  startTime: Date.now(),
  focusedPost: null,
  focusedDwellMs: 0,
  focusedDwellStart: 0,
  mlkitResults: new Map(),
  trackerData: new Map(),
  enrichmentData: new Map(),
  enrichmentCount: 0,
  streamEntries: [],
  maxStreamEntries: 500,
  lastNodes: [],
  // Timeline state
  allPosts: new Map(),
  timelineSort: 'time',
  // Mobile state
  mobileConnected: false,
  mobileStats: null,
  // Active tab
  activeTab: 'live',
};

// ─── DOM refs ────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const dom = {
  statPosts: $('stat-posts'),
  statEvents: $('stat-events'),
  statDuration: $('stat-duration'),
  statEps: $('stat-eps'),
  statMlkit: $('stat-mlkit'),
  statErrors: $('stat-errors'),
  adbDot: $('adb-dot'),
  adbLabel: $('adb-label'),
  mobileDot: $('mobile-dot'),
  mobileLabel: $('mobile-label'),
  focusedPostBody: $('focused-post-body'),
  focusedPostCount: $('focused-post-count'),
  streamBody: $('stream-body'),
  streamCount: $('stream-count'),
  enrichmentBody: $('enrichment-body'),
  enrichmentCount: $('enrichment-count'),
  analysisBody: $('analysis-body'),
  analysisPostId: $('analysis-post-id'),
  qParse: $('q-parse'),
  qParseDot: $('q-parse-dot'),
  qChunks: $('q-chunks'),
  qChunkDot: $('q-chunk-dot'),
  qFields: $('q-fields'),
  qFieldsDot: $('q-fields-dot'),
  qMlkit: $('q-mlkit'),
  qMlkitDot: $('q-mlkit-dot'),
  qEnrich: $('q-enrich'),
  qEnrichDot: $('q-enrich-dot'),
  timelineBody: $('timeline-body'),
  timelineTotal: $('timeline-total'),
  sessionsBody: $('sessions-body'),
  statsBody: $('stats-body'),
  mobileHeroDot: $('mobile-hero-dot'),
  mobileHeroTitle: $('mobile-hero-title'),
  mobileHeroSub: $('mobile-hero-sub'),
  mobileStatsBody: $('mobile-stats-body'),
  tabLiveBadge: $('tab-live-badge'),
  tabTimelineBadge: $('tab-timeline-badge'),
};

// ─── Tab navigation ─────────────────────────────────────────────────

document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === state.activeTab) return;

    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const page = $(`page-${tab}`);
    if (page) page.classList.add('active');
    state.activeTab = tab;

    if (tab === 'sessions') fetchSessions();
    if (tab === 'stats') fetchStats();
    if (tab === 'timeline') renderTimeline();
    if (tab === 'enriched') fetchEnrichedPosts();
    if (tab === 'mobile') renderMobilePage();
  });
});

// ─── WebSocket ───────────────────────────────────────────────────────

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(`${protocol}//${location.host}`);

  state.ws.onopen = () => {
    state.connected = true;
    updateAdbStatus('connected');
  };

  state.ws.onclose = () => {
    state.connected = false;
    updateAdbStatus('disconnected');
    setTimeout(connect, 2000);
  };

  state.ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleMessage(msg);
    } catch { /* ignore */ }
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'event':
      handleEvent(msg.data, msg.source);
      break;
    case 'mlkit':
      handleMLKit(msg.data);
      break;
    case 'summary':
      addStreamEntry('summary', formatSummary(msg.data));
      break;
    case 'raw':
      break;
    case 'error':
      state.errorCount++;
      dom.statErrors.textContent = state.errorCount;
      addStreamEntry('error', msg.message);
      break;
    case 'quality':
      updateQuality(msg.metrics);
      break;
    case 'status':
      if (msg.adb) updateAdbStatus(msg.adb);
      if (msg.mobile) updateMobileStatus(msg.mobile, msg.stats);
      break;
    case 'mobile-session-start':
      addStreamEntry('event', `[MOBILE] Session started: ${msg.data?.sessionId} (${msg.data?.captureMode})`);
      break;
    case 'mobile-session-end':
      addStreamEntry('summary', `[MOBILE] Session ended: ${msg.data?.totalPosts} posts, ${msg.data?.durationSec?.toFixed(0)}s`);
      break;
    case 'tracker':
      handleTracker(msg.data);
      break;
    case 'enrichment':
      handleEnrichment(msg.postId, msg.data);
      break;
    case 'db-update':
      break;
    case 'post-detail':
      handlePostDetail(msg.postId, msg.data);
      break;
  }
}

// ─── Full post detail from DB (GPT + MLKit) ─────────────────────────

const postDetailCache = new Map(); // postId → full post + enrichment from DB

function requestPostDetail(postId) {
  if (postDetailCache.has(postId)) return;
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: 'request-post-detail', postId }));
  }
}

function handlePostDetail(postId, data) {
  if (!data) return;
  postDetailCache.set(postId, data);

  // Merge enrichment from DB into enrichmentData (GPT fields not sent via real-time WS)
  if (data.enrichment) {
    const existing = state.enrichmentData.get(postId) || {};
    const e = data.enrichment;
    state.enrichmentData.set(postId, {
      ...existing,
      // Preserve real-time fields, add DB-only fields
      provider: e.provider,
      model: e.model,
      semanticSummary: e.semanticSummary,
      normalizedText: e.normalizedText || existing.normalizedText,
      keywordTerms: jsonParse(e.keywordTerms),
      domains: jsonParse(e.domains),
      mainTopics: jsonParse(e.mainTopics) || existing.mainTopics,
      secondaryTopics: jsonParse(e.secondaryTopics) || existing.secondaryTopics,
      subjects: jsonParse(e.subjects),
      preciseSubjects: jsonParse(e.preciseSubjects),
      contentDomain: e.contentDomain,
      audienceTarget: e.audienceTarget,
      persons: jsonParse(e.persons),
      organizations: jsonParse(e.organizations),
      institutions: jsonParse(e.institutions) || existing.institutions,
      countries: jsonParse(e.countries),
      locations: jsonParse(e.locations),
      politicalActors: jsonParse(e.politicalActors) || existing.politicalActors,
      tone: e.tone,
      primaryEmotion: e.primaryEmotion,
      emotionIntensity: e.emotionIntensity,
      politicalScore: e.politicalExplicitnessScore ?? existing.politicalScore,
      politicalIssueTags: jsonParse(e.politicalIssueTags) || existing.politicalIssueTags,
      publicPolicyTags: jsonParse(e.publicPolicyTags),
      institutionalReferenceScore: e.institutionalReferenceScore,
      activismSignal: e.activismSignal ?? existing.activismSignal,
      polarizationScore: e.polarizationScore ?? existing.polarizationScore,
      ingroupOutgroupSignal: e.ingroupOutgroupSignal ?? existing.ingroupOutgroupSignal,
      conflictSignal: e.conflictSignal ?? existing.conflictSignal,
      moralAbsoluteSignal: e.moralAbsoluteSignal ?? existing.moralAbsoluteSignal,
      enemyDesignationSignal: e.enemyDesignationSignal ?? existing.enemyDesignationSignal,
      politicalAxes: {
        economic: e.axisEconomic ?? existing.politicalAxes?.economic ?? 0,
        societal: e.axisSocietal ?? existing.politicalAxes?.societal ?? 0,
        authority: e.axisAuthority ?? existing.politicalAxes?.authority ?? 0,
        system: e.axisSystem ?? existing.politicalAxes?.system ?? 0,
      },
      dominantAxis: e.dominantAxis || existing.dominantAxis,
      mediaCategory: e.mediaCategory || existing.mediaCategory,
      mediaQuality: e.mediaQuality || existing.mediaQuality,
      narrativeFrame: e.narrativeFrame,
      callToActionType: e.callToActionType,
      problemSolutionPattern: e.problemSolutionPattern,
      confidenceScore: e.confidenceScore ?? existing.confidenceScore,
      reviewFlag: e.reviewFlag,
      reviewReason: e.reviewReason,
      audioTranscription: e.audioTranscription,
      mediaMessage: e.mediaMessage,
      mediaIntent: e.mediaIntent,
      language: existing.language,
    });
  }

  // Merge MLKit data from Post model into mlkitResults
  if (data.ocrText || data.mlkitLabels) {
    const existing = state.mlkitResults.get(postId) || {};
    state.mlkitResults.set(postId, {
      ...existing,
      postId,
      ocrText: data.ocrText || existing.ocrText || '',
      labels: jsonParse(data.mlkitLabels) || existing.labels || [],
      subtitles: data.subtitles || '',
    });
  }

  // Re-render if focused
  if (state.focusedPost?.postId === postId) {
    renderEnrichmentForPost(postId);
    renderAnalysisDetail(postId);
  }
}

function jsonParse(str) {
  if (!str || str === '[]' || str === '""') return [];
  if (Array.isArray(str)) return str;
  try { return JSON.parse(str); } catch { return []; }
}

// ─── Event handling ──────────────────────────────────────────────────

function handleEvent(event, source) {
  state.eventCount++;
  dom.statEvents.textContent = state.eventCount;

  if (event.focusedPost) {
    const post = event.focusedPost;
    const postId = event.focusedPostId || post.postId || post.username;

    if (state.focusedPost?.postId !== postId) {
      state.postCount++;
      dom.statPosts.textContent = state.postCount;
      state.focusedDwellStart = Date.now();
    }

    state.focusedPost = { ...post, postId };
    state.focusedDwellMs = event.dwellTimes?.[event.focusedPostId] || 0;

    // Track in allPosts for timeline
    const existing = state.allPosts.get(postId) || {};
    state.allPosts.set(postId, {
      ...existing,
      postId,
      username: post.username,
      caption: post.caption || existing.caption,
      imageDescription: post.imageDescription,
      mediaType: post.mediaType,
      isSponsored: post.isSponsored,
      isSuggested: post.isSuggested,
      dwellTimeMs: state.focusedDwellMs || existing.dwellTimeMs || 0,
      firstSeen: existing.firstSeen || Date.now(),
      lastSeen: Date.now(),
      source: source || 'logcat',
    });

    renderFocusedPost();
    renderEnrichmentForPost(postId);
    renderAnalysisDetail(postId);
    requestPostDetail(postId); // Fetch full GPT + MLKit data from DB

    dom.tabLiveBadge.textContent = state.eventCount;
    dom.tabTimelineBadge.textContent = state.allPosts.size;

    const sponsored = post.isSponsored ? ' [AD]' : '';
    const suggested = post.isSuggested ? ' [SUG]' : '';
    const src = source === 'mobile' ? '[M] ' : '';
    addStreamEntry('event', `${src}@${post.username} ${post.mediaType}${sponsored}${suggested} — ${(post.imageDescription || '').substring(0, 60)}`);
  } else {
    addStreamEntry('event', `${event.eventType} | ${event.screenType} | ${event.nodeCount} nodes`);
  }

  if (event.nodes && event.nodes.length > 0) {
    state.lastNodes = event.nodes;
  }
}

function handleMLKit(data) {
  state.mlkitCount++;
  dom.statMlkit.textContent = state.mlkitCount;
  state.mlkitResults.set(data.postId, data);

  const labelText = (data.labels || []).map(l => l.text).join(', ');
  addStreamEntry('mlkit', `${data.postId}: ${labelText || 'OCR only'} (${data.processingMs}ms)`);

  if (state.focusedPost?.postId === data.postId) {
    renderEnrichmentForPost(data.postId);
  }
}

function handleEnrichment(postId, data) {
  state.enrichmentData.set(postId, data);
  state.enrichmentCount++;
  dom.enrichmentCount.textContent = state.enrichmentCount;

  const existing = state.allPosts.get(postId);
  if (existing) {
    existing.enrichment = data;
    state.allPosts.set(postId, existing);
  }

  const topics = (data.mainTopics || []).join(', ');
  const polScore = data.politicalScore || 0;
  const mediaCat = data.mediaCategory ? ` | ${data.mediaCategory}` : '';
  addStreamEntry('enrich', `${topics || 'aucun theme'} | pol:${polScore}/4 | polar:${(data.polarizationScore || 0).toFixed(2)}${mediaCat}`);

  if (state.focusedPost?.postId === postId) {
    renderEnrichmentForPost(postId);
    renderAnalysisDetail(postId);
  }
}

function handleTracker(data) {
  if (!data || !data.post) return;
  const p = data.post;
  const d = p.data || {};
  state.trackerData.set(p.postId, {
    imageUrls: d.imageUrls || [],
    imageAlts: d.imageAlts || [],
    fullCaption: d.fullCaption || '',
    videoUrl: d.videoUrl || '',
    location: d.location || '',
    hashtags: d.hashtags || [],
  });

  const existing = state.allPosts.get(p.postId);
  if (existing) {
    existing.caption = d.fullCaption || existing.caption;
    existing.hashtags = d.hashtags;
    existing.location = d.location;
    state.allPosts.set(p.postId, existing);
  }

  if (state.focusedPost?.postId === p.postId) {
    renderFocusedPost();
  }
}

// ─── Render: Focused Post ────────────────────────────────────────────

function renderFocusedPost() {
  const post = state.focusedPost;
  if (!post) return;

  const dwellMs = state.focusedDwellMs || (Date.now() - state.focusedDwellStart);
  const dwellSec = (dwellMs / 1000).toFixed(1);
  const attn = classifyAttention(dwellMs);

  const mlkit = state.mlkitResults.get(post.postId);
  const tracker = state.trackerData.get(post.postId);

  let imagesHtml = '';
  if (tracker?.imageUrls?.length) {
    imagesHtml = `<div style="display:flex;gap:4px;margin:8px 0;overflow-x:auto">
      ${tracker.imageUrls.slice(0, 5).map(url =>
        `<img src="${esc(url)}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid var(--border)" onerror="this.style.display='none'" />`
      ).join('')}
    </div>`;
  }

  dom.focusedPostBody.innerHTML = `
    <div class="post-card">
      <div class="post-username">@${esc(post.username)}</div>
      <div class="post-meta">
        <span class="badge badge-${post.mediaType}">${post.mediaType}</span>
        ${post.isSponsored ? '<span class="badge badge-sponsored">SPONSORED</span>' : ''}
        ${post.isSuggested ? '<span class="badge badge-suggested">SUGGESTED</span>' : ''}
        ${post.likeCount ? `<span class="badge" style="background:#1a2a2a;color:var(--text-dim)">${esc(post.likeCount)} likes</span>` : ''}
        ${post.date ? `<span class="badge" style="background:#1a2a2a;color:var(--text-dim)">${esc(post.date)}</span>` : ''}
        ${tracker?.location ? `<span class="badge" style="background:#1a2a4a;color:var(--accent)">${esc(tracker.location)}</span>` : ''}
      </div>
      ${imagesHtml}
      ${field('Caption', tracker?.fullCaption || post.caption)}
      ${field('Image Description', post.imageDescription)}
      ${tracker?.hashtags?.length ? field('Hashtags', tracker.hashtags.map(h => '#' + h).join(' ')) : ''}
      ${mlkit ? field('MLKit Labels', (mlkit.labels || []).map(l => `${l.text} (${Math.round(l.confidence * 100)}%)`).join(', ')) : ''}
      ${mlkit?.ocrText ? field('MLKit OCR', mlkit.ocrText) : ''}
      <div class="dwell-timer dwell-${attn}">${dwellSec}s <span style="font-size:12px;color:var(--text-dim)">${attn}</span></div>
    </div>
  `;

  dom.focusedPostCount.textContent = `${state.postCount} seen`;
}

function field(label, value) {
  if (!value) return '';
  return `<div class="post-field">
    <div class="post-field-label">${label}</div>
    <div class="post-field-value">${esc(String(value).substring(0, 500))}</div>
  </div>`;
}

// ─── Render: Live Stream ─────────────────────────────────────────────

function addStreamEntry(type, message) {
  const now = new Date();
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const entry = document.createElement('div');
  entry.className = 'stream-entry';
  entry.innerHTML = `
    <span class="stream-time">${time}</span>
    <span class="stream-type type-${type}">${type}</span>
    <span class="stream-msg">${esc(message)}</span>
  `;

  dom.streamBody.prepend(entry);
  state.streamEntries.push(entry);

  while (state.streamEntries.length > state.maxStreamEntries) {
    const old = state.streamEntries.shift();
    old?.remove();
  }

  dom.streamCount.textContent = state.streamEntries.length;
}

// ─── Render: Enrichment Panel ────────────────────────────────────────

function renderEnrichmentForPost(postId) {
  const data = state.enrichmentData.get(postId);
  const mlkit = state.mlkitResults.get(postId);

  if (!data && !mlkit) {
    dom.enrichmentBody.innerHTML = '<div class="empty-state">En attente d\'analyse...</div>';
    return;
  }

  let html = '<div class="enrich-card">';

  // Provider badge
  if (data?.provider) {
    const pColor = data.provider === 'openai' ? '#74aa9c' : data.provider === 'ollama' ? '#e8912d' : 'var(--text-dim)';
    html += `<div style="margin-bottom:8px"><span class="badge" style="background:var(--bg);color:${pColor};font-size:10px">${esc(data.provider)}${data.model ? ` · ${esc(data.model)}` : ''}</span>`;
    if (data.reviewFlag) {
      html += ` <span class="badge" style="background:#4a1a1a;color:var(--red);font-size:10px">REVIEW${data.reviewReason ? `: ${esc(data.reviewReason)}` : ''}</span>`;
    }
    html += '</div>';
  }

  if (data) {
    // ── Scores ──
    html += section('Scores');
    html += scoreBar('Politique', data.politicalScore || 0, 4, politicalColor(data.politicalScore));
    html += scoreBar('Polarisation', data.polarizationScore || 0, 1, polarizationColor(data.polarizationScore));
    html += scoreBar('Confiance', data.confidenceScore || 0, 1, '#58a6ff');
    if (data.emotionIntensity > 0) {
      html += scoreBar('Intensite emotion', data.emotionIntensity, 1, '#e06c75');
    }
    if (data.institutionalReferenceScore > 0) {
      html += scoreBar('Ref. institutionnelle', data.institutionalReferenceScore, 1, '#bc8cff');
    }
    html += '</div>';

    // ── Semantic summary (GPT) ──
    if (data.semanticSummary) {
      html += section('Resume LLM');
      html += `<div class="normalized-text" style="max-height:80px">${esc(data.semanticSummary)}</div>`;
      html += '</div>';
    }

    // ── Taxonomie 5 niveaux ──
    const hasTaxonomy = data.domains?.length || data.mainTopics?.length || data.subjects?.length || data.preciseSubjects?.length;
    if (hasTaxonomy) {
      html += section('Taxonomie');

      if (data.domains?.length) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-bottom:2px">Domaines</div>`;
        for (const d of data.domains) html += `<span class="topic-tag" style="background:#1a2a3a;color:#7ec8e3">${esc(typeof d === 'string' ? d : d.label || d.id || JSON.stringify(d))}</span>`;
      }
      if (data.mainTopics?.length) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px;margin-bottom:2px">Themes principaux</div>`;
        for (const t of data.mainTopics) html += `<span class="topic-tag topic-main">${esc(t)}</span>`;
      }
      if (data.secondaryTopics?.length) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px;margin-bottom:2px">Themes secondaires</div>`;
        for (const t of data.secondaryTopics) html += `<span class="topic-tag topic-secondary">${esc(t)}</span>`;
      }
      if (data.subjects?.length) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px;margin-bottom:2px">Sujets</div>`;
        for (const s of data.subjects) {
          const label = typeof s === 'string' ? s : s.label || s.id || JSON.stringify(s);
          html += `<span class="topic-tag" style="background:#1a3a2a;color:#98c379">${esc(label)}</span>`;
        }
      }
      if (data.preciseSubjects?.length) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px;margin-bottom:2px">Sujets precis</div>`;
        for (const ps of data.preciseSubjects) {
          const label = typeof ps === 'string' ? ps : ps.statement || ps.label || JSON.stringify(ps);
          const conf = typeof ps === 'object' && ps.confidence ? ` (${Math.round(ps.confidence * 100)}%)` : '';
          const pos = typeof ps === 'object' && ps.position ? ` [${ps.position}]` : '';
          html += `<span class="topic-tag" style="background:#2a3a1a;color:#c3e88d;max-width:280px;white-space:normal;line-height:1.3;display:inline-block">${esc(label)}${pos}${conf}</span>`;
        }
      }

      if (data.politicalIssueTags?.length) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px;margin-bottom:2px">Tags politiques</div>`;
        for (const t of data.politicalIssueTags) html += `<span class="topic-tag topic-political">${esc(t)}</span>`;
      }
      if (data.publicPolicyTags?.length) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px;margin-bottom:2px">Politiques publiques</div>`;
        for (const t of data.publicPolicyTags) html += `<span class="topic-tag" style="background:#3a2a1a;color:#d19a66">${esc(t)}</span>`;
      }
      if (data.keywordTerms?.length) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px;margin-bottom:2px">Mots-cles</div>`;
        for (const k of data.keywordTerms) html += `<span class="topic-tag" style="background:#1a1a2a;color:var(--text-dim)">${esc(k)}</span>`;
      }

      html += '</div>';
    }

    // ── Tonalite + Emotion ──
    if (data.tone || data.primaryEmotion) {
      html += section('Tonalite & Emotion');
      if (data.tone && data.tone !== 'neutral') {
        const toneColors = { informatif: 'var(--accent)', emotionnel: '#e06c75', sarcastique: '#d19a66', militant: 'var(--red)', neutre: 'var(--text-dim)' };
        html += `<span class="topic-tag" style="background:#1a1a2a;color:${toneColors[data.tone] || 'var(--text)'}">${esc(data.tone)}</span>`;
      }
      if (data.primaryEmotion && data.primaryEmotion !== 'neutre') {
        const emoColors = { colere: 'var(--red)', joie: 'var(--green)', peur: '#d19a66', tristesse: 'var(--accent)', degout: '#db6d28', surprise: '#bc8cff' };
        html += `<span class="topic-tag" style="background:#2a1a2a;color:${emoColors[data.primaryEmotion] || '#e06c75'}">${esc(data.primaryEmotion)}${data.emotionIntensity > 0 ? ` (${Math.round(data.emotionIntensity * 100)}%)` : ''}</span>`;
      }
      if (data.audienceTarget) {
        html += `<span class="topic-tag" style="background:#1a2a2a;color:#39d2c0">Audience: ${esc(data.audienceTarget)}</span>`;
      }
      html += '</div>';
    }

    // ── Narratif ──
    if (data.narrativeFrame && data.narrativeFrame !== 'aucun') {
      html += section('Narratif');
      html += `<span class="topic-tag" style="background:#2a1a3a;color:#bc8cff">${esc(data.narrativeFrame)}</span>`;
      if (data.callToActionType && data.callToActionType !== 'aucun') {
        html += `<span class="topic-tag" style="background:#3a1a2a;color:#e06c75">CTA: ${esc(data.callToActionType)}</span>`;
      }
      if (data.problemSolutionPattern) {
        html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px">${esc(data.problemSolutionPattern)}</div>`;
      }
      html += '</div>';
    }

    // ── Signaux de polarisation ──
    html += section('Signaux');
    html += signal('Activisme', data.activismSignal);
    html += signal('Conflit', data.conflictSignal);
    html += signal('In/Out-group', data.ingroupOutgroupSignal);
    html += signal('Moral absolu', data.moralAbsoluteSignal);
    html += signal('Ennemi designe', data.enemyDesignationSignal);
    html += '</div>';

    // ── Axes politiques ──
    if (data.politicalAxes) {
      const ax = data.politicalAxes;
      const hasAxes = Math.abs(ax.economic) + Math.abs(ax.societal) + Math.abs(ax.authority) + Math.abs(ax.system) > 0;
      if (hasAxes) {
        html += section('Axes politiques');
        html += axisBar('Economique', ax.economic, 'gauche', 'droite');
        html += axisBar('Societal', ax.societal, 'progressiste', 'conservateur');
        html += axisBar('Autorite', ax.authority, 'libertaire', 'autoritaire');
        html += axisBar('Systeme', ax.system, 'anti-systeme', 'institutionnel');
        if (data.dominantAxis) {
          html += `<div style="font-size:10px;color:var(--text-dim);margin-top:4px">Axe dominant: <strong style="color:var(--accent)">${esc(data.dominantAxis)}</strong></div>`;
        }
        html += '</div>';
      }
    }

    // ── Media ──
    if (data.mediaCategory || data.mediaQuality || data.mediaIntent || data.mediaMessage) {
      html += section('Media');
      if (data.mediaCategory) html += `<span class="topic-tag" style="background:#2a1a3a;color:#bc8cff">${esc(data.mediaCategory)}</span>`;
      if (data.mediaQuality && data.mediaQuality !== 'neutre') {
        const qColor = data.mediaQuality === 'factuel' ? 'var(--green)' :
                       data.mediaQuality === 'trompeur' ? 'var(--red)' :
                       data.mediaQuality === 'sensationnel' ? 'var(--orange)' : 'var(--yellow)';
        html += `<span class="topic-tag" style="background:#1a1a2a;color:${qColor}">${esc(data.mediaQuality)}</span>`;
      }
      if (data.mediaIntent) {
        html += `<span class="topic-tag" style="background:#1a2a3a;color:var(--accent)">Intent: ${esc(data.mediaIntent)}</span>`;
      }
      if (data.contentDomain) {
        html += `<span class="topic-tag" style="background:#1a1a2a;color:var(--text-dim)">${esc(data.contentDomain)}</span>`;
      }
      if (data.mediaMessage) {
        html += `<div style="margin-top:4px;font-size:11px;color:var(--text-dim)"><em>${esc(data.mediaMessage)}</em></div>`;
      }
      html += '</div>';
    }

    // ── Entites ──
    const hasEntities = data.politicalActors?.length || data.institutions?.length || data.persons?.length || data.organizations?.length || data.countries?.length || data.locations?.length;
    if (hasEntities) {
      html += section('Entites');
      if (data.politicalActors?.length) {
        for (const e of data.politicalActors) html += `<span class="entity-tag">${esc(e)}</span>`;
      }
      if (data.persons?.length) {
        for (const e of data.persons) html += `<span class="entity-tag" style="background:#2a2a1a;color:#e5c07b">${esc(e)}</span>`;
      }
      if (data.institutions?.length) {
        for (const e of data.institutions) html += `<span class="entity-tag" style="background:#1a3a2a;color:var(--green)">${esc(e)}</span>`;
      }
      if (data.organizations?.length) {
        for (const e of data.organizations) html += `<span class="entity-tag" style="background:#1a2a3a;color:var(--accent)">${esc(e)}</span>`;
      }
      if (data.countries?.length) {
        for (const e of data.countries) html += `<span class="entity-tag" style="background:#2a1a1a;color:#e06c75">${esc(e)}</span>`;
      }
      if (data.locations?.length) {
        for (const e of data.locations) html += `<span class="entity-tag" style="background:#1a3a3a;color:#39d2c0">${esc(e)}</span>`;
      }
      html += '</div>';
    }

    // ── Transcription audio ──
    if (data.audioTranscription) {
      html += section('Transcription audio');
      html += `<div class="normalized-text" style="max-height:80px">${esc(data.audioTranscription)}</div>`;
      html += '</div>';
    }
  }

  // ── MLKit Labels ──
  if (mlkit?.labels?.length) {
    html += section('MLKit Labels');
    for (const label of mlkit.labels.slice(0, 8)) {
      const pct = Math.round((label.confidence || 0) * 100);
      html += `<div class="mlkit-label">
        <span class="mlkit-label-text">${esc(label.text)}</span>
        <div class="mlkit-bar"><div class="mlkit-bar-fill" style="width:${pct}%"></div></div>
        <span class="mlkit-conf">${pct}%</span>
      </div>`;
    }
    html += '</div>';
  }

  // ── MLKit OCR ──
  if (mlkit?.ocrText) {
    html += section('MLKit OCR');
    html += `<div class="normalized-text" style="max-height:80px">${esc(mlkit.ocrText)}</div>`;
    html += '</div>';
  }

  // ── Subtitles ──
  if (mlkit?.subtitles) {
    html += section('Sous-titres Instagram');
    html += `<div class="normalized-text" style="max-height:60px">${esc(mlkit.subtitles)}</div>`;
    html += '</div>';
  }

  html += '</div>';
  dom.enrichmentBody.innerHTML = html;
}

function section(title) {
  return `<div class="enrich-section"><div class="enrich-section-title">${title}</div>`;
}

function renderAnalysisDetail(postId) {
  const data = state.enrichmentData.get(postId);
  const mlkit = state.mlkitResults.get(postId);
  const detail = postDetailCache.get(postId);

  dom.analysisPostId.textContent = postId ? postId.substring(0, 24) : '';

  if (!data && !mlkit && !detail) {
    dom.analysisBody.innerHTML = '<div class="empty-state">Pas d\'analyse disponible</div>';
    return;
  }

  let html = '';

  // Normalized text
  if (data?.normalizedText) {
    html += section('Texte normalise');
    html += `<div class="normalized-text">${esc(data.normalizedText)}</div>`;
    if (data.language) html += `<div style="margin-top:4px;font-size:10px;color:var(--text-dim)">Langue: ${esc(data.language)}</div>`;
    html += '</div>';
  }

  // Semantic summary (GPT)
  if (data?.semanticSummary) {
    html += section('Resume semantique (LLM)');
    html += `<div class="normalized-text" style="color:var(--text)">${esc(data.semanticSummary)}</div>`;
    html += '</div>';
  }

  // MLKit OCR
  if (mlkit?.ocrText) {
    html += section('OCR (MLKit)');
    html += `<div class="normalized-text">${esc(mlkit.ocrText)}</div>`;
    html += '</div>';
  }

  // Subtitles
  if (mlkit?.subtitles) {
    html += section('Sous-titres Instagram');
    html += `<div class="normalized-text">${esc(mlkit.subtitles)}</div>`;
    html += '</div>';
  }

  // Audio transcription
  if (data?.audioTranscription) {
    html += section('Transcription audio (Whisper)');
    html += `<div class="normalized-text" style="color:var(--text)">${esc(data.audioTranscription)}</div>`;
    html += '</div>';
  }

  // Media message (LLM inferred)
  if (data?.mediaMessage) {
    html += section('Message du media (LLM)');
    html += `<div style="font-size:12px;color:var(--text);line-height:1.5"><em>${esc(data.mediaMessage)}</em></div>`;
    html += '</div>';
  }

  // Score detail
  if (data) {
    html += section('Detail scoring');
    html += `<div style="font-size:11px;color:var(--text-dim);line-height:1.8">`;
    html += `Politique: <strong style="color:${politicalColor(data.politicalScore)}">${data.politicalScore || 0}/4</strong> `;
    html += `| Polarisation: <strong style="color:${polarizationColor(data.polarizationScore)}">${(data.polarizationScore || 0).toFixed(2)}</strong> `;
    html += `| Confiance: <strong style="color:var(--accent)">${(data.confidenceScore || 0).toFixed(2)}</strong>`;
    if (data.emotionIntensity > 0) html += `<br>Emotion: <strong>${esc(data.primaryEmotion || '?')}</strong> (${Math.round(data.emotionIntensity * 100)}%)`;
    if (data.tone && data.tone !== 'neutral') html += ` | Ton: <strong>${esc(data.tone)}</strong>`;
    if (data.narrativeFrame && data.narrativeFrame !== 'aucun') html += `<br>Narratif: <strong>${esc(data.narrativeFrame)}</strong>`;
    if (data.callToActionType && data.callToActionType !== 'aucun') html += ` | CTA: <strong>${esc(data.callToActionType)}</strong>`;
    if (data.mediaIntent) html += ` | Intent: <strong>${esc(data.mediaIntent)}</strong>`;
    if (data.provider) html += `<br>Provider: <strong>${esc(data.provider)}</strong>${data.model ? ` (${esc(data.model)})` : ''}`;
    html += `</div></div>`;
  }

  // Post raw data from DB
  if (detail) {
    const hasDbData = detail.imageDesc || detail.hashtags || detail.ocrText || detail.subtitles;
    if (hasDbData) {
      html += section('Donnees brutes (DB)');
      if (detail.imageDesc) html += `<div style="font-size:10px;color:var(--text-dim);margin-bottom:2px">Image desc:</div><div class="normalized-text" style="max-height:60px">${esc(detail.imageDesc)}</div>`;
      if (detail.hashtags && detail.hashtags !== '[]') {
        const tags = jsonParse(detail.hashtags);
        if (tags.length) html += `<div style="margin-top:4px">${tags.map(h => `<span class="topic-tag" style="background:#1a1a2a;color:var(--text-dim)">#${esc(h)}</span>`).join('')}</div>`;
      }
      html += '</div>';
    }
  }

  dom.analysisBody.innerHTML = html || '<div class="empty-state">Pas d\'analyse</div>';
}

// ─── Tab: Timeline ──────────────────────────────────────────────────

function setTimelineSort(sort) {
  state.timelineSort = sort;
  document.querySelectorAll('#page-timeline .tab-btn').forEach(b => b.classList.remove('active'));
  const btn = $(`sort-${sort}`);
  if (btn) btn.classList.add('active');
  renderTimeline();
}
window.setTimelineSort = setTimelineSort;

function renderTimeline() {
  const posts = Array.from(state.allPosts.values());

  if (posts.length === 0) {
    dom.timelineBody.innerHTML = '<div class="empty-state">Aucun post capture pour le moment</div>';
    dom.timelineTotal.textContent = '0 posts';
    return;
  }

  if (state.timelineSort === 'dwell') {
    posts.sort((a, b) => (b.dwellTimeMs || 0) - (a.dwellTimeMs || 0));
  } else if (state.timelineSort === 'political') {
    posts.sort((a, b) => (b.enrichment?.politicalScore || 0) - (a.enrichment?.politicalScore || 0));
  } else {
    posts.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  let html = '';
  for (const p of posts.slice(0, 200)) {
    const dwellMs = p.dwellTimeMs || 0;
    const attn = classifyAttention(dwellMs);
    const dwellSec = (dwellMs / 1000).toFixed(1);
    const time = p.lastSeen ? new Date(p.lastSeen).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const enr = p.enrichment;
    const polBadge = enr && enr.politicalScore > 0
      ? `<span class="badge" style="background:#4a1a2a;color:${politicalColor(enr.politicalScore)};font-size:9px">pol:${enr.politicalScore}</span>`
      : '';
    const topicBadge = enr?.mainTopics?.length
      ? enr.mainTopics.slice(0, 2).map(t => `<span class="topic-tag topic-main" style="font-size:9px">${esc(t)}</span>`).join('')
      : '';
    const srcBadge = p.source === 'mobile' ? '<span class="badge" style="background:#1a3a3a;color:#39d2c0;font-size:9px">M</span>' : '';

    html += `<div class="timeline-item">
      <span class="timeline-time">${time}</span>
      <span class="timeline-user">@${esc(p.username || '?')}</span>
      <span class="timeline-caption">${esc((p.caption || '').substring(0, 100))}</span>
      <div class="timeline-badges">
        <span class="badge badge-${p.mediaType || 'photo'}" style="font-size:9px">${p.mediaType || '?'}</span>
        ${p.isSponsored ? '<span class="badge badge-sponsored" style="font-size:9px">AD</span>' : ''}
        ${srcBadge}
        ${polBadge}
        ${topicBadge}
      </div>
      <span class="timeline-dwell dwell-${attn}">${dwellSec}s</span>
    </div>`;
  }

  dom.timelineBody.innerHTML = html;
  dom.timelineTotal.textContent = `${posts.length} posts`;
}

// ─── Tab: Sessions ──────────────────────────────────────────────────

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions');
    const sessions = await res.json();
    renderSessions(sessions);
  } catch (e) {
    dom.sessionsBody.innerHTML = `<div class="empty-state">Erreur: ${e.message}</div>`;
  }
}

function renderSessions(sessions) {
  if (!sessions?.length) {
    dom.sessionsBody.innerHTML = '<div class="empty-state">Aucune session enregistree</div>';
    return;
  }

  let html = '';
  for (const s of sessions) {
    const date = new Date(s.capturedAt).toLocaleString('fr-FR');
    const dur = s.durationSec ? `${Math.floor(s.durationSec / 60)}m${Math.floor(s.durationSec % 60)}s` : '-';
    const postCount = s._count?.posts || s.totalPosts || 0;
    const mode = s.captureMode || 'unknown';
    const modeBadge = mode.includes('mobile') ? '#39d2c0' :
                      mode.includes('visualizer') ? 'var(--accent)' : 'var(--text-dim)';

    html += `<div class="card">
      <div class="card-title">${date}</div>
      <div class="card-subtitle">Session ${s.id.substring(0, 12)}</div>
      <div class="card-row">
        <span class="card-stat"><strong>${postCount}</strong> posts</span>
        <span class="card-stat"><strong>${s.totalEvents || 0}</strong> events</span>
        <span class="card-stat"><strong>${dur}</strong></span>
        <span class="badge" style="background:var(--bg);color:${modeBadge}">${mode}</span>
      </div>
    </div>`;
  }

  dom.sessionsBody.innerHTML = html;
}

// ─── Tab: Stats (from API) ──────────────────────────────────────────

async function fetchStats() {
  dom.statsBody.innerHTML = '<div class="empty-state">Chargement depuis la base...</div>';

  try {
    const [statsRes, enrichRes, axesRes] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/enrichment/stats'),
      fetch('/api/enrichment/axes'),
    ]);
    const stats = await statsRes.json();
    const enrich = await enrichRes.json();
    const axes = await axesRes.json();

    let html = '<div class="stats-grid">';

    // Vue d'ensemble
    html += `<div class="stats-card">
      <div class="stats-card-title">Vue d'ensemble (DB)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center">
        <div><div class="stats-big">${stats.totalPosts}</div><div class="stats-label">posts</div></div>
        <div><div class="stats-big" style="color:var(--green)">${enrich.totalEnriched}</div><div class="stats-label">enrichis</div></div>
        <div><div class="stats-big" style="color:#39d2c0">${stats.totalSessions}</div><div class="stats-label">sessions</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center;margin-top:12px">
        <div><div class="stats-big" style="font-size:20px;color:var(--accent)">${enrich.enrichmentRate}%</div><div class="stats-label">couverture</div></div>
        <div><div class="stats-big" style="font-size:20px;color:var(--yellow)">${enrich.avgPolarization}</div><div class="stats-label">moy. polarisation</div></div>
        <div><div class="stats-big" style="font-size:20px;color:var(--orange)">${enrich.reviewFlagged}</div><div class="stats-label">review flagged</div></div>
      </div>
    </div>`;

    // Providers
    if (enrich.byProvider?.length) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Providers d'enrichissement</div>
        ${enrich.byProvider.map(([prov, cnt]) => {
          const color = prov === 'openai' ? '#74aa9c' : prov === 'ollama' ? '#e8912d' : 'var(--text-dim)';
          return hbar(prov, cnt, enrich.byProvider[0][1], color);
        }).join('')}
        ${enrich.totalSubjects > 0 ? `<div style="margin-top:8px;font-size:11px;color:var(--text-dim)">${enrich.totalSubjects} sujets extraits | ${enrich.totalPreciseSubjects} sujets precis</div>` : ''}
      </div>`;
    }

    // Attention
    if (stats.attention?.length) {
      const totalAttn = stats.attention.reduce((s, a) => s + a._count, 0) || 1;
      const attnColors = { engaged: 'var(--green)', viewed: 'var(--accent)', glanced: 'var(--yellow)', skipped: 'var(--text-dim)' };
      html += `<div class="stats-card">
        <div class="stats-card-title">Distribution attention</div>
        ${stats.attention.map(a => {
          const pct = Math.round(a._count / totalAttn * 100);
          return hbar(`${a.attentionLevel} (${pct}%)`, a._count, totalAttn, attnColors[a.attentionLevel] || 'var(--accent)');
        }).join('')}
      </div>`;
    }

    // Score politique
    if (enrich.byPolitical?.length) {
      const maxPol = Math.max(...enrich.byPolitical.map(p => p._count));
      html += `<div class="stats-card">
        <div class="stats-card-title">Score politique (0-4)</div>
        ${enrich.byPolitical.map(p => hbar(`${p.politicalExplicitnessScore} — ${['Aucun','Faible','Modere','Fort','Explicite'][p.politicalExplicitnessScore]}`, p._count, maxPol, politicalColor(p.politicalExplicitnessScore))).join('')}
      </div>`;
    }

    // Polarisation
    if (enrich.polarBuckets) {
      const b = enrich.polarBuckets;
      const maxB = Math.max(b.low, b.medium, b.high, b.extreme, 1);
      html += `<div class="stats-card">
        <div class="stats-card-title">Polarisation</div>
        ${hbar('Faible (<0.2)', b.low, maxB, 'var(--green)')}
        ${hbar('Moyen (0.2-0.5)', b.medium, maxB, 'var(--yellow)')}
        ${hbar('Fort (0.5-0.8)', b.high, maxB, 'var(--orange)')}
        ${hbar('Extreme (>0.8)', b.extreme, maxB, 'var(--red)')}
      </div>`;
    }

    // Top topics
    if (enrich.topTopics?.length) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Top Themes</div>
        ${enrich.topTopics.map(([t, c]) => hbar(t, c, enrich.topTopics[0][1], 'var(--green)')).join('')}
      </div>`;
    }

    // Domaines
    if (enrich.byDomain?.length) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Domaines</div>
        ${enrich.byDomain.map(([d, c]) => hbar(d, c, enrich.byDomain[0][1], '#7ec8e3')).join('')}
      </div>`;
    }

    // Tonalite
    if (enrich.byTone?.length) {
      const toneColors = { informatif: 'var(--accent)', emotionnel: '#e06c75', sarcastique: '#d19a66', militant: 'var(--red)', neutre: 'var(--text-dim)', neutral: 'var(--text-dim)' };
      html += `<div class="stats-card">
        <div class="stats-card-title">Tonalite</div>
        ${enrich.byTone.map(([t, c]) => hbar(t, c, enrich.byTone[0][1], toneColors[t] || 'var(--accent)')).join('')}
      </div>`;
    }

    // Media category
    if (enrich.byMediaCategory?.length) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Categorie media</div>
        ${enrich.byMediaCategory.map(([m, c]) => hbar(m, c, enrich.byMediaCategory[0][1], '#bc8cff')).join('')}
      </div>`;
    }

    // Media intent
    if (enrich.byMediaIntent?.length) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Intent media</div>
        ${enrich.byMediaIntent.map(([m, c]) => hbar(m, c, enrich.byMediaIntent[0][1], 'var(--cyan)')).join('')}
      </div>`;
    }

    // Narratif
    if (enrich.byNarrative?.length) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Frames narratifs</div>
        ${enrich.byNarrative.map(n => hbar(n.narrativeFrame, n._count, enrich.byNarrative[0]._count, '#bc8cff')).join('')}
      </div>`;
    }

    // Axes politiques
    if (axes.withSignal > 0) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Axes politiques (${axes.withSignal}/${axes.total} posts avec signal)</div>
        ${axisBar('Economique', axes.averages.economic, 'gauche', 'droite')}
        ${axisBar('Societal', axes.averages.societal, 'progressiste', 'conservateur')}
        ${axisBar('Autorite', axes.averages.authority, 'libertaire', 'autoritaire')}
        ${axisBar('Systeme', axes.averages.system, 'anti-systeme', 'institutionnel')}
      </div>`;

      if (axes.dominantCounts && Object.keys(axes.dominantCounts).length) {
        const maxDom = Math.max(...Object.values(axes.dominantCounts));
        html += `<div class="stats-card">
          <div class="stats-card-title">Axe dominant</div>
          ${Object.entries(axes.dominantCounts).sort((a, b) => b[1] - a[1]).map(([ax, c]) => hbar(ax, c, maxDom, 'var(--purple)')).join('')}
        </div>`;
      }
    }

    // Top users
    if (stats.topUsers?.length) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Top comptes vus</div>
        ${stats.topUsers.filter(u => u.username).slice(0, 15).map(u => hbar(`@${u.username}`, u._count, stats.topUsers[0]._count, 'var(--accent)')).join('')}
      </div>`;
    }

    // Categories
    if (stats.categories?.length) {
      html += `<div class="stats-card">
        <div class="stats-card-title">Categories</div>
        ${stats.categories.map(c => hbar(c.category, c._count, stats.categories[0]._count, '#39d2c0')).join('')}
      </div>`;
    }

    html += '</div>';
    dom.statsBody.innerHTML = html;
  } catch (e) {
    dom.statsBody.innerHTML = `<div class="empty-state">Erreur: ${e.message}</div>`;
  }
}

// ─── Tab: Enriched Posts (from API) ─────────────────────────────────

let enrichedPostsCache = [];
let enrichedFilter = 'all';

function setEnrichedFilter(filter) {
  enrichedFilter = filter;
  document.querySelectorAll('#page-enriched .tab-btn').forEach(b => b.classList.remove('active'));
  const btn = $(`filter-${filter}`);
  if (btn) btn.classList.add('active');
  renderEnrichedList();
}
window.setEnrichedFilter = setEnrichedFilter;

async function fetchEnrichedPosts() {
  const list = $('enriched-list');
  if (!list) return;
  list.innerHTML = '<div class="empty-state">Chargement des posts enrichis...</div>';

  try {
    const res = await fetch('/api/enrichment/posts?limit=200');
    enrichedPostsCache = await res.json();
    const badge = $('tab-enriched-badge');
    if (badge) badge.textContent = enrichedPostsCache.length;
    renderEnrichedList();
  } catch (e) {
    list.innerHTML = `<div class="empty-state">Erreur: ${e.message}</div>`;
  }
}

function renderEnrichedList() {
  const list = $('enriched-list');
  if (!list) return;

  let posts = enrichedPostsCache;

  // Apply filter
  if (enrichedFilter === 'openai') posts = posts.filter(p => p.provider === 'openai');
  else if (enrichedFilter === 'ollama') posts = posts.filter(p => p.provider === 'ollama');
  else if (enrichedFilter === 'rules') posts = posts.filter(p => p.provider === 'rules');
  else if (enrichedFilter === 'review') posts = posts.filter(p => p.reviewFlag);
  else if (enrichedFilter === 'audio') posts = posts.filter(p => p.audioTranscription);

  const total = $('enriched-total');
  if (total) total.textContent = `${posts.length} posts enrichis`;

  if (!posts.length) {
    list.innerHTML = '<div class="empty-state">Aucun post pour ce filtre</div>';
    return;
  }

  list.innerHTML = posts.map((p, i) => {
    const username = p.post?.username || '?';
    const caption = p.post?.caption || '';
    const mediaType = p.post?.mediaType || 'photo';
    const dwellSec = ((p.post?.dwellTimeMs || 0) / 1000).toFixed(1);
    const attn = classifyAttention(p.post?.dwellTimeMs || 0);
    const mainTopics = jsonParse(p.mainTopics);
    const domains = jsonParse(p.domains);
    const subjects = jsonParse(p.subjects);
    const preciseSubjects = jsonParse(p.preciseSubjects);
    const politicalActors = jsonParse(p.politicalActors);
    const persons = jsonParse(p.persons);
    const organizations = jsonParse(p.organizations);
    const institutions = jsonParse(p.institutions);
    const countries = jsonParse(p.countries);
    const polIssueTags = jsonParse(p.politicalIssueTags);
    const ocrText = p.post?.ocrText || '';
    const mlkitLabels = jsonParse(p.post?.mlkitLabels);
    const subtitles = p.post?.subtitles || '';

    return `<div class="enriched-post" onclick="this.classList.toggle('expanded')">
      <div class="enriched-post-header">
        <span class="provider-badge provider-${p.provider}">${esc(p.provider)}${p.model ? ` · ${esc(p.model)}` : ''}</span>
        <span style="color:var(--accent);font-weight:700">@${esc(username)}</span>
        <span class="badge badge-${mediaType}" style="font-size:9px">${mediaType}</span>
        ${p.post?.isSponsored ? '<span class="badge badge-sponsored" style="font-size:9px">AD</span>' : ''}
        <span class="dwell-${attn}" style="font-size:11px;font-weight:600">${dwellSec}s</span>
        ${p.reviewFlag ? '<span class="badge" style="background:#4a1a1a;color:var(--red);font-size:9px">REVIEW</span>' : ''}
        ${p.audioTranscription ? '<span class="badge" style="background:#1a3a3a;color:#39d2c0;font-size:9px">AUDIO</span>' : ''}
        <span style="font-size:10px;color:${politicalColor(p.politicalExplicitnessScore)};font-weight:700">P${p.politicalExplicitnessScore}</span>
        <span style="font-size:10px;color:${polarizationColor(p.polarizationScore)}">polar:${p.polarizationScore.toFixed(2)}</span>
        <span style="font-size:10px;color:var(--text-dim)">conf:${p.confidenceScore.toFixed(2)}</span>
        ${mainTopics.slice(0, 3).map(t => `<span class="topic-tag topic-main" style="font-size:9px">${esc(t)}</span>`).join('')}
      </div>
      <div style="font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(caption.substring(0, 150))}</div>

      <div class="enriched-post-body">
        ${p.semanticSummary ? `<div class="enrich-section"><div class="enrich-section-title">Resume LLM</div><div class="normalized-text" style="max-height:80px">${esc(p.semanticSummary)}</div></div>` : ''}

        ${p.normalizedText ? `<div class="enrich-section"><div class="enrich-section-title">Texte normalise</div><div class="normalized-text" style="max-height:60px">${esc(p.normalizedText.substring(0, 500))}</div></div>` : ''}

        ${domains.length || mainTopics.length || subjects.length ? `<div class="enrich-section"><div class="enrich-section-title">Taxonomie</div>
          ${domains.length ? `<div style="margin-bottom:4px">${domains.map(d => `<span class="topic-tag" style="background:#1a2a3a;color:#7ec8e3">${esc(typeof d === 'string' ? d : d.label || JSON.stringify(d))}</span>`).join('')}</div>` : ''}
          ${mainTopics.length ? `<div style="margin-bottom:4px">${mainTopics.map(t => `<span class="topic-tag topic-main">${esc(t)}</span>`).join('')}</div>` : ''}
          ${subjects.length ? `<div style="margin-bottom:4px">${subjects.map(s => `<span class="topic-tag" style="background:#1a3a2a;color:#98c379">${esc(typeof s === 'string' ? s : s.label || JSON.stringify(s))}</span>`).join('')}</div>` : ''}
          ${preciseSubjects.length ? `<div>${preciseSubjects.map(ps => {
            const label = typeof ps === 'string' ? ps : ps.statement || ps.label || JSON.stringify(ps);
            return `<span class="topic-tag" style="background:#2a3a1a;color:#c3e88d;max-width:300px;white-space:normal;display:inline-block;line-height:1.3">${esc(label)}</span>`;
          }).join('')}</div>` : ''}
        </div>` : ''}

        ${p.tone && p.tone !== 'neutral' || p.primaryEmotion ? `<div class="enrich-section"><div class="enrich-section-title">Tonalite & Emotion</div>
          ${p.tone ? `<span class="topic-tag" style="background:#1a1a2a;color:var(--text)">${esc(p.tone)}</span>` : ''}
          ${p.primaryEmotion ? `<span class="topic-tag" style="background:#2a1a2a;color:#e06c75">${esc(p.primaryEmotion)}${p.emotionIntensity > 0 ? ` (${Math.round(p.emotionIntensity * 100)}%)` : ''}</span>` : ''}
          ${p.audienceTarget ? `<span class="topic-tag" style="background:#1a2a2a;color:#39d2c0">${esc(p.audienceTarget)}</span>` : ''}
        </div>` : ''}

        ${p.narrativeFrame && p.narrativeFrame !== 'aucun' ? `<div class="enrich-section"><div class="enrich-section-title">Narratif</div>
          <span class="topic-tag" style="background:#2a1a3a;color:#bc8cff">${esc(p.narrativeFrame)}</span>
          ${p.callToActionType && p.callToActionType !== 'aucun' ? `<span class="topic-tag" style="background:#3a1a2a;color:#e06c75">CTA: ${esc(p.callToActionType)}</span>` : ''}
        </div>` : ''}

        <div class="enrich-section"><div class="enrich-section-title">Signaux</div>
          ${signal('Activisme', p.activismSignal)}
          ${signal('Conflit', p.conflictSignal)}
          ${signal('In/Out', p.ingroupOutgroupSignal)}
          ${signal('Moral absolu', p.moralAbsoluteSignal)}
          ${signal('Ennemi', p.enemyDesignationSignal)}
        </div>

        ${Math.abs(p.axisEconomic) + Math.abs(p.axisSocietal) + Math.abs(p.axisAuthority) + Math.abs(p.axisSystem) > 0 ? `<div class="enrich-section"><div class="enrich-section-title">Axes politiques</div>
          ${axisBar('Eco', p.axisEconomic, 'G', 'D')}
          ${axisBar('Soc', p.axisSocietal, 'Prog', 'Cons')}
          ${axisBar('Aut', p.axisAuthority, 'Lib', 'Auth')}
          ${axisBar('Sys', p.axisSystem, 'Anti', 'Inst')}
          ${p.dominantAxis ? `<div style="font-size:10px;color:var(--text-dim)">Dominant: <strong style="color:var(--accent)">${esc(p.dominantAxis)}</strong></div>` : ''}
        </div>` : ''}

        ${p.mediaCategory || p.mediaQuality || p.mediaIntent ? `<div class="enrich-section"><div class="enrich-section-title">Media</div>
          ${p.mediaCategory ? `<span class="topic-tag" style="background:#2a1a3a;color:#bc8cff">${esc(p.mediaCategory)}</span>` : ''}
          ${p.mediaQuality ? `<span class="topic-tag" style="background:#1a1a2a;color:var(--text)">${esc(p.mediaQuality)}</span>` : ''}
          ${p.mediaIntent ? `<span class="topic-tag" style="background:#1a2a3a;color:var(--accent)">${esc(p.mediaIntent)}</span>` : ''}
        </div>` : ''}

        ${politicalActors.length || persons.length || institutions.length || organizations.length || countries.length ? `<div class="enrich-section"><div class="enrich-section-title">Entites</div>
          ${politicalActors.map(e => `<span class="entity-tag">${esc(e)}</span>`).join('')}
          ${persons.map(e => `<span class="entity-tag" style="background:#2a2a1a;color:#e5c07b">${esc(e)}</span>`).join('')}
          ${institutions.map(e => `<span class="entity-tag" style="background:#1a3a2a;color:var(--green)">${esc(e)}</span>`).join('')}
          ${organizations.map(e => `<span class="entity-tag" style="background:#1a2a3a;color:var(--accent)">${esc(e)}</span>`).join('')}
          ${countries.map(e => `<span class="entity-tag" style="background:#2a1a1a;color:#e06c75">${esc(e)}</span>`).join('')}
        </div>` : ''}

        ${p.audioTranscription ? `<div class="enrich-section"><div class="enrich-section-title">Transcription audio (Whisper)</div><div class="normalized-text">${esc(p.audioTranscription)}</div></div>` : ''}

        ${ocrText ? `<div class="enrich-section"><div class="enrich-section-title">MLKit OCR</div><div class="normalized-text" style="max-height:60px">${esc(ocrText)}</div></div>` : ''}

        ${mlkitLabels.length ? `<div class="enrich-section"><div class="enrich-section-title">MLKit Labels</div>
          ${mlkitLabels.slice(0, 8).map(l => {
            const pct = Math.round((l.confidence || 0) * 100);
            return `<div class="mlkit-label"><span class="mlkit-label-text">${esc(l.text)}</span><div class="mlkit-bar"><div class="mlkit-bar-fill" style="width:${pct}%"></div></div><span class="mlkit-conf">${pct}%</span></div>`;
          }).join('')}
        </div>` : ''}

        ${subtitles ? `<div class="enrich-section"><div class="enrich-section-title">Sous-titres Instagram</div><div class="normalized-text" style="max-height:60px">${esc(subtitles)}</div></div>` : ''}

        ${polIssueTags.length ? `<div class="enrich-section"><div class="enrich-section-title">Tags politiques</div>${polIssueTags.map(t => `<span class="topic-tag topic-political">${esc(t)}</span>`).join('')}</div>` : ''}

        ${p.reviewReason ? `<div style="font-size:10px;color:var(--red);margin-top:4px">Review: ${esc(p.reviewReason)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function hbar(label, value, max, color) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<div class="hbar">
    <div class="hbar-label">
      <span class="hbar-label-text">${esc(label)}</span>
      <span class="hbar-label-value">${value}</span>
    </div>
    <div class="hbar-track">
      <div class="hbar-fill" style="width:${pct}%;background:${color}"></div>
    </div>
  </div>`;
}

// ─── Tab: Mobile ────────────────────────────────────────────────────

function renderMobilePage() {
  const connected = state.mobileConnected;
  dom.mobileHeroDot.className = `dot${connected ? ' connected' : ''}`;
  dom.mobileHeroTitle.textContent = connected ? 'Mobile connecte' : 'Mobile deconnecte';
  dom.mobileHeroSub.textContent = connected
    ? 'Connexion WebSocket active — donnees en temps reel'
    : 'En attente de connexion WebSocket via adb reverse...';

  if (!connected || !state.mobileStats) {
    dom.mobileStatsBody.innerHTML = connected
      ? '<div class="empty-state">Connexion active, en attente de donnees...</div>'
      : `<div class="empty-state" style="text-align:left;max-width:500px;margin:20px auto">
          <div style="color:var(--text);font-weight:700;margin-bottom:12px">Comment connecter le mobile</div>
          <ol style="text-align:left;line-height:2;color:var(--text-dim)">
            <li>Brancher le telephone en USB (ou ADB WiFi)</li>
            <li>Le visualizer fait <code style="color:var(--accent)">adb reverse tcp:3000 tcp:3000</code> automatiquement</li>
            <li>Lancer l'app Scrollout sur le telephone</li>
            <li>Le mobile se connecte en WebSocket au visualizer</li>
          </ol>
        </div>`;
    return;
  }

  const s = state.mobileStats;
  let html = '<div class="stats-grid">';

  html += `<div class="stats-card">
    <div class="stats-card-title">Base mobile</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
      <div><div class="stats-big">${s.totalSessions || 0}</div><div class="stats-label">sessions</div></div>
      <div><div class="stats-big">${s.totalPosts || 0}</div><div class="stats-label">posts</div></div>
      <div><div class="stats-big" style="color:var(--green)">${s.totalEnriched || 0}</div><div class="stats-label">enrichis</div></div>
    </div>
  </div>`;

  if (s.attention) {
    const total = Object.values(s.attention).reduce((a, b) => a + b, 0) || 1;
    html += `<div class="stats-card">
      <div class="stats-card-title">Attention (mobile DB)</div>
      ${hbar('Engaged', s.attention.engaged || 0, total, 'var(--green)')}
      ${hbar('Viewed', s.attention.viewed || 0, total, 'var(--accent)')}
      ${hbar('Glanced', s.attention.glanced || 0, total, 'var(--yellow)')}
      ${hbar('Skipped', s.attention.skipped || 0, total, 'var(--text-dim)')}
    </div>`;
  }

  if (s.topUsers?.length) {
    html += `<div class="stats-card">
      <div class="stats-card-title">Top comptes (mobile DB)</div>
      ${s.topUsers.slice(0, 10).map(u => hbar(`@${u.username}`, u.count, s.topUsers[0].count, 'var(--purple)')).join('')}
    </div>`;
  }

  if (s.topCategories?.length) {
    html += `<div class="stats-card">
      <div class="stats-card-title">Categories media (mobile DB)</div>
      ${s.topCategories.map(c => hbar(c.category, c.count, s.topCategories[0].count, '#39d2c0')).join('')}
    </div>`;
  }

  html += '</div>';
  dom.mobileStatsBody.innerHTML = html;
}

// ─── Enrichment helpers ─────────────────────────────────────────────

function scoreBar(label, value, max, color) {
  const pct = Math.round((value / max) * 100);
  const display = max === 1 ? value.toFixed(2) : `${value}/${max}`;
  return `<div class="score-bar">
    <span class="score-label">${label}</span>
    <div class="score-track">
      <div class="score-fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <span class="score-value">${display}</span>
  </div>`;
}

function signal(label, active) {
  const cls = active ? 'signal-on' : 'signal-off';
  const icon = active ? '●' : '○';
  return `<span class="signal-indicator ${cls}">${icon} ${label}</span>`;
}

function politicalColor(score) {
  if (score === 0) return 'var(--text-dim)';
  if (score <= 1) return 'var(--green)';
  if (score <= 2) return 'var(--yellow)';
  if (score <= 3) return 'var(--orange)';
  return 'var(--red)';
}

function axisBar(label, value, negLabel, posLabel) {
  const color = Math.abs(value) < 0.1 ? 'var(--text-dim)' : value < 0 ? '#58a6ff' : '#db6d28';
  const display = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
  return `<div class="score-bar" style="margin-bottom:2px">
    <span class="score-label" style="width:80px;font-size:11px">${label}</span>
    <span style="font-size:9px;color:var(--text-dim);width:70px;text-align:right">${negLabel}</span>
    <div class="score-track" style="position:relative">
      <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--border)"></div>
      <div class="score-fill" style="width:${Math.abs(value) * 50}%;margin-left:${value < 0 ? (50 - Math.abs(value) * 50) : 50}%;background:${color}"></div>
    </div>
    <span style="font-size:9px;color:var(--text-dim);width:75px">${posLabel}</span>
    <span class="score-value" style="color:${color}">${display}</span>
  </div>`;
}

function polarizationColor(score) {
  if (score < 0.2) return 'var(--green)';
  if (score < 0.5) return 'var(--yellow)';
  if (score < 0.7) return 'var(--orange)';
  return 'var(--red)';
}

// ─── Quality ────────────────────────────────────────────────────────

function updateQuality(metrics) {
  dom.qParse.textContent = `${metrics.parseRate}%`;
  setQualityDot(dom.qParseDot, metrics.parseRate > 90 ? 'good' : metrics.parseRate > 70 ? 'warn' : 'bad');

  const chunkTotal = metrics.chunkSuccess + metrics.chunkFails;
  dom.qChunks.textContent = `${metrics.chunkSuccess}/${chunkTotal}`;
  setQualityDot(dom.qChunkDot, metrics.chunkFails === 0 ? 'good' : metrics.chunkFails < 3 ? 'warn' : 'bad');

  const missingTotal = Object.values(metrics.missingFields).reduce((a, b) => a + b, 0);
  if (missingTotal === 0) {
    dom.qFields.textContent = 'OK';
    setQualityDot(dom.qFieldsDot, 'good');
  } else {
    const top = Object.entries(metrics.missingFields)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    dom.qFields.textContent = top;
    setQualityDot(dom.qFieldsDot, missingTotal < 5 ? 'warn' : 'bad');
  }

  dom.qMlkit.textContent = metrics.mlkitResults;
  setQualityDot(dom.qMlkitDot, metrics.mlkitResults > 0 ? 'good' : 'warn');
  dom.qEnrich.textContent = state.enrichmentCount;
  setQualityDot(dom.qEnrichDot, state.enrichmentCount > 0 ? 'good' : 'warn');
  dom.statEps.textContent = metrics.eventsPerSec;
}

function setQualityDot(el, level) {
  if (el) el.className = `quality-dot q-${level}`;
}

// ─── Status ─────────────────────────────────────────────────────────

function updateAdbStatus(status) {
  const connected = status === 'connected';
  dom.adbDot.className = `dot${connected ? ' connected' : ''}`;
  dom.adbLabel.textContent = connected ? 'adb' : 'adb off';
}

function updateMobileStatus(status, stats) {
  const connected = status === 'connected';
  state.mobileConnected = connected;
  if (stats) state.mobileStats = stats;

  dom.mobileDot.className = `dot${connected ? ' connected' : ''}`;
  dom.mobileLabel.textContent = connected
    ? `mobile${stats ? ` (${stats.totalPosts || 0})` : ''}`
    : 'mobile';

  if (state.activeTab === 'mobile') renderMobilePage();
}

// ─── Timer ──────────────────────────────────────────────────────────

setInterval(() => {
  if (state.focusedPost && state.focusedDwellStart) renderFocusedPost();

  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  dom.statDuration.textContent = `${min}:${pad(sec)}`;
}, 1000);

setInterval(() => {
  if (state.activeTab === 'stats') fetchStats();
  if (state.activeTab === 'timeline') renderTimeline();
}, 5000);

// ─── Helpers ────────────────────────────────────────────────────────

function classifyAttention(ms) {
  if (ms < 500) return 'skipped';
  if (ms < 2000) return 'glanced';
  if (ms < 5000) return 'viewed';
  return 'engaged';
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatSummary(data) {
  return `Session: ${data.totalPostsViewed} posts viewed, ${data.posts?.length || 0} tracked`;
}

// ─── Boot ───────────────────────────────────────────────────────────

connect();
