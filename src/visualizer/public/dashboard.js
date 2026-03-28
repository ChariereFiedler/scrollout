/**
 * ECHA Debug Visualizer — Client-side dashboard.
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
  mlkitResults: new Map(), // postId → { labels, ocrText }
  trackerData: new Map(), // postId → { imageUrls, imageAlts, fullCaption, ... }
  enrichmentData: new Map(), // postId → enrichment result
  enrichmentCount: 0,
  streamEntries: [],
  maxStreamEntries: 500,
  lastNodes: [],
  nodeFilter: '',
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
};

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
      handleEvent(msg.data);
      break;
    case 'mlkit':
      handleMLKit(msg.data);
      break;
    case 'summary':
      addStreamEntry('summary', formatSummary(msg.data));
      break;
    case 'raw':
      // Don't flood the stream with raw lines
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
      updateAdbStatus(msg.adb);
      break;
    case 'tracker':
      handleTracker(msg.data);
      break;
    case 'enrichment':
      handleEnrichment(msg.postId, msg.data);
      break;
    case 'db-update':
      break;
  }
}

// ─── Event handling ──────────────────────────────────────────────────

function handleEvent(event) {
  state.eventCount++;
  dom.statEvents.textContent = state.eventCount;

  // Track unique posts
  if (event.focusedPost) {
    const post = event.focusedPost;
    const postId = event.focusedPostId || post.postId || post.username;

    // Update focused post display
    if (state.focusedPost?.postId !== postId) {
      state.postCount++;
      dom.statPosts.textContent = state.postCount;
      state.focusedDwellStart = Date.now();
    }

    state.focusedPost = { ...post, postId };
    state.focusedDwellMs = event.dwellTimes?.[event.focusedPostId] || 0;
    renderFocusedPost();
    renderEnrichmentForPost(postId);
    renderAnalysisDetail(postId);

    // Add to stream
    const sponsored = post.isSponsored ? ' [AD]' : '';
    const suggested = post.isSuggested ? ' [SUG]' : '';
    addStreamEntry('event', `@${post.username} ${post.mediaType}${sponsored}${suggested} — ${(post.imageDescription || '').substring(0, 60)}`);
  } else {
    addStreamEntry('event', `${event.eventType} | ${event.screenType} | ${event.nodeCount} nodes`);
  }

  // Store nodes for potential later use
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

  // Re-render enrichment if current post
  if (state.focusedPost?.postId === data.postId) {
    renderEnrichmentForPost(data.postId);
  }
}

function handleEnrichment(postId, data) {
  state.enrichmentData.set(postId, data);
  state.enrichmentCount++;
  dom.enrichmentCount.textContent = state.enrichmentCount;

  // Add to stream
  const topics = (data.mainTopics || []).join(', ');
  const polScore = data.politicalScore || 0;
  addStreamEntry('enrich', `${topics || 'aucun theme'} | pol:${polScore}/4 | polar:${(data.polarizationScore || 0).toFixed(2)}`);

  // Render if it's the focused post
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
  // Re-render focused post if it's the current one
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

  // Render image thumbnails if available
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

  // Limit entries
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

  // Scores
  if (data) {
    html += '<div class="enrich-section">';
    html += '<div class="enrich-section-title">Scores</div>';
    html += scoreBar('Politique', data.politicalScore, 4, politicalColor(data.politicalScore));
    html += scoreBar('Polarisation', data.polarizationScore, 1, polarizationColor(data.polarizationScore));
    html += scoreBar('Confiance', data.confidenceScore, 1, '#58a6ff');
    html += '</div>';

    // Topics
    if (data.mainTopics?.length || data.secondaryTopics?.length) {
      html += '<div class="enrich-section">';
      html += '<div class="enrich-section-title">Themes</div>';
      for (const t of data.mainTopics || []) {
        html += `<span class="topic-tag topic-main">${esc(t)}</span>`;
      }
      for (const t of data.secondaryTopics || []) {
        html += `<span class="topic-tag topic-secondary">${esc(t)}</span>`;
      }
      for (const t of data.politicalIssueTags || []) {
        html += `<span class="topic-tag topic-political">${esc(t)}</span>`;
      }
      html += '</div>';
    }

    // Signals
    html += '<div class="enrich-section">';
    html += '<div class="enrich-section-title">Signaux</div>';
    html += signal('Activisme', data.activismSignal);
    html += signal('Conflit', data.conflictSignal);
    html += signal('In/Out-group', data.ingroupOutgroupSignal);
    html += signal('Moral absolu', data.moralAbsoluteSignal);
    html += signal('Ennemi designe', data.enemyDesignationSignal);
    html += '</div>';

    // Entities
    if (data.politicalActors?.length || data.institutions?.length) {
      html += '<div class="enrich-section">';
      html += '<div class="enrich-section-title">Entites</div>';
      for (const e of data.politicalActors || []) {
        html += `<span class="entity-tag">${esc(e)}</span>`;
      }
      for (const e of data.institutions || []) {
        html += `<span class="entity-tag" style="background:#1a3a2a;color:var(--green)">${esc(e)}</span>`;
      }
      html += '</div>';
    }
  }

  // MLKit labels (compact)
  if (mlkit?.labels?.length) {
    html += '<div class="enrich-section">';
    html += '<div class="enrich-section-title">MLKit Labels</div>';
    for (const label of mlkit.labels.slice(0, 5)) {
      const pct = Math.round(label.confidence * 100);
      html += `<div class="mlkit-label">
        <span class="mlkit-label-text">${esc(label.text)}</span>
        <div class="mlkit-bar"><div class="mlkit-bar-fill" style="width:${pct}%"></div></div>
        <span class="mlkit-conf">${pct}%</span>
      </div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  dom.enrichmentBody.innerHTML = html;
}

function renderAnalysisDetail(postId) {
  const data = state.enrichmentData.get(postId);
  const mlkit = state.mlkitResults.get(postId);

  dom.analysisPostId.textContent = postId ? postId.substring(0, 20) : '';

  if (!data && !mlkit) {
    dom.analysisBody.innerHTML = '<div class="empty-state">Pas d\'analyse disponible</div>';
    return;
  }

  let html = '';

  // Normalized text
  if (data?.normalizedText) {
    html += '<div class="enrich-section">';
    html += '<div class="enrich-section-title">Texte normalise</div>';
    html += `<div class="normalized-text">${esc(data.normalizedText)}</div>`;
    if (data.language) {
      html += `<div style="margin-top:4px;font-size:10px;color:var(--text-dim)">Langue: ${esc(data.language)}</div>`;
    }
    html += '</div>';
  }

  // MLKit OCR
  if (mlkit?.ocrText) {
    html += '<div class="enrich-section">';
    html += '<div class="enrich-section-title">OCR (MLKit)</div>';
    html += `<div class="normalized-text">${esc(mlkit.ocrText)}</div>`;
    html += '</div>';
  }

  // Score detail
  if (data) {
    html += '<div class="enrich-section">';
    html += '<div class="enrich-section-title">Detail scoring</div>';
    html += `<div style="font-size:11px;color:var(--text-dim);line-height:1.6">`;
    html += `Politique: <strong style="color:${politicalColor(data.politicalScore)}">${data.politicalScore}/4</strong> `;
    html += `| Polarisation: <strong style="color:${polarizationColor(data.polarizationScore)}">${(data.polarizationScore || 0).toFixed(2)}</strong> `;
    html += `| Confiance: <strong style="color:var(--accent)">${(data.confidenceScore || 0).toFixed(2)}</strong>`;
    html += `</div>`;
    html += '</div>';
  }

  dom.analysisBody.innerHTML = html || '<div class="empty-state">Pas d\'analyse</div>';
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

function polarizationColor(score) {
  if (score < 0.2) return 'var(--green)';
  if (score < 0.5) return 'var(--yellow)';
  if (score < 0.7) return 'var(--orange)';
  return 'var(--red)';
}

// ─── Render: Quality ─────────────────────────────────────────────────

function updateQuality(metrics) {
  // Parse rate
  dom.qParse.textContent = `${metrics.parseRate}%`;
  setQualityDot(dom.qParseDot, metrics.parseRate > 90 ? 'good' : metrics.parseRate > 70 ? 'warn' : 'bad');

  // Chunks
  const chunkTotal = metrics.chunkSuccess + metrics.chunkFails;
  dom.qChunks.textContent = `${metrics.chunkSuccess}/${chunkTotal}`;
  setQualityDot(dom.qChunkDot, metrics.chunkFails === 0 ? 'good' : metrics.chunkFails < 3 ? 'warn' : 'bad');

  // Missing fields
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

  // MLKit
  dom.qMlkit.textContent = metrics.mlkitResults;
  setQualityDot(dom.qMlkitDot, metrics.mlkitResults > 0 ? 'good' : 'warn');

  // Enrichment
  dom.qEnrich.textContent = state.enrichmentCount;
  setQualityDot(dom.qEnrichDot, state.enrichmentCount > 0 ? 'good' : 'warn');

  // Events per sec
  dom.statEps.textContent = metrics.eventsPerSec;
}

function setQualityDot(el, level) {
  el.className = `quality-dot q-${level}`;
}

// ─── ADB Status ──────────────────────────────────────────────────────

function updateAdbStatus(status) {
  const connected = status === 'connected';
  dom.adbDot.className = `dot${connected ? ' connected' : ''}`;
  dom.adbLabel.textContent = status;
}

// ─── Dwell timer update ──────────────────────────────────────────────

setInterval(() => {
  if (state.focusedPost && state.focusedDwellStart) {
    renderFocusedPost();
  }

  // Update duration
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  dom.statDuration.textContent = `${min}:${pad(sec)}`;
}, 1000);

// ─── Helpers ─────────────────────────────────────────────────────────

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

// ─── Boot ────────────────────────────────────────────────────────────

connect();
