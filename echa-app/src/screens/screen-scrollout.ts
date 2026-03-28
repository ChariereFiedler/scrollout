import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots, scrolloutIconSvg } from '../styles/theme.js';
import { getPosts, getStats, safeParse, type DbStats, type PostEntry } from '../services/db-bridge.js';

type SortMode = 'dwell' | 'engagement';

interface TopicSeed {
  username: string;
  score: number;
}

interface TopicCard {
  id: string;
  label: string;
  dwellMs: number;
  engagedPosts: number;
  postCount: number;
  engagementRate: number;
  playlistSeed: TopicSeed | null;
  radioQueries: string[];
}

interface MajorTopic {
  id: string;
  label: string;
  queries: string[];
}

const MAJOR_TOPICS: MajorTopic[] = [
  { id: 'ai', label: 'IA generative', queries: ['intelligence artificielle', 'ai tools', 'gen ai reels'] },
  { id: 'finance', label: 'Finance perso', queries: ['budget perso', 'finance personnelle', 'investing basics'] },
  { id: 'nutrition', label: 'Nutrition', queries: ['nutrition saine', 'meal prep', 'healthy food ideas'] },
];

@customElement('screen-scrollout')
export class ScreenScrollout extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
        padding: 16px;
        padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px));
      }

      .stack {
        display: grid;
        gap: 14px;
      }

      .hero {
        position: relative;
        overflow: hidden;
        border-radius: 26px;
        padding: 20px 18px 18px;
        background:
          radial-gradient(circle at top right, rgba(255, 233, 74, 0.16), transparent 35%),
          radial-gradient(circle at bottom left, rgba(107, 107, 255, 0.18), transparent 45%),
          linear-gradient(160deg, var(--surface2), var(--surface));
        border: 1px solid var(--border);
      }

      .hero::after {
        content: '';
        position: absolute;
        inset: auto -40px -60px auto;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(232, 139, 232, 0.14), transparent 70%);
        pointer-events: none;
      }

      .hero-top,
      .section-head,
      .topic-row,
      .wrap-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .hero-top {
        margin-bottom: 16px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .brand-mark svg {
        width: 30px;
        height: 30px;
      }

      .eyebrow,
      .stat-label,
      .section-meta {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-dim);
      }

      .title,
      .section-title,
      .wrap-title {
        font-family: var(--font-heading);
        font-weight: 900;
      }

      .title {
        font-size: 26px;
        line-height: 1;
      }

      .section-title {
        font-size: 18px;
      }

      .wrap-title {
        font-size: 20px;
        margin-bottom: 4px;
      }

      .sub,
      .wrap-note,
      .topic-metric,
      .empty {
        color: var(--text-dim);
        font-size: 12px;
        line-height: 1.5;
      }

      .ghost-btn,
      .metric-btn,
      .pill-btn {
        border: 1px solid var(--border);
        background: var(--surface3);
        color: var(--text);
        border-radius: var(--radius-pill);
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        cursor: pointer;
      }

      .ghost-btn,
      .metric-btn,
      .pill-btn {
        padding: 8px 12px;
      }

      .hero-actions,
      .sort-row,
      .topic-actions,
      .dot-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .primary-btn {
        border: none;
        background: linear-gradient(90deg, var(--bleu-indigo), var(--violet));
        color: #fff;
      }

      .stats-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 18px;
      }

      .stat,
      .section-card,
      .topic-card {
        border: 1px solid var(--border);
      }

      .stat {
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.04);
      }

      .stat-value {
        font-size: 16px;
        font-weight: 800;
      }

      .section-card {
        border-radius: var(--radius);
        padding: 16px;
        background: var(--surface2);
      }

      .wrap-card {
        align-items: center;
      }

      .dot-row {
        margin-top: 12px;
      }

      .dot-row span {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      .metric-btn.active {
        color: var(--accent);
        background: rgba(107, 107, 255, 0.12);
        border-color: rgba(107, 107, 255, 0.28);
      }

      .topic-list {
        display: grid;
        gap: 10px;
      }

      .topic-card {
        border-radius: 18px;
        padding: 14px;
        background: var(--surface3);
      }

      .topic-name {
        font-size: 15px;
        font-weight: 800;
        margin-bottom: 4px;
      }

      .topic-actions {
        margin-top: 12px;
      }

      .card-btn {
        min-width: 88px;
      }

      .secondary-btn {
        color: var(--text-dim);
        background: transparent;
      }

      .empty {
        padding: 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        text-align: center;
      }

      @media (max-width: 680px) {
        .hero-top,
        .section-head,
        .wrap-card,
        .topic-row {
          align-items: flex-start;
          flex-direction: column;
        }

        .stats-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state() private loading = true;
  @state() private sortMode: SortMode = 'dwell';
  @state() private stats: DbStats | null = null;
  @state() private topics: TopicCard[] = [];
  @state() private radioCursor: Record<string, number> = {};

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.loading = true;
    try {
      const [stats, posts] = await Promise.all([getStats(), getPosts('', 0, 400)]);
      this.stats = stats;
      this.topics = this.buildTopicCards(posts);
    } finally {
      this.loading = false;
    }
  }

  private dispatch(name: string, detail?: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private buildTopicCards(posts: PostEntry[]): TopicCard[] {
    const topics = new Map<string, {
      label: string;
      dwellMs: number;
      postCount: number;
      engagedPosts: number;
      accounts: Map<string, number>;
    }>();

    for (const post of posts) {
      const labels = safeParse(post.enrichment?.mainTopics).filter(Boolean);
      if (labels.length === 0) continue;

      const username = (post.username || '').trim().toLowerCase();
      const dwellMs = Number(post.dwellTimeMs || 0);
      const engaged = post.attentionLevel === 'engaged' || post.attentionLevel === 'viewed';
      const accountContribution = (engaged ? 2 : 0.5) + (dwellMs / 10000);

      for (const rawLabel of labels.slice(0, 3)) {
        const label = rawLabel.trim();
        const key = label.toLowerCase();
        if (!key) continue;

        if (!topics.has(key)) {
          topics.set(key, {
            label,
            dwellMs: 0,
            postCount: 0,
            engagedPosts: 0,
            accounts: new Map<string, number>(),
          });
        }

        const topic = topics.get(key)!;
        topic.dwellMs += dwellMs;
        topic.postCount += 1;
        if (engaged) topic.engagedPosts += 1;
        if (username) {
          topic.accounts.set(username, (topic.accounts.get(username) || 0) + accountContribution);
        }
      }
    }

    return Array.from(topics.entries()).map(([id, topic]) => {
      const playlistSeed = Array.from(topic.accounts.entries())
        .sort((a, b) => b[1] - a[1])[0];

      return {
        id,
        label: topic.label,
        dwellMs: topic.dwellMs,
        engagedPosts: topic.engagedPosts,
        postCount: topic.postCount,
        engagementRate: topic.postCount > 0 ? topic.engagedPosts / topic.postCount : 0,
        playlistSeed: playlistSeed ? { username: playlistSeed[0], score: playlistSeed[1] } : null,
        radioQueries: this.buildRadioQueries(topic.label),
      };
    }).sort((a, b) => b.dwellMs - a.dwellMs);
  }

  private buildRadioQueries(label: string): string[] {
    return [
      label,
      `${label} reels`,
      `${label} instagram`,
    ];
  }

  private get sortedTopics(): TopicCard[] {
    return [...this.topics].sort((a, b) => {
      if (this.sortMode === 'engagement') {
        return b.engagementRate - a.engagementRate;
      }
      return b.dwellMs - a.dwellMs;
    }).slice(0, 8);
  }

  private formatHours(ms = 0) {
    const hours = ms / 3600000;
    return hours >= 1 ? `${hours.toFixed(1)} h` : `${Math.round(ms / 60000)} min`;
  }

  private formatTopicMetric(topic: TopicCard) {
    if (this.sortMode === 'engagement') {
      return `${Math.round(topic.engagementRate * 100)}% de posts engages`;
    }
    return `${Math.round(topic.dwellMs / 60000)} min d'exposition`;
  }

  private launchPlaylist(topic: TopicCard) {
    if (!topic.playlistSeed) return;
    this.dispatch('launch-playlist', {
      topic: topic.label,
      username: topic.playlistSeed.username,
    });
  }

  private launchRadio(topicId: string, queries: string[], topicLabel: string) {
    const index = this.radioCursor[topicId] || 0;
    const query = queries[index % queries.length] || topicLabel;
    this.radioCursor = {
      ...this.radioCursor,
      [topicId]: (index + 1) % Math.max(queries.length, 1),
    };
    this.dispatch('launch-radio', {
      topic: topicLabel,
      query,
    });
  }

  render() {
    const stats = this.stats;

    return html`
      <div class="stack">
        <section class="hero">
          <div class="hero-top">
            <div class="brand">
              <div class="brand-mark" .innerHTML=${scrolloutIconSvg(30)}></div>
              <div>
                <div class="eyebrow">Scrollout</div>
                <div class="title">Piloter mon flux</div>
              </div>
            </div>
            <button class="ghost-btn" @click=${() => this.dispatch('go-instagram')}>Retour Instagram</button>
          </div>
          <div class="sub">
            Choisissez un sujet, lancez un flux cible, ou ouvrez votre Wrapped pour comprendre la bulle actuelle.
          </div>
          <div class="hero-actions">
            <button class="pill-btn primary-btn" @click=${() => this.dispatch('open-wrapped')}>Voir mon Wrapped</button>
          </div>
          <div class="stats-row">
            <div class="stat">
              <div class="stat-label">Temps cumule</div>
              <div class="stat-value">${this.formatHours(stats?.totalDwellMs || 0)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Posts analyses</div>
              <div class="stat-value">${stats?.totalPosts || 0}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Sujets actifs</div>
              <div class="stat-value">${this.topics.length}</div>
            </div>
          </div>
        </section>

        <section class="section-card wrap-card">
          <div>
            <div class="section-meta">Wrapped</div>
            <div class="wrap-title">Comprendre ma bulle</div>
            <div class="wrap-note">Acces direct a la lecture de votre bulle cognitive et de ses themes dominants.</div>
            <div class="dot-row">
              ${scrolloutDots.slice(0, 5).map(color => html`<span style="background:${color}"></span>`)}
            </div>
          </div>
          <button class="pill-btn primary-btn" @click=${() => this.dispatch('open-wrapped')}>Ouvrir</button>
        </section>

        <section class="section-card">
          <div class="section-head">
            <div>
              <div class="section-title">Mes sujets</div>
              <div class="section-meta">Tap principal = Playlist, bouton secondaire = Radio</div>
            </div>
            <div class="sort-row">
              <button class="metric-btn ${this.sortMode === 'dwell' ? 'active' : ''}" @click=${() => { this.sortMode = 'dwell'; }}>Exposition</button>
              <button class="metric-btn ${this.sortMode === 'engagement' ? 'active' : ''}" @click=${() => { this.sortMode = 'engagement'; }}>Engagement</button>
            </div>
          </div>

          ${this.loading ? html`<div class="empty">Chargement des sujets...</div>` : ''}
          ${!this.loading && this.sortedTopics.length === 0 ? html`
            <div class="empty">Aucun sujet exploitable pour le moment. Faites tourner Instagram afin d'alimenter les playlists.</div>
          ` : ''}
          ${!this.loading && this.sortedTopics.length > 0 ? html`
            <div class="topic-list">
              ${this.sortedTopics.map(topic => html`
                <article class="topic-card">
                  <div class="topic-row">
                    <div>
                      <div class="topic-name">${topic.label}</div>
                      <div class="topic-metric">${this.formatTopicMetric(topic)}</div>
                    </div>
                    <div class="section-meta">${topic.postCount} posts</div>
                  </div>
                  <div class="topic-actions">
                    <button
                      class="pill-btn card-btn primary-btn"
                      @click=${() => this.launchPlaylist(topic)}
                      ?disabled=${!topic.playlistSeed}
                    >
                      Playlist
                    </button>
                    <button
                      class="pill-btn card-btn secondary-btn"
                      @click=${() => this.launchRadio(topic.id, topic.radioQueries, topic.label)}
                    >
                      Radio
                    </button>
                  </div>
                </article>
              `)}
            </div>
          ` : ''}
        </section>

        <section class="section-card">
          <div class="section-head">
            <div>
              <div class="section-title">Sujets majeurs</div>
              <div class="section-meta">Radio uniquement, hors bulle</div>
            </div>
          </div>
          <div class="topic-list">
            ${MAJOR_TOPICS.map(topic => html`
              <article class="topic-card">
                <div class="topic-row">
                  <div>
                    <div class="topic-name">${topic.label}</div>
                    <div class="topic-metric">Sujet editorial majeur</div>
                  </div>
                </div>
                <div class="topic-actions">
                  <button
                    class="pill-btn card-btn primary-btn"
                    @click=${() => this.launchRadio(`major:${topic.id}`, topic.queries, topic.label)}
                  >
                    Radio
                  </button>
                </div>
              </article>
            `)}
          </div>
        </section>
      </div>
    `;
  }
}
