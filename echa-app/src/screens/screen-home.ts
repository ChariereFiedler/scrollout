import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, scrolloutDots, domainColors, attentionColors } from '../styles/theme.js';
import { openInstagram } from '../services/native-bridge.js';
import { getStats, type DbStats } from '../services/db-bridge.js';

@customElement('screen-home')
export class ScreenHome extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 20px 16px 32px; }

      /* ── Header ── */
      .header {
        text-align: center;
        margin-bottom: 28px;
      }
      .logo {
        font-family: var(--font-heading);
        font-size: 28px;
        font-weight: 900;
        letter-spacing: -0.5px;
      }
      .logo .o { color: var(--bleu-indigo); }
      .dots {
        display: flex;
        justify-content: center;
        gap: 5px;
        margin: 10px 0 6px;
      }
      .dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .subtitle {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-dim);
      }

      /* ── Empty state ── */
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        gap: 20px;
        text-align: center;
      }
      .empty-hook {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 900;
        line-height: 1.3;
        margin-bottom: 4px;
      }
      .empty-hook .hl { color: var(--orange); }
      .empty-text {
        color: var(--text-dim);
        font-size: 14px;
        line-height: 1.6;
        max-width: 280px;
      }
      .btn-launch {
        background: var(--bleu-indigo);
        color: #fff;
        border: none;
        padding: 14px 36px;
        border-radius: var(--radius-pill);
        font-size: 15px;
        font-weight: 600;
        font-family: var(--font-body);
        cursor: pointer;
        transition: transform 0.15s;
      }
      .btn-launch:active { transform: scale(0.97); }

      /* ── Verdict card ── */
      .verdict {
        background: var(--surface2);
        border-radius: var(--radius);
        padding: 24px 20px;
        margin-bottom: 16px;
        text-align: center;
      }
      .verdict-label {
        font-family: var(--font-mono);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        margin-bottom: 10px;
      }
      .verdict-main {
        font-family: var(--font-heading);
        font-size: 20px;
        font-weight: 700;
        line-height: 1.35;
        margin-bottom: 10px;
      }
      .verdict-main .hl { font-weight: 900; }
      .verdict-sub {
        font-size: 12px;
        color: var(--text-dim);
        line-height: 1.5;
      }

      /* ── Stats row ── */
      .stats-row {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .stat-card {
        flex: 1;
        background: var(--surface2);
        border-radius: var(--radius-sm);
        padding: 14px 8px;
        text-align: center;
      }
      .stat-val {
        font-family: var(--font-heading);
        font-size: 24px;
        font-weight: 700;
        line-height: 1.1;
      }
      .stat-label {
        font-family: var(--font-mono);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-dim);
        margin-top: 4px;
      }

      /* ── Section ── */
      .section {
        background: var(--surface2);
        border-radius: var(--radius);
        padding: 16px;
        margin-bottom: 14px;
      }
      .section-label {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-dim);
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
      }

      /* ── Reveal cards ── */
      .reveals {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .reveal {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--border);
      }
      .reveal-icon {
        font-size: 22px;
        line-height: 1;
        flex-shrink: 0;
        width: 28px;
        text-align: center;
      }
      .reveal-body { flex: 1; }
      .reveal-headline {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.3;
        margin-bottom: 3px;
      }
      .reveal-headline strong {
        font-family: var(--font-mono);
        font-weight: 700;
      }
      .reveal-detail {
        font-size: 11px;
        color: var(--text-dim);
        line-height: 1.5;
      }

      /* ── Attention ── */
      .attention-visual {
        display: flex;
        gap: 3px;
        height: 28px;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      .att-seg {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 600;
        color: var(--bg);
        min-width: 0;
        overflow: hidden;
        transition: flex 0.4s;
      }
      .att-row {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 4px;
      }
      .att-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: var(--text-dim);
      }
      .att-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      /* ── Top accounts ── */
      .accounts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .account {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--surface3);
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        padding: 4px 10px;
        font-size: 11px;
      }
      .account .at { color: var(--violet); font-weight: 600; }
      .account .cnt { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); }

      /* ── CTA ── */
      .cta {
        text-align: center;
        margin-top: 8px;
      }
      .btn-cta {
        background: transparent;
        color: var(--bleu-indigo);
        border: 2px solid var(--bleu-indigo);
        padding: 12px 32px;
        border-radius: var(--radius-pill);
        font-size: 14px;
        font-weight: 600;
        font-family: var(--font-body);
        cursor: pointer;
      }
      .btn-cta:active { transform: scale(0.97); }

      /* ── Wrapped CTA ── */
      .wrapped-banner {
        background: linear-gradient(135deg, #6B6BFF 0%, #8B44E8 100%);
        border-radius: var(--radius);
        padding: 18px 20px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.15s;
      }
      .wrapped-banner:active { transform: scale(0.98); }
      .wrapped-banner .wb-left {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .wrapped-banner .wb-title {
        font-family: var(--font-heading);
        font-weight: 900;
        font-size: 18px;
        color: #fff;
      }
      .wrapped-banner .wb-sub {
        font-size: 11px;
        color: rgba(255,255,255,0.75);
      }
      .wrapped-banner .wb-arrow {
        font-size: 20px;
        color: rgba(255,255,255,0.8);
      }
    `,
  ];

  @state() private launching = false;
  @state() private stats: DbStats | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadStats();
  }

  private async loadStats() {
    try { this.stats = await getStats(); } catch { /* */ }
  }

  private openWrapped() {
    this.dispatchEvent(new CustomEvent('open-wrapped', { bubbles: true, composed: true }));
  }

  private async launch() {
    this.launching = true;
    try {
      await openInstagram();
      this.dispatchEvent(new CustomEvent('instagram-opened', { bubbles: true, composed: true }));
    } catch (e) {
      console.warn('[Scrollout] Launch failed:', e);
    } finally {
      this.launching = false;
    }
  }

  render() {
    const s = this.stats;
    const hasData = s && s.totalPosts > 0;

    return html`
      <div class="header">
        <div class="logo">Scr<span class="o">o</span>llout</div>
        <div class="dots">${scrolloutDots.map(c => html`<span style="background:${c}"></span>`)}</div>
        <div class="subtitle">ton feed, decrypte</div>
      </div>

      ${hasData ? html`
        <div class="wrapped-banner" @click=${this.openWrapped}>
          <div class="wb-left">
            <div class="wb-title">Ton Wrapped est pret</div>
            <div class="wb-sub">Decouvre ce que l'algorithme t'a vraiment montre</div>
          </div>
          <span class="wb-arrow">→</span>
        </div>
      ` : ''}

      ${!hasData ? html`
        <div class="empty">
          <div class="empty-hook">
            Tu scrolles.<br/>L'algorithme choisit.<br/><span class="hl">Tu ne vois rien.</span>
          </div>
          <div class="empty-text">
            Ouvre Instagram normalement.<br/>
            Scrollout analyse chaque post en arriere-plan — sans rien changer a ton experience.
          </div>
          <button class="btn-launch" @click=${this.launch} ?disabled=${this.launching}>
            ${this.launching ? 'Lancement...' : 'Ouvrir Instagram'}
          </button>
        </div>
      ` : this.renderDashboard(s!)}
    `;
  }

  private renderDashboard(s: DbStats) {
    const avgPolar = s.avgPolarization ?? 0;
    const totalMinutes = Math.round((s.totalDwellMs || 0) / 60000);
    const totalAttention = Object.values(s.attention).reduce((a, b) => (a as number) + (b as number), 0) as number;

    // Compute insights
    const topDomain = s.topDomains[0];
    const totalDomains = s.topDomains.reduce((a, d) => a + d.count, 0);
    const topDomainPct = topDomain && totalDomains > 0 ? Math.round(topDomain.count / totalDomains * 100) : 0;

    const polEntries = Object.entries(s.political);
    const totalPol = polEntries.reduce((a, [, c]) => a + (c as number), 0);
    const politicalPosts = polEntries.filter(([sc]) => parseInt(sc) >= 2).reduce((a, [, c]) => a + (c as number), 0);
    const politicalPct = totalPol > 0 ? Math.round(politicalPosts / totalPol * 100) : 0;

    const engagedPct = totalAttention > 0 ? Math.round(((s.attention['engaged'] as number || 0) / totalAttention) * 100) : 0;
    const skippedPct = totalAttention > 0 ? Math.round(((s.attention['skipped'] as number || 0) / totalAttention) * 100) : 0;

    // Build verdict
    const verdictText = this.buildVerdict(s, topDomainPct, topDomain?.domain, politicalPct, avgPolar);

    return html`
      <!-- Verdict — the "mirror" -->
      <div class="verdict">
        <div class="verdict-label">Ce que l'algorithme te montre</div>
        <div class="verdict-main">${verdictText}</div>
        <div class="verdict-sub">
          Base sur ${s.totalPosts} posts captures en ${s.totalSessions} session${s.totalSessions > 1 ? 's' : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-val" style="color:var(--bleu-indigo)">${s.totalPosts}</div>
          <div class="stat-label">Posts vus</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:var(--vert-menthe)">${s.totalEnriched}</div>
          <div class="stat-label">Analyses</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:var(--orange)">${totalMinutes > 0 ? `${totalMinutes}m` : '<1m'}</div>
          <div class="stat-label">Temps</div>
        </div>
      </div>

      <!-- Reveals — what the algorithm hides -->
      <div class="section">
        <div class="section-label">Ce que tu ne voyais pas</div>
        <div class="reveals">
          ${topDomain ? html`
            <div class="reveal" style="border-color:${domainColors[topDomain.domain.toLowerCase()] || 'var(--bleu-indigo)'}">
              <div class="reveal-icon" style="color:${domainColors[topDomain.domain.toLowerCase()] || 'var(--bleu-indigo)'}">
                ${this.domainIcon(topDomain.domain)}
              </div>
              <div class="reveal-body">
                <div class="reveal-headline">
                  <strong>${topDomainPct}%</strong> de ton feed est du ${topDomain.domain.toLowerCase()}
                </div>
                <div class="reveal-detail">
                  ${topDomainPct > 50
                    ? 'L\'algorithme concentre fortement ton exposition sur un seul domaine.'
                    : topDomainPct > 30
                    ? 'Un domaine domine, mais ton feed reste relativement varie.'
                    : 'Ton feed est plutot diversifie en termes de contenu.'}
                </div>
              </div>
            </div>
          ` : ''}

          ${politicalPct > 0 ? html`
            <div class="reveal" style="border-color:var(--orange)">
              <div class="reveal-icon" style="color:var(--orange)">${politicalPct >= 20 ? '!!' : '!'}</div>
              <div class="reveal-body">
                <div class="reveal-headline">
                  <strong>${politicalPct}%</strong> a une dimension politique explicite
                </div>
                <div class="reveal-detail">
                  ${politicalPct >= 30
                    ? 'Ton feed contient une forte proportion de contenu politise. Ce n\'est pas un choix — c\'est une selection algorithmique.'
                    : politicalPct >= 10
                    ? 'L\'algorithme te montre regulierement du contenu a teneur politique.'
                    : 'Peu de contenu politique dans ton feed.'}
                </div>
              </div>
            </div>
          ` : html`
            <div class="reveal" style="border-color:var(--vert-menthe)">
              <div class="reveal-icon" style="color:var(--vert-menthe)">~</div>
              <div class="reveal-body">
                <div class="reveal-headline">Pas de contenu politique detecte</div>
                <div class="reveal-detail">L'algorithme ne te montre pas (ou peu) de contenu politise.</div>
              </div>
            </div>
          `}

          <div class="reveal" style="border-color:${avgPolar > 0.4 ? 'var(--rouge)' : avgPolar > 0.2 ? 'var(--jaune)' : 'var(--vert-menthe)'}">
            <div class="reveal-icon" style="color:${avgPolar > 0.4 ? 'var(--rouge)' : avgPolar > 0.2 ? 'var(--jaune)' : 'var(--vert-menthe)'}">${avgPolar.toFixed(1)}</div>
            <div class="reveal-body">
              <div class="reveal-headline">
                Polarisation ${avgPolar < 0.2 ? 'faible' : avgPolar < 0.4 ? 'moderee' : avgPolar < 0.6 ? 'elevee' : 'forte'}
              </div>
              <div class="reveal-detail">
                ${avgPolar < 0.2
                  ? 'Ton feed contient peu de contenu clivant ou polarisant.'
                  : avgPolar < 0.4
                  ? 'Certains contenus utilisent des techniques de polarisation (opposition binaire, designation d\'ennemi).'
                  : 'Une part importante de ton feed utilise un langage polarisant — clivages, ennemis designes, absolus moraux.'}
              </div>
            </div>
          </div>

          ${skippedPct > 50 ? html`
            <div class="reveal" style="border-color:var(--text-muted)">
              <div class="reveal-icon" style="color:var(--text-muted)">${skippedPct}%</div>
              <div class="reveal-body">
                <div class="reveal-headline">Tu scrolles plus que tu ne regardes</div>
                <div class="reveal-detail">${skippedPct}% des posts sont passes en moins d'une demi-seconde. L'algorithme te montre du contenu que tu ignores.</div>
              </div>
            </div>
          ` : engagedPct > 30 ? html`
            <div class="reveal" style="border-color:var(--vert-menthe)">
              <div class="reveal-icon" style="color:var(--vert-menthe)">${engagedPct}%</div>
              <div class="reveal-body">
                <div class="reveal-headline">Tu t'arretes sur ${engagedPct}% des posts</div>
                <div class="reveal-detail">Tu prends le temps de regarder une bonne partie du contenu. L'algorithme capte cette attention.</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Attention -->
      ${totalAttention > 0 ? html`
        <div class="section">
          <div class="section-label">Ou va ton attention</div>
          <div class="attention-visual">
            ${(['engaged', 'viewed', 'glanced', 'skipped'] as const).map(level => {
              const count = (s.attention[level] as number) || 0;
              const pct = count / totalAttention * 100;
              return pct > 0 ? html`
                <div class="att-seg" style="flex:${pct};background:${attentionColors[level]}">${pct > 12 ? `${Math.round(pct)}%` : ''}</div>
              ` : nothing;
            })}
          </div>
          <div class="att-row">
            ${(['engaged', 'viewed', 'glanced', 'skipped'] as const).map(level => {
              const count = (s.attention[level] as number) || 0;
              const labels: Record<string, string> = { engaged: 'Engage (>5s)', viewed: 'Vu (2-5s)', glanced: 'Apercu (<2s)', skipped: 'Ignore (<0.5s)' };
              return count > 0 ? html`
                <div class="att-item">
                  <span class="att-dot" style="background:${attentionColors[level]}"></span>
                  ${labels[level]} (${count})
                </div>
              ` : nothing;
            })}
          </div>
        </div>
      ` : ''}

      <!-- Top sujets -->
      ${s.topTopics.length > 0 ? html`
        <div class="section">
          <div class="section-label">Sujets dominants</div>
          <div class="reveals">
            ${s.topTopics.slice(0, 4).map((t, i) => {
              const topicTotal = s.topTopics.reduce((a, x) => a + x.count, 0);
              const pct = topicTotal > 0 ? Math.round(t.count / topicTotal * 100) : 0;
              const color = scrolloutDots[i % scrolloutDots.length];
              return html`
                <div class="reveal" style="border-color:${color}">
                  <div class="reveal-icon" style="color:${color};font-family:var(--font-mono);font-size:14px;font-weight:700;">${pct}%</div>
                  <div class="reveal-body">
                    <div class="reveal-headline" style="text-transform:capitalize">${t.topic}</div>
                    <div class="reveal-detail">${t.count} posts classes dans ce sujet</div>
                  </div>
                </div>
              `;
            })}
          </div>
        </div>
      ` : ''}

      <!-- Attention × Politique : est-ce que tu t'arrêtes plus sur le contenu politique ? -->
      ${s.attentionPolitical ? (() => {
        const ap = s.attentionPolitical!;
        const engaged = ap['engaged'];
        const skipped = ap['skipped'];
        if (!engaged || !skipped) return '';
        const engagedPol = engaged.avgPolitical;
        const skippedPol = skipped.avgPolitical;
        const engagedPolar = engaged.avgPolarization;
        const diff = engagedPol - skippedPol;
        return html`
          <div class="section">
            <div class="section-label">L'algorithme et toi</div>
            <div class="reveals">
              <div class="reveal" style="border-color:${diff > 0.3 ? 'var(--rouge)' : diff > 0 ? 'var(--jaune)' : 'var(--vert-menthe)'}">
                <div class="reveal-icon" style="color:${diff > 0.3 ? 'var(--rouge)' : diff > 0 ? 'var(--jaune)' : 'var(--vert-menthe)'}">
                  ${diff > 0 ? '+' : ''}${diff.toFixed(1)}
                </div>
                <div class="reveal-body">
                  <div class="reveal-headline">
                    ${diff > 0.3 ? 'Tu t\'arretes plus sur le contenu politique'
                      : diff > 0 ? 'Legere tendance a regarder le contenu politique'
                      : 'Tu ne t\'arretes pas plus sur le politique'}
                  </div>
                  <div class="reveal-detail">
                    Score moyen des posts engages : ${engagedPol.toFixed(1)}/4.
                    Posts ignores : ${skippedPol.toFixed(1)}/4.
                    ${diff > 0 ? 'L\'algorithme detecte cet interet et t\'en montre davantage.' : ''}
                  </div>
                </div>
              </div>
              ${engagedPolar > 0.2 ? html`
                <div class="reveal" style="border-color:var(--violet)">
                  <div class="reveal-icon" style="color:var(--violet)">${engagedPolar.toFixed(2)}</div>
                  <div class="reveal-body">
                    <div class="reveal-headline">Le contenu qui te capte est polarisant</div>
                    <div class="reveal-detail">Les posts sur lesquels tu passes du temps ont une polarisation de ${engagedPolar.toFixed(2)} en moyenne.</div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      })() : ''}

      <!-- Signaux de polarisation détectés -->
      ${s.signals && s.signals.total > 0 ? (() => {
        const sig = s.signals!;
        const total = sig.total;
        const activeSignals = [
          { name: 'Activisme', count: sig.activism, color: 'var(--rouge)', desc: 'appels a l\'action, mobilisation' },
          { name: 'Conflit', count: sig.conflict, color: 'var(--orange)', desc: 'vocabulaire de guerre, combat, ennemi' },
          { name: 'Absolus moraux', count: sig.moralAbsolute, color: 'var(--violet)', desc: 'fascisme, genocide, monstrueux' },
          { name: 'Designation d\'ennemi', count: sig.enemyDesignation, color: 'var(--rose)', desc: '"dehors", "degagez", exclusion' },
          { name: 'Nous vs Eux', count: sig.ingroupOutgroup, color: 'var(--jaune)', desc: 'elites vs peuple, communautarisme' },
        ].filter(s => s.count > 0);

        if (activeSignals.length === 0) return '';
        return html`
          <div class="section">
            <div class="section-label">Signaux de polarisation</div>
            <div class="reveals">
              ${activeSignals.map(s => html`
                <div class="reveal" style="border-color:${s.color}">
                  <div class="reveal-icon" style="color:${s.color};font-family:var(--font-mono);font-size:16px;font-weight:700;">${s.count}</div>
                  <div class="reveal-body">
                    <div class="reveal-headline">${s.name}</div>
                    <div class="reveal-detail">${s.count} post${s.count > 1 ? 's' : ''} sur ${total} — ${s.desc}</div>
                  </div>
                </div>
              `)}
            </div>
          </div>
        `;
      })() : ''}

      <!-- Sponsorisé vs organique -->
      ${s.sponsoredStats?.sponsored ? (() => {
        const sp = s.sponsoredStats!;
        const spCount = sp.sponsored?.count || 0;
        const orgCount = sp.organic?.count || 0;
        const total = spCount + orgCount;
        const spPct = total > 0 ? Math.round(spCount / total * 100) : 0;
        const spDwell = sp.sponsored?.avgDwellMs || 0;
        const orgDwell = sp.organic?.avgDwellMs || 0;
        if (spCount === 0) return '';
        return html`
          <div class="section">
            <div class="section-label">Contenu sponsorise</div>
            <div class="reveals">
              <div class="reveal" style="border-color:var(--jaune)">
                <div class="reveal-icon" style="color:var(--jaune);font-family:var(--font-mono);font-size:14px;font-weight:700;">${spPct}%</div>
                <div class="reveal-body">
                  <div class="reveal-headline">${spCount} pub${spCount > 1 ? 's' : ''} dans ton feed</div>
                  <div class="reveal-detail">
                    Tu passes ${Math.round(spDwell / 1000)}s en moyenne sur une pub,
                    vs ${Math.round(orgDwell / 1000)}s sur du contenu organique.
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      })() : ''}

      <!-- Top accounts -->
      ${s.topUsers.length > 0 ? html`
        <div class="section">
          <div class="section-label">Comptes les plus montres</div>
          <div class="accounts">
            ${s.topUsers.slice(0, 8).map(u => html`
              <div class="account">
                <span class="at">@${u.username}</span>
                <span class="cnt">${u.count}</span>
              </div>
            `)}
          </div>
        </div>
      ` : ''}

      <div class="cta">
        <button class="btn-cta" @click=${this.launch}>Continuer la capture</button>
      </div>
    `;
  }

  private buildVerdict(s: DbStats, topDomainPct: number, topDomain: string | undefined, politicalPct: number, avgPolar: number) {
    // Build a human-readable verdict sentence
    const parts: any[] = [];

    if (topDomain && topDomainPct > 40) {
      parts.push(html`Ton feed est <span class="hl" style="color:${domainColors[topDomain.toLowerCase()] || 'var(--bleu-indigo)'}">${topDomainPct}% ${topDomain.toLowerCase()}</span>`);
    } else if (s.topTopics.length > 0) {
      const topics = s.topTopics.slice(0, 2).map(t => t.topic).join(' et ');
      parts.push(html`Ton feed tourne autour de <span class="hl" style="color:var(--bleu-indigo)">${topics}</span>`);
    }

    if (politicalPct >= 15) {
      parts.push(html`, avec <span class="hl" style="color:var(--orange)">${politicalPct}%</span> de contenu politique`);
    }

    if (avgPolar >= 0.3) {
      parts.push(html` et un <span class="hl" style="color:var(--rouge)">ton polarisant</span>`);
    }

    if (parts.length === 0) {
      return html`On analyse ton feed. Scrolle encore un peu pour des insights plus precis.`;
    }

    return html`${parts}.`;
  }

  private domainIcon(domain: string): string {
    const icons: Record<string, string> = {
      'divertissement': '>>',
      'culture': '#',
      'lifestyle': '~',
      'politique': '!!',
      'sport': '//',
      'actualité': '>>',
      'technologie': '<>',
    };
    return icons[domain.toLowerCase()] || '//';
  }
}
