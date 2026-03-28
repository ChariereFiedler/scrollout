/**
 * ECHA Tracker — Injected into Instagram's mobile web WebView.
 * Monitors the DOM for posts, tracks dwell time, extracts content.
 * Sends data back to native via EchaBridge.
 */
(function() {
  'use strict';

  if (window.__ECHA_LOADED) return;
  window.__ECHA_LOADED = true;

  const SESSION_START = Date.now();
  const seenPosts = new Map(); // postId -> { firstSeen, lastSeen, data }
  let currentPostId = null;
  let currentPostStart = 0;

  function log(msg) {
    console.log('[ECHA] ' + msg);
    sendToNative({ type: 'log', message: msg });
  }

  function sendToNative(data) {
    try {
      if (window.EchaBridge && window.EchaBridge.onData) {
        window.EchaBridge.onData(JSON.stringify(data));
      }
    } catch(e) {}
  }

  log('Tracker injected. Monitoring Instagram DOM...');

  // ─── Post extraction from DOM ─────────────────────────────

  function extractPostFromArticle(article) {
    const post = {
      username: '',
      displayName: '',
      caption: '',
      fullCaption: '',
      hashtags: [],
      imageUrls: [],
      imageAlts: [],
      videoUrl: '',
      likeCount: '',
      commentCount: '',
      date: '',
      mediaType: 'photo',
      isSponsored: false,
      isSuggested: false,
      isReel: false,
      location: '',
      audioTrack: '',
    };

    // Username — look for header link
    const headerLinks = article.querySelectorAll('header a');
    for (const link of headerLinks) {
      const href = link.getAttribute('href') || '';
      if (href.match(/^\/[^\/]+\/$/) && !href.includes('/p/') && !href.includes('/explore/')) {
        post.username = href.replace(/\//g, '');
        const nameSpan = link.querySelector('span');
        if (nameSpan) post.displayName = nameSpan.textContent || '';
        break;
      }
    }

    // Fallback username from any link with user pattern
    if (!post.username) {
      const allLinks = article.querySelectorAll('a[href]');
      for (const link of allLinks) {
        const href = link.getAttribute('href') || '';
        if (href.match(/^\/[a-zA-Z0-9_.]+\/$/) && link.textContent.trim()) {
          post.username = href.replace(/\//g, '');
          break;
        }
      }
    }

    // Sponsored
    const allText = article.textContent || '';
    if (allText.includes('Sponsorisé') || allText.includes('Sponsored') || allText.includes('Payé par')) {
      post.isSponsored = true;
    }
    if (allText.includes('Suggestion') || allText.includes('Suggested')) {
      post.isSuggested = true;
    }

    // Images — get all img elements with src
    const images = article.querySelectorAll('img[src]');
    for (const img of images) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      // Filter out tiny icons and profile pics
      if (src.includes('cdninstagram') || src.includes('scontent')) {
        const width = img.naturalWidth || img.width || 0;
        if (width > 100 || alt.length > 20) {
          post.imageUrls.push(src);
          if (alt && alt.length > 5) {
            post.imageAlts.push(alt);
          }
        }
      }
    }

    // Videos
    const videos = article.querySelectorAll('video[src], video source[src]');
    for (const vid of videos) {
      const src = vid.getAttribute('src') || '';
      if (src) {
        post.videoUrl = src;
        post.mediaType = 'video';
      }
    }

    // Caption — Instagram web uses various selectors
    // Look for the main caption span
    const captionSelectors = [
      'div[role="button"] span', // "more" button parent
      'ul li span',              // comment list
      'h1',                       // single post caption
    ];

    // Better approach: find spans that contain the username followed by text
    const allSpans = article.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent || '';
      if (text.includes(post.username) && text.length > post.username.length + 5 && !post.caption) {
        post.caption = text;
      }
      // Full caption (visible text after the username)
      if (span.parentElement?.getAttribute('role') === 'button' && text === 'plus' || text === 'more') {
        // The sibling before contains truncated caption
        const parent = span.closest('div') || span.parentElement;
        if (parent) {
          post.fullCaption = parent.textContent || '';
        }
      }
    }

    // Alternative caption extraction
    if (!post.caption) {
      const listItems = article.querySelectorAll('ul > div li');
      if (listItems.length > 0) {
        const firstComment = listItems[0];
        post.caption = firstComment.textContent || '';
      }
    }

    // Hashtags
    const hashtagLinks = article.querySelectorAll('a[href*="/explore/tags/"]');
    for (const link of hashtagLinks) {
      post.hashtags.push(link.textContent || '');
    }

    // Like count
    const likeSection = article.querySelector('section');
    if (likeSection) {
      const likeText = likeSection.textContent || '';
      const likeMatch = likeText.match(/([\d\s,.]+)\s*(J'aime|like|mention)/i);
      if (likeMatch) post.likeCount = likeMatch[1].trim();
    }
    // Also try button/span patterns
    const buttons = article.querySelectorAll('button, span');
    for (const el of buttons) {
      const text = el.textContent || '';
      const match = text.match(/^([\d,.\s]+[KkMm]?)\s*(J'aime|like)/i);
      if (match) {
        post.likeCount = match[1].trim();
        break;
      }
    }

    // Date/time
    const timeEl = article.querySelector('time');
    if (timeEl) {
      post.date = timeEl.getAttribute('datetime') || timeEl.getAttribute('title') || timeEl.textContent || '';
    }

    // Location
    const locationLink = article.querySelector('a[href*="/explore/locations/"]');
    if (locationLink) {
      post.location = locationLink.textContent || '';
    }

    // Media type refinement
    if (post.imageUrls.length > 1) post.mediaType = 'carousel';
    if (article.querySelector('[aria-label*="Carousel"]') || article.querySelector('[aria-label*="carousel"]')) {
      post.mediaType = 'carousel';
    }

    return post;
  }

  // ─── Intersection Observer for dwell time ─────────────────

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const article = entry.target;
      const postId = article.dataset.echaId;

      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        // Post is more than 50% visible
        if (postId !== currentPostId) {
          // Finalize previous post
          if (currentPostId && seenPosts.has(currentPostId)) {
            const prev = seenPosts.get(currentPostId);
            prev.dwellTimeMs += Date.now() - currentPostStart;
            prev.lastSeen = Date.now();
            sendPostUpdate(prev);
          }

          currentPostId = postId;
          currentPostStart = Date.now();

          if (!seenPosts.has(postId)) {
            // New post detected
            const data = extractPostFromArticle(article);
            const postEntry = {
              postId,
              firstSeen: Date.now(),
              lastSeen: Date.now(),
              dwellTimeMs: 0,
              seenCount: 1,
              data,
            };
            seenPosts.set(postId, postEntry);
            log(`New post: @${data.username} (${data.mediaType})${data.isSponsored ? ' [AD]' : ''}`);
            sendToNative({ type: 'new_post', post: postEntry });
          } else {
            seenPosts.get(postId).seenCount++;
          }
        }
      }
    }
  }, {
    threshold: [0.5],
  });

  function sendPostUpdate(entry) {
    sendToNative({
      type: 'post_update',
      post: {
        ...entry,
        dwellTimeSec: Math.round(entry.dwellTimeMs / 100) / 10,
      },
    });
  }

  // ─── Mutation Observer to detect new articles ─────────────

  let postCounter = 0;

  function scanForArticles() {
    const articles = document.querySelectorAll('article:not([data-echa-id])');
    for (const article of articles) {
      postCounter++;
      const id = 'echa_' + postCounter;
      article.dataset.echaId = id;
      observer.observe(article);
    }
  }

  const mutationObserver = new MutationObserver(() => {
    scanForArticles();
  });

  // Start observing
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial scan
  scanForArticles();

  // ─── Periodic session summary ─────────────────────────────

  setInterval(() => {
    // Finalize current post timing
    if (currentPostId && seenPosts.has(currentPostId)) {
      const current = seenPosts.get(currentPostId);
      current.dwellTimeMs += Date.now() - currentPostStart;
      currentPostStart = Date.now();
    }

    const posts = Array.from(seenPosts.values()).map(entry => ({
      ...entry,
      dwellTimeSec: Math.round(entry.dwellTimeMs / 100) / 10,
    }));

    sendToNative({
      type: 'session_summary',
      timestamp: Date.now(),
      sessionDurationSec: Math.round((Date.now() - SESSION_START) / 1000),
      totalPosts: posts.length,
      posts: posts.sort((a, b) => b.dwellTimeMs - a.dwellTimeMs),
    });
  }, 10000);

  // ─── Export function callable from native ─────────────────

  window.__echaExport = function() {
    // Finalize
    if (currentPostId && seenPosts.has(currentPostId)) {
      const current = seenPosts.get(currentPostId);
      current.dwellTimeMs += Date.now() - currentPostStart;
      currentPostStart = Date.now();
    }

    return {
      sessionStart: SESSION_START,
      sessionEnd: Date.now(),
      sessionDurationSec: Math.round((Date.now() - SESSION_START) / 1000),
      totalPosts: seenPosts.size,
      posts: Array.from(seenPosts.values()).map(entry => ({
        ...entry,
        dwellTimeSec: Math.round(entry.dwellTimeMs / 100) / 10,
      })).sort((a, b) => b.dwellTimeMs - a.dwellTimeMs),
    };
  };

  log('Tracker ready. ' + document.querySelectorAll('article').length + ' articles found.');
})();
