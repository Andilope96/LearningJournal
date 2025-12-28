import { posts } from "./data.js";

/* -------------------------
   Helpers
------------------------- */
const $ = (sel) => document.querySelector(sel);
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function sanitizeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    // ignore
  }
  return "";
}

function inlineFormat(text) {
  let s = text;

  // Inline code: `code`
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);

  // Links: [label](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return label;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Bare URLs -> links
  s = s.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
    const safe = sanitizeUrl(match);
    if (!safe) return match;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });

  // Bold: **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *text* (conservative)
  s = s.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1<em>$2</em>");

  return s;
}

/**
 * Safe mini Markdown renderer (enough for progress.md):
 * - headings
 * - paragraphs
 * - unordered/ordered lists
 * - hr
 * - fenced code blocks
 * - inline links + code
 */
function markdownToHtml(markdown) {
  const raw = String(markdown || "");

  const parts = raw.split(/```/);
  const chunks = [];

  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 0) chunks.push({ type: "text", value: parts[i] });
    else chunks.push({ type: "code", value: parts[i] });
  }

  const out = [];

  for (const chunk of chunks) {
    if (chunk.type === "code") {
      const lines = chunk.value.replace(/^\n/, "").split(/\r?\n/);
      let code = lines.join("\n");

      if (lines.length > 1 && /^[a-zA-Z0-9_-]{1,12}$/.test(lines[0].trim())) {
        code = lines.slice(1).join("\n");
      }

      out.push(`<pre><code>${escapeHtml(code).replaceAll("\t", "  ")}</code></pre>`);
      continue;
    }

    const lines = escapeHtml(chunk.value).split(/\r?\n/);

    let inUl = false;
    let inOl = false;
    let paraBuffer = [];

    const flushPara = () => {
      if (!paraBuffer.length) return;
      const paragraph = paraBuffer.join(" ").trim();
      out.push(`<p>${inlineFormat(paragraph)}</p>`);
      paraBuffer = [];
    };

    const closeLists = () => {
      if (inUl) out.push("</ul>");
      if (inOl) out.push("</ol>");
      inUl = false;
      inOl = false;
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (/^---+$/.test(trimmed)) {
        flushPara();
        closeLists();
        out.push("<hr />");
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushPara();
        closeLists();
        const level = Math.min(4, headingMatch[1].length + 1);
        out.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
        continue;
      }

      const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        flushPara();
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          out.push("<ul>");
          inUl = true;
        }
        out.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
        continue;
      }

      const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        flushPara();
        if (inUl) {
          out.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          out.push("<ol>");
          inOl = true;
        }
        out.push(`<li>${inlineFormat(olMatch[1])}</li>`);
        continue;
      }

      if (!trimmed) {
        flushPara();
        closeLists();
        continue;
      }

      paraBuffer.push(trimmed);
    }

    flushPara();
    closeLists();
  }

  return out.join("\n");
}

/* -------------------------
   Data normalization
------------------------- */
const allPosts = (posts || []).map((p, idx) => ({
  id: p.id || `post-${idx}`,
  title: p.title || "Untitled",
  date: p.date || "",
  excerpt: p.excerpt || "",
  image: p.image || null,
  markdown: p.markdown || "",
  links: Array.isArray(p.links) ? p.links : []
}));

function getPostById(id) {
  return allPosts.find((p) => p.id === id) || null;
}

/* -------------------------
   DOM references
------------------------- */
const viewHome = $("#view-home");
const viewAbout = $("#view-about");
const viewPost = $("#view-post");

const heroImg = $("#hero-img");
const heroDate = $("#hero-date");
const heroTitle = $("#home-title");
const heroExcerpt = $("#hero-excerpt");
const heroReadMore = $("#hero-readmore");

const postsGrid = $("#posts-grid");
const viewMoreBtn = $("#view-more-btn");

const aboutPostsGrid = $("#about-posts-grid");
const aboutViewMoreBtn = $("#about-view-more-btn");

const postDate = $("#post-date");
const postTitle = $("#post-title");
const postExcerpt = $("#post-excerpt");
const postHeroImg = $("#post-hero-img");
const postContent = $("#post-content");
const postLinksWrap = $("#post-links");
const postLinksList = $("#post-links-list");

const navLinks = document.querySelectorAll("[data-nav]");

/* -------------------------
   Rendering
------------------------- */
let homeExpanded = false;
let aboutExpanded = false;

const HOME_INITIAL_COUNT = 6;
const ABOUT_INITIAL_COUNT = 3;

function setActiveNav(route) {
  navLinks.forEach((a) => {
    const key = a.getAttribute("data-nav");
    if (key === route) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function showOnly(which) {
  viewHome.hidden = which !== "home";
  viewAbout.hidden = which !== "about";
  viewPost.hidden = which !== "post";
}

function renderHero(post) {
  heroDate.textContent = post.date;
  heroTitle.textContent = post.title;
  heroExcerpt.textContent = post.excerpt;
  heroReadMore.setAttribute("href", `#post/${encodeURIComponent(post.id)}`);

  if (post.image?.src) {
    heroImg.src = post.image.src;
    heroImg.hidden = false;
  } else {
    heroImg.removeAttribute("src");
    heroImg.hidden = true;
  }
}

function renderPostCards(targetGridEl, postsToShow) {
  const html = postsToShow.map((p) => {
    const hasImg = Boolean(p.image?.src);

    return `
      <article class="post-card" role="listitem">
        <div class="post-thumb" aria-hidden="true">
          ${hasImg ? `<img src="${escapeHtml(p.image.src)}" alt="${escapeHtml(p.image.alt || "")}">` : ""}
        </div>

        <div class="post-body">
          <p class="post-date">${escapeHtml(p.date)}</p>
          <h3 class="post-title">${escapeHtml(p.title)}</h3>
          <p class="post-excerpt">${escapeHtml(p.excerpt)}</p>
        </div>

        <div class="post-actions">
          <a class="post-readmore" href="#post/${encodeURIComponent(p.id)}">Read more</a>
        </div>
      </article>
    `;
  }).join("");

  targetGridEl.innerHTML = html;
}

function renderGridSection({ gridEl, buttonEl, expanded, initialCount, postsList }) {
  const count = expanded ? postsList.length : Math.min(initialCount, postsList.length);
  renderPostCards(gridEl, postsList.slice(0, count));

  const hasMore = postsList.length > count;

  buttonEl.hidden = !hasMore && !expanded;
  buttonEl.textContent = expanded ? "Show less" : "View More";
  buttonEl.setAttribute("aria-expanded", String(expanded));
}

function renderHome() {
  const featured = allPosts[0] || null;
  if (featured) renderHero(featured);

  const list = allPosts.slice(1); // grid without featured
  renderGridSection({
    gridEl: postsGrid,
    buttonEl: viewMoreBtn,
    expanded: homeExpanded,
    initialCount: HOME_INITIAL_COUNT,
    postsList: list
  });
}

function renderAbout() {
  // On About we show recent posts including the newest one (no hero here)
  renderGridSection({
    gridEl: aboutPostsGrid,
    buttonEl: aboutViewMoreBtn,
    expanded: aboutExpanded,
    initialCount: ABOUT_INITIAL_COUNT,
    postsList: allPosts
  });
}

function renderPostPage(post) {
  postDate.textContent = post.date;
  postTitle.textContent = post.title;
  postExcerpt.textContent = post.excerpt;

  /*if (post.image?.src) {
    postHeroImg.src = post.image.src;
    postHeroImg.alt = post.image.alt || "";
    postHeroImg.hidden = false;
  } else {
    postHeroImg.removeAttribute("src");
    postHeroImg.alt = "";
    postHeroImg.hidden = true;
  }*/

  postContent.innerHTML = post.markdown ? markdownToHtml(post.markdown) : "<p>No content yet.</p>";

  const safeLinks = (post.links || [])
    .map((l) => ({
      label: String(l.label || "").trim(),
      url: sanitizeUrl(String(l.url || "").trim()),
    }))
    .filter((l) => l.label && l.url);

  if (safeLinks.length) {
    postLinksList.innerHTML = safeLinks
      .map((l) => `<li><a href="${l.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a></li>`)
      .join("");
    postLinksWrap.hidden = false;
  } else {
    postLinksList.innerHTML = "";
    postLinksWrap.hidden = true;
  }

  postContent.focus();
}

/* -------------------------
   Routing
------------------------- */
function parseRoute() {
  const hash = (location.hash || "#home").replace("#", "");

  if (hash.startsWith("post/")) {
    const id = decodeURIComponent(hash.slice("post/".length));
    return { page: "post", id };
  }

  if (hash === "about") return { page: "about" };
  return { page: "home" };
}

function route() {
  const r = parseRoute();

  if (r.page === "about") {
    setActiveNav("about");
    showOnly("about");
    renderAbout();
    return;
  }

  if (r.page === "post") {
    const post = getPostById(r.id);
    if (!post) {
      location.hash = "#home";
      return;
    }
    navLinks.forEach((a) => a.removeAttribute("aria-current"));
    showOnly("post");
    renderPostPage(post);
    return;
  }

  setActiveNav("home");
  showOnly("home");
  renderHome();
}

/* -------------------------
   Events
------------------------- */
viewMoreBtn.addEventListener("click", () => {
  homeExpanded = !homeExpanded;
  renderHome();
});

aboutViewMoreBtn.addEventListener("click", () => {
  aboutExpanded = !aboutExpanded;
  renderAbout();
});

window.addEventListener("hashchange", route);
route();
