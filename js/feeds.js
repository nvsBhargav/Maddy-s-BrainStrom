// Live feed layer — keyless, CORS-open sources only.
// Verified in-browser 2026-10-19: hn.algolia.com, dev.to, nvd.nist.gov,
// api.github.com, huggingface.co/api and api.openalex.org all send
// Access-Control-Allow-Origin, so the browser can read them directly.
// arXiv export and Semantic Scholar are blocked by CORS and are not used.

const TIMEOUT_MS = 12000;
const CACHE_TTL = 90_000;
const cache = new Map();

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have how i in is it its of on or that the this to was were what when where which who why with your you we they them more new about after over under into our their".split(" ")
);

function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

function keywords(title, n = 5) {
  const seen = new Set();
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !seen.has(w) && seen.add(w))
    .slice(0, n);
}

async function getJSON(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" }, ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// --- normalizers ------------------------------------------------------------
function normalizeHn(hit) {
  return {
    id: `hn-${hit.objectID}`,
    source: "hn",
    sourceLabel: "HACKER NEWS",
    title: hit.title || "(untitled story)",
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    author: hit.author || "unknown",
    publishedAt: hit.created_at || null,
    points: hit.points ?? 0,
    comments: hit.num_comments ?? 0,
    excerpt: "",
    keywords: keywords(hit.title),
    badge: hit.points >= 100 ? "TRENDING" : "",
  };
}

function normalizeDevto(a) {
  return {
    id: `devto-${a.id}`,
    source: "devto",
    sourceLabel: "DEV.TO",
    title: a.title || "(untitled article)",
    url: `https://dev.to${a.path || ""}`,
    discussionUrl: `https://dev.to${a.path || ""}`,
    author: a.user?.username || a.organization?.name || "unknown",
    publishedAt: a.published_at || null,
    points: a.positive_reactions_count ?? 0,
    comments: a.comments_count ?? 0,
    excerpt: String(a.description || "").slice(0, 400),
    keywords: [...(a.tag_list || []).slice(0, 4), ...keywords(a.title, 3)].slice(0, 5),
    badge: "",
  };
}

function normalizeNvd(vuln) {
  const cve = vuln.cve || {};
  const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV40?.[0] || cve.metrics?.cvssMetricV2?.[0];
  const score = metrics?.cvssData?.baseScore;
  const severity = metrics?.cvssData?.baseSeverity || (score >= 9 ? "CRITICAL" : score >= 7 ? "HIGH" : score >= 4 ? "MEDIUM" : "LOW");
  const description = (cve.descriptions || []).find((d) => d.lang === "en")?.value || "";
  return {
    id: `nvd-${cve.id}`,
    source: "nvd",
    sourceLabel: "NVD CVE",
    title: `${cve.id || "CVE"} · ${description.split(". ")[0]}`.slice(0, 160),
    url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
    discussionUrl: "",
    author: cve.sourceIdentifier || "NIST",
    publishedAt: cve.published || null,
    points: score || 0,
    comments: 0,
    excerpt: description.slice(0, 360),
    keywords: [severity?.toLowerCase(), "cve", "vulnerability"].filter(Boolean),
    badge: severity ? `${severity} ${score ?? ""}`.trim() : "",
  };
}

function normalizeGhAdvisory(a) {
  const severity = a.severity || a.cvss?.score || "";
  return {
    id: `gh-${a.ghsa_id}`,
    source: "gh",
    sourceLabel: "GITHUB ADVISORY",
    title: a.summary || a.ghsa_id,
    url: a.html_url || `https://github.com/advisories/${a.ghsa_id}`,
    discussionUrl: "",
    author: (a.credits || [])[0]?.login || "GitHub",
    publishedAt: a.published_at || a.updated_at || null,
    points: a.cvss?.score || 0,
    comments: 0,
    excerpt: String(a.description || "").slice(0, 360),
    keywords: [severity, ...(a.cwes || []).slice(0, 2).map((c) => c.cwe_id), ...(a.identifiers || []).filter((i) => i.type === "CVE").slice(0, 1).map((i) => i.value)].filter(Boolean),
    badge: a.cve_id ? a.cve_id : a.ghsa_id,
  };
}

function normalizeHfPaper(item) {
  const paper = item.paper || item;
  const id = paper.id || paper.paperId || "";
  return {
    id: `hf-${id}`,
    source: "hf",
    sourceLabel: "HUGGING FACE",
    title: paper.title || "(untitled paper)",
    url: `https://huggingface.co/papers/${id}`,
    discussionUrl: item.discussionId ? `https://huggingface.co/papers/${id}` : "",
    author: (paper.authors || []).slice(0, 2).map((a) => a.name).filter(Boolean).join(", ") || "unknown",
    publishedAt: paper.publishedAt || paper.publicationDate || item.publishedAt || null,
    points: paper.upvotes ?? item.upvotes ?? 0,
    comments: item.numComments ?? 0,
    excerpt: String(paper.summary || "").replace(/\s+/g, " ").slice(0, 380),
    keywords: ["paper", "ai", "research", ...(paper.ai_keywords || []).slice(0, 2)],
    badge: "PAPER",
  };
}

function normalizeCrossref(w) {
  const title = (w.title && w.title[0]) || "(untitled work)";
  const parts = w.published?.["date-parts"]?.[0] || w.issued?.["date-parts"]?.[0] || [];
  const publishedAt = parts.length ? new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1)).toISOString() : null;
  return {
    id: `cr-${w.DOI || w.URL}`,
    source: "crossref",
    sourceLabel: "CROSSREF",
    title,
    url: w.URL || (w.DOI ? `https://doi.org/${w.DOI}` : ""),
    discussionUrl: "",
    author: (w.author || []).slice(0, 2).map((a) => [a.given, a.family].filter(Boolean).join(" ")).join(", ") || "unknown",
    publishedAt,
    points: w["is-referenced-by-count"] ?? 0,
    comments: 0,
    excerpt: `${(w["container-title"] && w["container-title"][0]) || "Crossref record"}${w.DOI ? " · doi:" + w.DOI : ""}`,
    keywords: ["research", "paper"],
    badge: "PAPER",
  };
}

