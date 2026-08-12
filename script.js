const currentYear = document.getElementById('year');
if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

/* Site search implementation */
(function () {
  const pagesToSearch = [
    'index.html',
    'basic-resume.html',
    'professional-experience.html',
    'ongoing-work.html',
    'journal-articles.html',
    'published-reports.html',
    'blog-posts.html',
    'client-papers.html',
    'presentations.html'
  ];

  const form = document.getElementById('site-search-form');
  const input = document.getElementById('site-search-input');
  const resultsBox = document.getElementById('site-search-results');

  if (!form || !input || !resultsBox) return;

  let controller = null;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) {
      resultsBox.classList.remove('active');
      return;
    }
    doSearch(q);
  });

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!form.contains(e.target)) {
      resultsBox.classList.remove('active');
    }
  });

  // Allow Enter in input to submit
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function snippetFor(text, idx, q) {
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + q.length + 60);
    let snippet = text.substring(start, end).trim();
    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    return snippet;
  }

  async function doSearch(query) {
    // abort previous
    if (controller) controller.abort();
    controller = new AbortController();

    resultsBox.innerHTML = '<div class="result">Searching…</div>';
    resultsBox.classList.add('active');

    const qLower = query.toLowerCase();
    const results = [];

    // Try to fetch each page and search its text
    for (const page of pagesToSearch) {
      try {
        const resp = await fetch(page, { signal: controller.signal });
        if (!resp.ok) continue;
        const html = await resp.text();

        // Try to extract title and body text
        let title = page;
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const bodyText = doc.body ? doc.body.innerText : doc.documentElement.innerText;
        const idx = bodyText.toLowerCase().indexOf(qLower);
        if (idx !== -1) {
          const snippet = snippetFor(bodyText, idx, query);
          results.push({ page, title, snippet });
        }
      } catch (err) {
        // fetch may fail when page served via file:// — ignore and continue
        // console.log('fetch error', page, err);
      }
    }

    renderResults(results, query);
  }

  function renderResults(results, query) {
    if (!results.length) {
      resultsBox.innerHTML = '<div class="result">No results found</div>';
      return;
    }

    resultsBox.innerHTML = '';
    const qEnc = encodeURIComponent(query);
    for (const r of results) {
      const a = document.createElement('a');
      a.href = r.page + (r.page.indexOf('?') === -1 ? '?q=' + qEnc : '&q=' + qEnc);
      a.className = 'result';
      a.innerHTML = `<div class="title">${r.title}</div><div class="snippet">${escapeHtml(r.snippet)}</div>`;
      resultsBox.appendChild(a);
    }
    resultsBox.classList.add('active');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // When a page loads with ?q=, highlight matches
  function highlightOnPage(query) {
    if (!query) return;
    const q = query.trim();
    if (!q) return;
    const escaped = escapeRegExp(q);
    const re = new RegExp(`(${escaped})`, 'gi');

    // Select common text containers to avoid replacing inside scripts/styles
    const selector = 'p, h1, h2, h3, h4, li, span, a, strong, .lead, .profile-card__role, .resource-card strong, .timeline-item__content p';
    const nodes = document.querySelectorAll(selector);
    let firstHit = null;
    nodes.forEach((el) => {
      if (!el || !el.innerHTML) return;
      if (re.test(el.innerHTML)) {
        el.innerHTML = el.innerHTML.replace(re, '<mark class="search-hit">$1</mark>');
        if (!firstHit) firstHit = el.querySelector('mark.search-hit');
      }
    });

    if (firstHit) {
      try { firstHit.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
  }

  // Utility to read ?q= from URL
  function readQueryParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('q') || '';
    } catch (e) {
      return '';
    }
  }

  // Escape HTML in snippet already implemented above

  // On initial load, if q present highlight
  document.addEventListener('DOMContentLoaded', function () {
    const q = readQueryParam();
    if (q) {
      // decode in case encoded
      try { highlightOnPage(decodeURIComponent(q)); } catch (e) { highlightOnPage(q); }
    }
  });
})();
