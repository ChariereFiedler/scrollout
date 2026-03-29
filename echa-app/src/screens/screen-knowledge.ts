import { LitElement, html, css, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, state, query } from 'lit/decorators.js';
import { theme, palette, scrolloutDots } from '../styles/theme.js';
import { getGraphStats, backfillGraph, type GraphStats } from '../services/graph-ingest-mobile.js';

const ico = (path: string, size = 18, color = 'currentColor') => html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;">${unsafeSVG(path)}</svg>`;

const TYPE_CFG: Record<string, { color: string; label: string }> = {
  Theme:          { color: palette.bleuIndigo, label: 'Theme' },
  Subject:        { color: palette.bleuCiel, label: 'Sujet' },
  PreciseSubject: { color: palette.violet, label: 'S. precis' },
  Person:         { color: palette.orange, label: 'Personne' },
  Organization:   { color: palette.rose, label: 'Org.' },
  Institution:    { color: palette.jaune, label: 'Institution' },
  Country:        { color: palette.vertEau, label: 'Pays' },
  Media:          { color: palette.orange, label: 'Media' },
  Domain:         { color: palette.vertMenthe, label: 'Domaine' },
  Narrative:      { color: palette.rouge, label: 'Narratif' },
  Emotion:        { color: palette.vertMenthe, label: 'Emotion' },
  Audience:       { color: palette.textDim, label: 'Audience' },
};

// ── Force-directed graph ───────────────────────────────────────

interface GNode {
  id: string; name: string; type: string; mentions: number;
  x: number; y: number; vx: number; vy: number; radius: number;
}
interface GEdge { source: string; target: string; relation: string; weight: number; }

function simulate(nodes: GNode[], edges: GEdge[], width: number, height: number) {
  const cx = width / 2, cy = height / 2;
  // Spread nodes in a spiral for better initial layout
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 * 2.5;
    const r = 30 + (i / nodes.length) * Math.min(width, height) * 0.35;
    n.x = cx + Math.cos(angle) * r;
    n.y = cy + Math.sin(angle) * r;
    n.vx = 0; n.vy = 0;
  });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const iterations = 200;

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;
    const repulsion = 2500 * alpha;

    // Repulsion — scale with node radius to prevent overlap
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.radius + b.radius + 12;
        const effectiveDist = Math.max(dist, minDist * 0.5);
        const force = repulsion / (effectiveDist * effectiveDist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;

        // Hard overlap prevention
        if (dist < minDist) {
          const push = (minDist - dist) * 0.3;
          a.vx -= (dx / dist) * push; a.vy -= (dy / dist) * push;
          b.vx += (dx / dist) * push; b.vy += (dy / dist) * push;
        }
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source), b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = 70 + a.radius + b.radius;
      const force = (dist - idealDist) * 0.008 * alpha * Math.min(edge.weight, 3);
      a.vx += (dx / dist) * force; a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force;
    }

    // Center gravity — weaker so the graph spreads more
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.008 * alpha;
      n.vy += (cy - n.y) * 0.008 * alpha;
    }

    // Apply
    for (const n of nodes) {
      n.vx *= 0.8; n.vy *= 0.8;
      n.x += n.vx; n.y += n.vy;
      const pad = n.radius + 6;
      n.x = Math.max(pad, Math.min(width - pad, n.x));
      n.y = Math.max(pad, Math.min(height - pad, n.y));
    }
  }
}