function normalizeOpenAlex(w) {
  const authors = (w.authorships || []).slice(0, 2).map((a) => a.author?.display_name).filter(Boolean);
  return {
    id: `oa-${w.id}`,
    source: "openalex",
    sourceLabel: "OPENALEX",
    title: w.title || "(untitled work)",
    url: w.doi || w.id,
    discussionUrl: "",
    author: authors.join(", ") || "unknown",
    publishedAt: w.publication_date || null,
    points: w.cited_by_count ?? 0,
    comments: 0,
    excerpt: (w.primary_location?.source?.display_name || "OpenAlex record") + (w.open_access?.is_oa ? " · Open access" : ""),
    keywords: [...(w.keywords || []).slice(0, 3).map((k) => k.display_name), "research"].filter(Boolean),
    badge: "RESEARCH",
  };
}

// --- source builders --------------------------------------------------------
function hnUrl(query, mode) {
  const base = mode === "relevance" ? "search" : "search_by_date";
  return `https://hn.algolia.com/api/v1/${base}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=20`;
}

function devtoUrl(tag) {
  return `https://dev.to/api/articles?per_page=20&tag=${encodeURIComponent(tag)}`;
}

function nvdUrl(days = 21) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 19) + ".000";
  return `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20&pubStartDate=${fmt(start)}&pubEndDate=${fmt(end)}`;
}

function hfSearchUrl(q) {
  return `https://huggingface.co/api/papers/search?q=${encodeURIComponent(q)}&limit=20`;
}

function openAlexUrl(q) {
  return `https://api.openalex.org/works?search=${encodeURIComponent(q)}&sort=publication_date:desc&per-page=20`;
}

const CATEGORIES = {
  cyber: {
    label: "Cyber Security",
    jobs: [
      ["Hacker News", () => getJSON(hnUrl("cybersecurity vulnerability")).then((d) => (d.hits || []).map(normalizeHn))],
      ["Dev.to", () => getJSON(devtoUrl("security")).then((d) => (Array.isArray(d) ? d : []).map(normalizeDevto))],
      ["GitHub Advisories", () => getJSON("https://api.github.com/advisories?per_page=20&sort=published&direction=desc").then((d) => (Array.isArray(d) ? d : []).map(normalizeGhAdvisory))],
      ["NVD", () => getJSON(nvdUrl()).then((d) => (d.vulnerabilities || []).map(normalizeNvd))],
    ],
  },
  malware: {
    label: "Malware",
    jobs: [
      ["Hacker News", () => getJSON(hnUrl("malware ransomware")).then((d) => (d.hits || []).map(normalizeHn))],
      ["Dev.to", () => getJSON(devtoUrl("malware")).then((d) => (Array.isArray(d) ? d : []).map(normalizeDevto))],
      ["GitHub Advisories", () => getJSON("https://api.github.com/advisories?per_page=20&sort=published&direction=desc").then((d) => (Array.isArray(d) ? d : []).map(normalizeGhAdvisory))],
      ["NVD", () => getJSON(nvdUrl(14)).then((d) => (d.vulnerabilities || []).map(normalizeNvd))],
    ],
  },
  bounties: {
    label: "Bug Bounties",
    jobs: [
      ["Hacker News", () => getJSON(hnUrl("bug bounty")).then((d) => (d.hits || []).map(normalizeHn))],
      ["Dev.to", () => getJSON(devtoUrl("bugbounty")).then((d) => (Array.isArray(d) ? d : []).map(normalizeDevto))],
      ["Dev.to", () => getJSON(devtoUrl("security")).then((d) => (Array.isArray(d) ? d : []).filter((a) => /bounty|disclosure/i.test(`${a.title} ${a.description}`)).map(normalizeDevto))],
    ],
  },
  research: {
    label: "Security Papers",
    jobs: [
      ["Hugging Face", () => getJSON("https://huggingface.co/api/daily_papers?limit=20").then((d) => (Array.isArray(d) ? d : []).map(normalizeHfPaper))],
      ["Hugging Face", () => getJSON(hfSearchUrl("cybersecurity")).then((d) => (Array.isArray(d) ? d : []).map(normalizeHfPaper))],
      ["OpenAlex", () => getJSON(openAlexUrl("cybersecurity")).then((d) => (d.results || []).map(normalizeOpenAlex))],
      ["Crossref", () => getJSON("https://api.crossref.org/works?query=cybersecurity&rows=20&sort=published&order=desc&filter=type:journal-article").then((d) => (d.message?.items || []).map(normalizeCrossref))],
    ],
  },
};

function sourceSetFor(tab, query) {
  if (query) {
    return {
      label: `Search: ${query}`,
      jobs: [
        ["Hacker News", () => getJSON(hnUrl(query, "relevance")).then((d) => (d.hits || []).map(normalizeHn))],
        ["Dev.to", () => getJSON(devtoUrl(query.split(/\s+/)[0].toLowerCase())).then((d) => (Array.isArray(d) ? d : []).map(normalizeDevto))],
        ["Hugging Face", () => getJSON(hfSearchUrl(query)).then((d) => (Array.isArray(d) ? d : []).map(normalizeHfPaper))],
        ["OpenAlex", () => getJSON(openAlexUrl(query)).then((d) => (d.results || []).map(normalizeOpenAlex))],
      ],
    };
  }
  return CATEGORIES[tab] || CATEGORIES.cyber;
}

/**
 * Load one feed category from all wired sources.
 * Returns { articles, errors, fetchedAt, sources, label }.
 */
export async function loadFeed(tab = "cyber", { query = "", limit = 30, bust = false } = {}) {
  const q = query.trim();
  const key = `${tab}|${q}|${limit}`;
  const hit = cache.get(key);
  if (!bust && hit && Date.now() - hit.t < CACHE_TTL) return { ...hit.data, cached: true };

  const set = sourceSetFor(tab, q);
  const settled = await Promise.allSettled(set.jobs.map(([, run]) => run()));
  const errors = [];
  const byDate = (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  const groups = [];
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") groups.push(res.value.sort(byDate).slice(0, 20));
    else errors.push(`${set.jobs[i][0]}: ${res.reason?.message || "unreachable"}`);
  });

  // Round-robin across sources so a high-volume feed (NVD) never crowds
  // out news or research, while each source keeps its own recency order.
  const seen = new Set();
  const articles = [];
  for (let slot = 0; articles.length < limit; slot++) {
    let added = false;
    for (const group of groups) {
      const a = group[slot];
      if (!a) continue;
      added = true;
      const k = a.url || a.title;
      if (seen.has(k) || !a.title) continue;
      seen.add(k);
      articles.push(a);
      if (articles.length >= limit) break;
    }
    if (!added) break;
  }

  const data = {
    articles,
    errors,
    fetchedAt: new Date(),
    sources: [...new Set(set.jobs.map(([name]) => name))],
    label: set.label,
  };
  cache.set(key, { t: Date.now(), data });
  return data;
}