function drawGraph(
  ctx: CanvasRenderingContext2D, nodes: GNode[], edges: GEdge[],
  width: number, height: number, selectedId: string | null,
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const connectedToSelected = new Set<string>();
  if (selectedId) {
    for (const e of edges) {
      if (e.source === selectedId) connectedToSelected.add(e.target);
      if (e.target === selectedId) connectedToSelected.add(e.source);
    }
  }

  // Sort nodes by mentions so labels are drawn for top ones
  const sortedByMentions = [...nodes].sort((a, b) => b.mentions - a.mentions);
  const topLabelIds = new Set(sortedByMentions.slice(0, 10).map(n => n.id));

  // Draw edges
  for (const edge of edges) {
    const a = nodeMap.get(edge.source), b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const isSelected = selectedId && (a.id === selectedId || b.id === selectedId);
    const dimmed = selectedId && !isSelected;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    if (isSelected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
    } else if (dimmed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([]);
    } else if (edge.relation === 'coOccurrence') {
      const w = Math.min(edge.weight, 10);
      ctx.strokeStyle = `rgba(107,107,255,${0.06 + w * 0.015})`;
      ctx.lineWidth = 0.5 + w * 0.1;
      ctx.setLineDash([]);
    } else {
      // Structural edge
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw nodes (back to front: small first)
  const sortedForDraw = [...nodes].sort((a, b) => a.radius - b.radius);
  for (const n of sortedForDraw) {
    const cfg = TYPE_CFG[n.type] || { color: palette.textFaint };
    const isSelected = n.id === selectedId;
    const connected = selectedId ? connectedToSelected.has(n.id) : false;
    const dimmed = selectedId && !isSelected && !connected;

    // Outer glow for selected
    if (isSelected) {
      const grad = ctx.createRadialGradient(n.x, n.y, n.radius, n.x, n.y, n.radius + 12);
      grad.addColorStop(0, cfg.color + '40');
      grad.addColorStop(1, cfg.color + '00');
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 12, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Node fill
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    if (dimmed) {
      ctx.fillStyle = cfg.color + '18';
      ctx.strokeStyle = 'transparent';
    } else {
      // Subtle gradient
      const grad = ctx.createRadialGradient(n.x - n.radius * 0.3, n.y - n.radius * 0.3, 0, n.x, n.y, n.radius);
      grad.addColorStop(0, cfg.color + 'DD');
      grad.addColorStop(1, cfg.color + '99');
      ctx.fillStyle = grad;
      ctx.strokeStyle = cfg.color;
    }
    ctx.fill();
    ctx.lineWidth = isSelected ? 2 : 0.5;
    ctx.stroke();

    // Label — show for: selected, connected, or top 10 by mentions (when nothing selected)
    const showLabel = isSelected || connected || (!selectedId && topLabelIds.has(n.id));
    if (showLabel) {
      const fontSize = isSelected ? 11 : connected ? 10 : 9;
      ctx.font = `${isSelected ? '700' : '500'} ${fontSize}px Averia Sans Libre, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = n.name.length > 16 ? n.name.slice(0, 14) + '..' : n.name;
      const labelY = n.y + n.radius + 4;

      // Text shadow for readability
      ctx.fillStyle = 'rgba(10,10,10,0.7)';
      ctx.fillText(label, n.x + 1, labelY + 1);
      ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)';
      ctx.fillText(label, n.x, labelY);
    }
  }

  ctx.restore();
}

// ── Component ──────────────────────────────────────────────────

@customElement('screen-knowledge')
export class ScreenKnowledge extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 40px; }

      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .title { font-family: var(--font-heading); font-size: 20px; font-weight: 700; }
      .subtitle { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
      .refresh { background: var(--surface3); border: 1px solid var(--border); color: var(--text-dim); padding: 6px 14px; border-radius: var(--radius-pill); font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; cursor: pointer; }
      .refresh:active { opacity: 0.7; }

      /* Banner */
      .banner { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
      .bcard { background: var(--surface2); border-radius: var(--radius-sm); padding: 10px 6px; text-align: center; }
      .bval { font-family: var(--font-heading); font-size: 18px; font-weight: 900; background: linear-gradient(135deg, var(--bleu-indigo), var(--violet)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .blbl { font-family: var(--font-mono); font-size: 7px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em; margin-top: 2px; }

      /* Graph canvas */
      .graph-wrap { background: var(--surface2); border-radius: var(--radius); overflow: hidden; margin-bottom: 12px; }
      canvas { display: block; width: 100%; touch-action: none; }
      .graph-legend { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px 12px; border-top: 1px solid var(--border); }
      .legend-item { display: flex; align-items: center; gap: 4px; font-size: 9px; color: var(--text-dim); }
      .legend-dot { width: 7px; height: 7px; border-radius: 50%; }

      /* Detail card */
      .detail { background: linear-gradient(135deg, var(--surface2), var(--surface3)); border-radius: var(--radius); padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); }
      .detail-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .detail-badge { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; font-family: var(--font-heading); }
      .detail-name { font-family: var(--font-heading); font-size: 16px; font-weight: 700; }
      .detail-type { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
      .detail-stat { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); margin-top: 2px; }
      .detail-connections { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .conn-tag { font-size: 10px; padding: 4px 10px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.04); border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 4px; }
      .conn-rel { font-family: var(--font-mono); font-size: 7px; color: var(--text-muted); text-transform: uppercase; }

      /* Section */
      .section { background: var(--surface2); border-radius: var(--radius); padding: 14px; margin-bottom: 12px; }
      .slabel { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; }

      /* Timeline */
      .tl-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); }
      .tl-row:last-child { border-bottom: none; }
      .tl-week { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); width: 70px; flex-shrink: 0; padding-top: 3px; }
      .tl-bars { flex: 1; display: flex; gap: 4px; flex-wrap: wrap; }
      .tl-chip { height: 22px; border-radius: 6px; display: flex; align-items: center; padding: 0 8px; font-size: 9px; font-family: var(--font-mono); font-weight: 500; color: rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; }

      /* Co-occ */
      .cooc-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
      .cooc-row:last-child { border-bottom: none; }
      .cooc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .cooc-e { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 34%; font-weight: 500; }
      .cooc-cnt { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); background: var(--surface3); padding: 2px 8px; border-radius: var(--radius-pill); margin-left: auto; flex-shrink: 0; }

      /* Empty/Loading */
      .empty, .loading { text-align: center; padding: 40px 20px; color: var(--text-dim); }
      .empty h3 { font-family: var(--font-heading); font-size: 16px; color: var(--text); margin: 12px 0 4px; }
      .empty p { font-size: 12px; margin: 0; }
      .loading .dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 12px; }
      .loading .dots span { width: 8px; height: 8px; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }
      .loading .dots span:nth-child(2) { animation-delay: .15s; }
      .loading .dots span:nth-child(3) { animation-delay: .3s; }
      @keyframes pulse { 0%,100% { opacity:.3; transform:scale(.8); } 50% { opacity:1; transform:scale(1.2); } }
    `,
  ];

  @state() private stats: GraphStats | null = null;
  @state() private loading = true;
  @state() private selectedNode: GNode | null = null;
  @query('canvas') private canvas!: HTMLCanvasElement;

  private graphNodes: GNode[] = [];
  private graphEdges: GEdge[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.loadStats();
  }

  private async loadStats() {
    this.loading = true;
    await backfillGraph();
    this.stats = await getGraphStats();
    this.loading = false;
    if (this.stats?.graphNodes?.length) this.buildGraph();
  }

  private buildGraph() {
    const s = this.stats!;
    const maxMentions = Math.max(...(s.graphNodes || []).map(n => n.mentions), 1);
    // Logarithmic scale for radius — prevents huge nodes from crushing small ones
    this.graphNodes = (s.graphNodes || []).map(n => ({
      ...n,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 5 + Math.log2(1 + n.mentions) / Math.log2(1 + maxMentions) * 16,
    }));
    this.graphEdges = s.graphEdges || [];
    this.updateComplete.then(() => this.renderGraph());
  }

  private renderGraph() {
    const canvas = this.canvas;
    if (!canvas) return;
    const w = canvas.parentElement!.getBoundingClientRect().width;
    const h = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = h + 'px';

    simulate(this.graphNodes, this.graphEdges, w, h);
    drawGraph(canvas.getContext('2d')!, this.graphNodes, this.graphEdges, w, h, this.selectedNode?.id || null);
  }

  private onCanvasTap(e: MouseEvent | TouchEvent) {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.changedTouches[0].clientY : e.clientY;
    const x = cx - rect.left, y = cy - rect.top;

    let closest: GNode | null = null;
    let minDist = Infinity;
    for (const n of this.graphNodes) {
      const d = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
      if (d < n.radius + 14 && d < minDist) { closest = n; minDist = d; }
    }
    this.selectedNode = closest?.id === this.selectedNode?.id ? null : closest;
    drawGraph(canvas.getContext('2d')!, this.graphNodes, this.graphEdges,
      rect.width, 340, this.selectedNode?.id || null);
  }

  // ── Render ─────────────────────────────────────────────────

  render() {
    if (this.loading) return html`
      <div class="header"><div><div class="title">Ontologie</div></div></div>
      <div class="loading">
        <div class="dots">${scrolloutDots.slice(0, 3).map(c => html`<span style="background:${c}"></span>`)}</div>
        <div style="font-size:12px">Construction du graphe...</div>
      </div>
    `;

    if (!this.stats || this.stats.totalEntities === 0) return html`
      <div class="header"><div><div class="title">Ontologie</div></div></div>
      <div class="empty">
        ${ico('<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/>', 40, 'var(--text-muted)')}
        <h3>Graphe vide</h3>
        <p>Parcourez Instagram — les entites apparaitront ici.</p>
      </div>
    `;

    const s = this.stats;
    return html`
      <div class="header">
        <div>
          <div class="title">Ontologie</div>
          <div class="subtitle">${s.totalEntities} entites &middot; ${s.totalObservations} observations &middot; ${s.totalEdges || 0} relations</div>
        </div>
        <button class="refresh" @click=${() => this.loadStats()}>Refresh</button>
      </div>

      ${this._banner(s)}
      ${this._graph()}
      ${this.selectedNode ? this._detail() : nothing}
      ${this._coOccurrences(s)}
      ${this._timeline(s)}
    `;
  }

  private _banner(s: GraphStats) {
    return html`
      <div class="banner">
        <div class="bcard"><div class="bval">${s.totalEntities}</div><div class="blbl">Entites</div></div>
        <div class="bcard"><div class="bval">${s.totalObservations}</div><div class="blbl">Observ.</div></div>
        <div class="bcard"><div class="bval">${s.totalEdges || 0}</div><div class="blbl">Relations</div></div>
        <div class="bcard"><div class="bval">${s.postsInGraph}</div><div class="blbl">Posts</div></div>
      </div>
    `;
  }

  private _graph() {
    if (!this.graphNodes.length) return nothing;
    const visibleTypes = [...new Set(this.graphNodes.map(n => n.type))];
    return html`
      <div class="graph-wrap">
        <canvas @click=${(e: MouseEvent) => this.onCanvasTap(e)} @touchend=${(e: TouchEvent) => this.onCanvasTap(e)}></canvas>
        <div class="graph-legend">
          ${visibleTypes.filter(t => t !== 'Audience').map(t => {
            const cfg = TYPE_CFG[t] || { color: '#555', label: t };
            return html`<span class="legend-item"><span class="legend-dot" style="background:${cfg.color}"></span>${cfg.label}</span>`;
          })}
        </div>
      </div>
    `;
  }

  private _detail() {
    const n = this.selectedNode!;
    const cfg = TYPE_CFG[n.type] || { color: '#555', label: n.type };
    const connections = this.graphEdges
      .filter(e => e.source === n.id || e.target === n.id)
      .map(e => {
        const otherId = e.source === n.id ? e.target : e.source;
        const other = this.graphNodes.find(gn => gn.id === otherId);
        return other ? { name: other.name, type: other.type, relation: e.relation } : null;
      })
      .filter(Boolean) as Array<{ name: string; type: string; relation: string }>;

    // Deduplicate and sort structural first
    const seen = new Set<string>();
    const unique = connections.filter(c => {
      const key = c.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      if (a.relation !== 'coOccurrence' && b.relation === 'coOccurrence') return -1;
      if (a.relation === 'coOccurrence' && b.relation !== 'coOccurrence') return 1;
      return 0;
    });

    const REL: Record<string, string> = {
      affiliatedWith: 'affilie',
      belongsTo: 'dans',
      relatedTo: 'lie a',
      coOccurrence: 'vu avec',
      associatedWith: 'associe',
    };

    return html`
      <div class="detail">
        <div class="detail-head">
          <div class="detail-badge" style="background:${cfg.color};color:var(--bg)">${n.name[0].toUpperCase()}</div>
          <div>
            <div class="detail-name">${n.name}</div>
            <div class="detail-type" style="color:${cfg.color}">${cfg.label}</div>
            <div class="detail-stat">${n.mentions} mentions &middot; ${unique.length} connexions</div>
          </div>
        </div>
        ${unique.length ? html`
          <div class="detail-connections">
            ${unique.slice(0, 10).map(c => {
              const cc = TYPE_CFG[c.type] || { color: palette.textFaint };
              const isStructural = c.relation !== 'coOccurrence';
              return html`
                <span class="conn-tag" style="${isStructural ? `border-color:${cc.color}40` : ''}">
                  <span class="conn-rel">${REL[c.relation] || c.relation}</span>
                  <span style="color:${cc.color};font-weight:${isStructural ? '600' : '400'}">${c.name}</span>
                </span>
              `;
            })}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _coOccurrences(s: GraphStats) {
    if (!s.coOccurrences?.length) return nothing;
    // Filter: only show cross-type co-occurrences (more interesting than theme↔theme)
    const interesting = s.coOccurrences.filter(c => c.type1 !== c.type2);
    const shown = interesting.length >= 3 ? interesting : s.coOccurrences;

    return html`
      <div class="section">
        <div class="slabel">
          ${ico('<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m10 0h3a2 2 0 002-2v-3"/>', 14, 'var(--vert-menthe)')}
          Connexions observees
        </div>
        ${shown.slice(0, 8).map(c => {
          const c1 = TYPE_CFG[c.type1] || { color: '#555' };
          const c2 = TYPE_CFG[c.type2] || { color: '#555' };
          return html`
            <div class="cooc-row">
              <span class="cooc-dot" style="background:${c1.color}"></span>
              <span class="cooc-e" style="color:${c1.color}">${c.entity1}</span>
              <span style="color:var(--text-muted);font-size:8px">&harr;</span>
              <span class="cooc-e" style="color:${c2.color}">${c.entity2}</span>
              <span class="cooc-cnt">${c.count}x</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _timeline(s: GraphStats) {
    if (!s.timeline?.length) return nothing;
    return html`
      <div class="section">
        <div class="slabel">
          ${ico('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', 14, 'var(--bleu-ciel)')}
          Evolution
        </div>
        ${s.timeline.slice(0, 4).map(w => {
          const maxCount = w.entities[0]?.count || 1;
          return html`
            <div class="tl-row">
              <div class="tl-week">${w.week}</div>
              <div class="tl-bars">
                ${w.entities.slice(0, 6).map(e => {
                  const pct = Math.max(20, (e.count / maxCount) * 100);
                  const node = this.graphNodes.find(n => n.name === e.name);
                  const cfg = TYPE_CFG[node?.type || 'Theme'] || { color: palette.bleuIndigo };
                  return html`<span class="tl-chip" style="width:${pct}%;background:${cfg.color}">${e.name}</span>`;
                })}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}