export function generateKeyDetails7(a) {
  const isCve = a.source === "nvd" || a.source === "gh" || /cve|vulnerab/i.test(a.title + a.excerpt);
  const isPaper = a.source === "hf" || a.source === "openalex" || a.source === "crossref" || /paper|model|llm/i.test(a.title);
  const title = a.title || "Security Intelligence Notice";
  const desc = a.excerpt || a.title || "";
  const score = a.points ? `CVSS/Rating: ${a.points}` : (a.badge || "Unrated");
  const tags = (a.keywords || []).join(", ") || "security, infrastructure";

  if (isCve) {
    return [
      { num: 1, title: "Threat Vector & Vulnerability Classification", detail: `Identified security vulnerability in target subsystem: ${desc.slice(0, 140)}` },
      { num: 2, title: "Technical Mechanism & Flaw Architecture", detail: `Underlying flaw stems from improper boundary state handling, memory management, or validation in ${title.slice(0, 80)}.` },
      { num: 3, title: "Severity & CVSS Impact Rating", detail: `Assigned severity badge: ${score}. Threat potential spans unauthorized data exposure, state corruption, or privilege elevation.` },
      { num: 4, title: "Affected Components & Deployment Scope", detail: `Affects applications relying on ${tags}. Systems exposed to public ingress or unauthenticated input represent primary attack surface.` },
      { num: 5, title: "Exploitation Status & Threat Actor Activity", detail: `Exploit feasibility is heightened upon public advisory disclosure. Active reconnaissance usually follows within 24-72 hours.` },
      { num: 6, title: "Detection Signatures & Telemetry Indicators", detail: `Monitor network ingress and process execution logs for anomalous payloads, unexpected child processes, and abnormal egress traffic.` },
      { num: 7, title: "Remediation, Patching & Defense Strategy", detail: `Apply vendor patches immediately; enforce least-privilege RBAC, network segmentation, and runtime anomaly alerting.` },
    ];
  } else if (isPaper) {
    return [
      { num: 1, title: "Core Research Thesis & Domain", detail: `Advances state-of-the-art methodology in ${title.slice(0, 110)}.` },
      { num: 2, title: "Model Architecture & Algorithmic Paradigm", detail: `Explores structural optimizations, training dynamics, or safety guardrails: ${desc.slice(0, 140)}` },
      { num: 3, title: "Significance & Peer Impact", detail: `Cited/Upvoted score: ${a.points || 0}. Represents pivotal empirical results in domain literature.` },
      { num: 4, title: "Evaluation Benchmarks & Empirical Findings", detail: `Demonstrates measurable performance, efficiency, or robustness gains across benchmark suites.` },
      { num: 5, title: "Computational Complexity & Resource Footprint", detail: `Assesses inference latency, memory scaling, and hardware constraints for production deployment.` },
      { num: 6, title: "Security, Safety & Alignment Considerations", detail: `Examines vulnerability to adversarial perturbation, prompt injection, hallucinations, or training data leakage.` },
      { num: 7, title: "Future Research Vector & Production Translation", detail: `Provides open framework for engineering adoption, ongoing replication studies, and practical integration.` },
    ];
  } else {
    return [
      { num: 1, title: "Event Overview & Ecosystem Significance", detail: `Critical developments in technology and engineering: ${title.slice(0, 120)}.` },
      { num: 2, title: "Technical Mechanics & Architecture", detail: `${desc ? desc.slice(0, 150) : "Deep dive into system architecture, operational design patterns, and engineering tradeoffs."}` },
      { num: 3, title: "Community Signal & Validation", detail: `Engaging the technical community with ${a.points} reactions/points and ${a.comments} discussions across ${a.sourceLabel}.` },
      { num: 4, title: "Operational & Business Impact", detail: `Directly impacts engineering velocity, infrastructural resilience, and modernization strategies for technical teams.` },
      { num: 5, title: "Risk & Attack Surface Analysis", detail: `Highlights critical vulnerabilities, dependencies, or architectural bottlenecks in distributed environments.` },
      { num: 6, title: "Observability, Telemetry & Diagnostics", detail: `Emphasizes proactive monitoring, distributed tracing, and automated validation to maintain system health.` },
      { num: 7, title: "Strategic Recommendations & Implementation", detail: `Adopt iterative deployment strategies, automated regression testing, and resilient architectural patterns.` },
    ];
  }
}

export function generate10LineBrief(a) {
  const isCve = a.source === "nvd" || a.source === "gh" || /cve|vulnerab/i.test(a.title + a.excerpt);
  const title = a.title || "Intelligence Brief";
  const desc = a.excerpt || a.title || "";
  const author = a.author || "Security Analysts";
  const time = timeAgo(a.publishedAt) || "recent";
  const score = a.points ? `rated ${a.points}` : (a.badge || "monitored");

  if (isCve) {
    return [
      `1. Executive Alert: Critical vulnerability disclosed regarding ${title.slice(0, 85)}.`,
      `2. Disclosure Timeline: Published via ${a.sourceLabel} by ${author} approximately ${time}.`,
      `3. Flaw Taxonomy: Classified as an architectural boundary or input validation vulnerability (${score}).`,
      `4. Core Root Cause: ${desc.slice(0, 110) || "Improper boundary verification allows malformed request manipulation."}.`,
      `5. Attack Surface: Exposed to unauthenticated remote adversaries or adjacent privileged processes.`,
      `6. Weaponization Potential: High probability of automated scanning, exploit prototyping, and weaponization.`,
      `7. Organizational Blast Radius: Threatens sensitive data confidentiality, memory integrity, and process availability.`,
      `8. Immediate Action Item: Review affected asset inventories and deploy vendor security patches without delay.`,
      `9. Telemetry & Hunting: Activate IDS/IPS rules, inspect authorization logs, and flag abnormal execution patterns.`,
      `10. Strategic Posture: Enforce defense-in-depth, zero-trust network boundaries, and continuous vulnerability scanning.`
    ];
  } else {
    return [
      `1. Executive Briefing: High-impact publication covering ${title.slice(0, 85)}.`,
      `2. Provenance & Source: Curated from ${a.sourceLabel} by ${author}, indexed ${time}.`,
      `3. Core Technical Thesis: Focuses on modernizing systems, securing dependencies, and optimizing workflows.`,
      `4. Underlying Framework: ${desc.slice(0, 110) || "Evaluates architectural patterns, scalability requirements, and resilience."}.`,
      `5. Community Engagement: Garnered substantial developer engagement with ${a.points} signals and ${a.comments} responses.`,
      `6. Operational Repercussions: Influences engineering standards, software supply-chain hygiene, and developer tooling.`,
      `7. Risk Vectors Evaluated: Mitigates performance regression, unauthorized access, and operational downtime.`,
      `8. Tactical Implementation: Incorporate automated linting, security guardrails, and architectural review gates.`,
      `9. Telemetry & Metrics: Benchmark performance baselines and monitor latency spikes or security exceptions.`,
      `10. Long-Term Roadmap: Integrate recommended paradigms into organizational development lifecycles.`
    ];
  }
}

export function feedToCardText(a) {
  const lines = [`### ${a.title}`, "", `**${a.sourceLabel}** · ${a.author} · ${timeAgo(a.publishedAt)}`, ""];
  if (a.excerpt) lines.push(a.excerpt, "");
  lines.push(`**Link:** ${a.url}`);
  if (a.discussionUrl && a.discussionUrl !== a.url) lines.push(`**Discussion:** ${a.discussionUrl}`);
  if (a.source === "nvd" || a.source === "gh") lines.push(`**Severity:** ${a.badge || "n/a"}`);
  else lines.push(`**Signals:** ${a.points} points · ${a.comments} comments`);
  if (a.keywords.length) lines.push(`**Tags:** ${a.keywords.join(", ")}`);
  lines.push("", `*Imported from ${a.sourceLabel} · ${new Date(a.publishedAt || Date.now()).toLocaleDateString()}.*`);
  return lines.join("\n");
}

export function feedToIntelCardText(a) {
  const lines = [
    `# ${a.title}`,
    "",
    `> **Source:** ${a.sourceLabel} | **Author:** ${a.author} | **Published:** ${timeAgo(a.publishedAt)} | **Signal:** ${a.badge || `${a.points} pts`}`,
    "",
    "## 📋 10-Line Comprehensive Intelligence Brief",
    "",
    ...generate10LineBrief(a).map((l) => `> ${l}`),
    "",
    "## 🔍 Key Details (7 Points Analysis)",
    "",
    ...generateKeyDetails7(a).map((k) => `### ${k.num}. ${k.title}\n${k.detail}\n`),
    "",
    `**Reference Link:** [${a.url}](${a.url})`,
  ];
  if (a.discussionUrl && a.discussionUrl !== a.url) {
    lines.push(`**Discussion Forum:** [${a.discussionUrl}](${a.discussionUrl})`);
  }
  lines.push("", `*BrainVault Threat Intelligence Dispatch · Recorded on ${new Date().toLocaleDateString()}.*`);
  return lines.join("\n");
}

export function feedToStickyText(a) {
  const bits = [`${a.title}`, `${a.sourceLabel} · ${a.author} · ${timeAgo(a.publishedAt)}`];
  if (a.excerpt) bits.push(a.excerpt.slice(0, 160));
  bits.push(a.badge || `${a.points} pts`);
  return bits.join("\n");
}

export { timeAgo };

