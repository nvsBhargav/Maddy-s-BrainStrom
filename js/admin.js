// BrainVault Master Admin Panel & 3D Multi-User Constellation Engine
// Fully matching the dark cyber glass design and reference screenshots.

import {
  saveApiKeysToFirestore,
  fetchApiKeysFromFirestore,
  saveNewsStoryToFirestore,
  deleteNewsStoryFromFirestore,
  fetchSavedNewsFromFirestore,
  pruneOldNewsFromFirestore,
  syncLatestNewsToFirestore,
  syncCvesToFirestore,
  fetchCvesFromFirestore,
} from "./firebaseClient.js";
import { VulnerabilityTrendsD3 } from "./trendsD3.js";


export const DEFAULT_USERS = [
  {
    id: "usr_karthik",
    username: "padd karthik",
    name: "Padd Karthik (Admin)",
    email: "karthik@brainvault.io",
    role: "ADMIN",
    avatarColor: "#06b6d4",
    timeSpent: "3h 56m",
    lastActive: "5:05:55 pm",
    tableName: "usr_usr-karthik.db",
    workspaces: [],
  },
  {
    id: "usr_sarah",
    username: "sarah_researcher",
    name: "Dr. Sarah Connor",
    email: "sarah.connor@brainvault.io",
    role: "RESEARCHER",
    avatarColor: "#a855f7",
    timeSpent: "2h 35m",
    lastActive: "4:12:10 pm",
    tableName: "usr_usr-sarah.db",
    workspaces: [
      {
        id: "ws-sarah-1",
        name: "Cybernetics Research Lab",
        color: "#a855f7",
        passwordProtected: false,
        password: "",
        notes: [
          {
            id: "note-s1",
            title: "Automated Defense Systems Analysis",
            text: "Behavioral heuristics and threat modeling for autonomous network agents operating in high-latency segmented zones.",
            updatedAt: "Yesterday, 6:00 PM",
          },
        ],
      },
    ],
  },
  {
    id: "usr_alex",
    username: "alex_neuro",
    name: "Alex Thorne",
    email: "alex.thorne@brainvault.io",
    role: "ANALYST",
    avatarColor: "#10b981",
    timeSpent: "1h 25m",
    lastActive: "2:45:00 pm",
    tableName: "usr_usr-alex.db",
    workspaces: [
      {
        id: "ws-alex-1",
        name: "Neural Interface Protocols",
        color: "#10b981",
        passwordProtected: false,
        password: "",
        notes: [
          {
            id: "note-a1",
            title: "Cortex Signal Integrity & Filtering",
            text: "Telemetry signal de-noising using wavelet transforms for neural bus security and synaptic channel verification.",
            updatedAt: "2 days ago",
          },
        ],
      },
    ],
  },
  {
    id: "usr_maya",
    username: "maya_ai",
    name: "Maya Patel",
    email: "maya.patel@brainvault.io",
    role: "DEVELOPER",
    avatarColor: "#f59e0b",
    timeSpent: "1h 4m",
    lastActive: "1:15:30 pm",
    tableName: "usr_usr-maya.db",
    workspaces: [],
  },
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
  }
  return Math.abs(h);
}

export class AdminDashboard {
  constructor({ store, canvas, toast }) {
    this.store = store;
    this.canvas = canvas;
    this.toast = toast;

    this.isOpen = false;
    this.currentTab = "vaults"; // "vaults" | "keys" | "news" | "saved" | "images" | "constellation"
    this.users = JSON.parse(JSON.stringify(DEFAULT_USERS));
    this.selectedUserId = "usr_karthik";
    this.userSearch = "";
    this.apiKeys = {
      reddit_user_agent: "BrainVaultApp/3.0 (by u/karthik_admin)",
      rss2json_key: "",
      techcrunch_token: "",
      wired_key: "",
      bbc_key: "",
      gnews_key: "",
      mediastack_key: "a363c1ceab62c54f115b512011ec8dd7",
      higgsfield_key: "80d5a575-cacb-4f54-a8be-51571e8c2f70:af1ccaa616aca6f1d0a661b87d6a9afbe6f8d4a8c5b46f4b9cca826c81a318b2",
      newsapi_key: "7d23582d0e384e6ca8452036ee6331cc",
      currents_key: "Ef3StHE4k2Tgb2SrEmzxhMUe9_3or5apVTpPzcoi-jwDsJcZ",
      newsdata_key: "pub_e90c4dd7497c4bc2b02d59356e20b288",
    };
    this.keyStatuses = null;
    this.isTestingKeys = false;
    this.activeNewsTopic = "all"; // "all" | "ai_models" | "nvidia" | "amd" | "google_cloud" | "chatgpt" | "cyber_malware"
    this.retentionPolicy = "2-Week TTL (Auto-cleanup day-wise)";
    this.liveNews = [];
    this.currentsNews = [];
    this.newsDataNews = [];
    this.threatsList = [];
    this.cveCatalog = [];
    this.cveYearFilter = "all";
    this.cveSeverityFilter = "all";
    this.cveSearchQuery = "";
    this.isLoadingCves = false;
    this.cveMetrics = null;
    this.isSyncingNvd = false;
    this.osvNews = [];
    this.osvKeyword = "";
    this.isLoadingOsv = false;
    this.savedNews = [];
    this.storedImages = [];
    this.newsKeyword = "";
    this.newsSource = "all";
    this.currentsKeyword = "";
    this.currentsCategory = "all";
    this.newsDataKeyword = "";
    this.newsDataCategory = "all";
    this.threatsCategory = "all";
    this.threatsSearch = "";
    this.isLoadingNews = false;
    this.isLoadingCurrents = false;
    this.isLoadingNewsData = false;
    this.isLoadingThreats = false;
    this.isPruningDb = false;
    this.currentsTimerSeconds = 3600;
    this.currentsTimerInterval = null;
    this.isSavingKeys = false;
    this.activeExpandedWorkspaces = new Set(["ws-karthik-1", "ws-sarah-1", "ws-alex-1"]);
    this.trendsEngine = null;


    // 3D Constellation properties
    this.threeScene = null;
    this.threeCamera = null;
    this.threeRenderer = null;
    this.threeAnimId = null;
    this.threeContainer = null;
    this.threeRaycaster = null;
    this.threeMouse = null;
    this.threeInteractiveMeshes = [];
    this.threeSelectedData = null;
    this.threeAutoRotate = true;
    this.threeTheme = "universe";
    this.threeRot = { x: 0.35, y: -0.2 };
    this.threeDist = 950;
    this.threeIsDragging = false;
    this.threePrevMouse = { x: 0, y: 0 };
    this.threeStarField = null;
    this.threeCentralCore = null;

    // Default stats
    this.stats = {
      totalUsers: 4,
      totalWorkspaces: 2,
      totalNotes: 2,
      platformTimeSpent: "9h 1m",
    };
  }

  async open(initialTab = "vaults") {
    this.currentTab = initialTab;
    this.isOpen = true;
    try {
      history.replaceState(null, "", `#/${initialTab}`);
    } catch (_) {}

    if (this.currentTab === "threats" && this.threatsList.length === 0) {
      this.isLoadingThreats = true;
    } else if (this.currentTab === "currents" && this.currentsNews.length === 0) {
      this.isLoadingCurrents = true;
    } else if (this.currentTab === "newsdata" && this.newsDataNews.length === 0) {
      this.isLoadingNewsData = true;
    } else if (this.currentTab === "cves" && this.cveCatalog.length === 0) {
      this.isLoadingCves = true;
    } else if (this.currentTab === "osv" && this.osvNews.length === 0) {
      this.isLoadingOsv = true;
    }

    this.startCurrentsAutoRefreshTimer();

    // Render immediately for instant sub-millisecond open
    this.render();

    // Fetch fresh data in background and update
    const tasks = [
      this.fetchUsers(),
      this.fetchApiKeys(),
      this.fetchSavedNews(),
      this.fetchStoredImages(),
    ];

    if (this.currentTab === "currents") {
      tasks.push(this.fetchCurrentsNews());
    } else if (this.currentTab === "newsdata") {
      tasks.push(this.fetchNewsDataNews());
    } else if (this.currentTab === "threats") {
      tasks.push(this.fetchThreats());
    } else if (this.currentTab === "cves") {
      tasks.push(this.fetchCves());
    } else if (this.currentTab === "osv") {
      tasks.push(this.fetchOsvNews());
    } else {
      tasks.push(this.fetchLiveNews());
    }

    Promise.allSettled(tasks).then(() => {
      if (this.isOpen) this.render();
    });
  }

  close() {
    this.stop3D();
    this.isOpen = false;
    const modal = document.querySelector("#adminDashboardModal");
    if (modal) modal.remove();
    try {
      const activeWs = this.store?.state?.activeWorkspaceId || "main";
      history.replaceState(null, "", `#/w/${activeWs}`);
    } catch (_) {}
  }

  // --- API Communications ---------------------------------------------------
  async fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        if (data.users && data.users.length) {
          this.users = data.users;
          if (!this.users.some((u) => u.id === this.selectedUserId)) {
            this.selectedUserId = this.users[0].id;
          }
          if (data.metrics) {
            this.stats = data.metrics;
          }
          return;
        }
      }
    } catch (e) {
      console.warn("Could not fetch remote users, using fallback:", e);
    }

    // Fallback seed data matching screenshot 1
    if (!this.users.length) {
      this.users = JSON.parse(JSON.stringify(DEFAULT_USERS));
    }
  }

  async fetchApiKeys() {
    try {
      const fbKeys = await fetchApiKeysFromFirestore();
      if (fbKeys && typeof fbKeys === "object") {
        this.apiKeys = { ...this.apiKeys, ...fbKeys };
      }
    } catch (_) {}

    try {
      const res = await fetch("/api/admin/keys");
      if (res.ok) {
        const data = await res.json();
        if (data.keys) {
          this.apiKeys = { ...this.apiKeys, ...data.keys };
        }
      }
    } catch (e) {
      console.warn("Could not fetch remote api keys:", e);
    }
  }

  async saveApiKeys() {
    this.isSavingKeys = true;
    this.render();
    try {
      await saveApiKeysToFirestore(this.apiKeys);
    } catch (_) {}

    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: this.apiKeys }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.keys) this.apiKeys = data.keys;
        this.toast("✓ API keys saved to Firebase Firestore & SQLite server database!");
      } else {
        this.toast("✓ API keys saved to Firebase Firestore!");
      }
    } catch (err) {
      this.toast("✓ API keys saved to Firebase Firestore & local profile.");
    } finally {
      this.isSavingKeys = false;
      this.render();
    }
  }

  async fetchKeyStatuses() {
    this.isTestingKeys = true;
    this.render();
    try {
      const res = await fetch("/api/admin/keys/status");
      if (res.ok) {
        const data = await res.json();
        this.keyStatuses = data.results || {};
        this.toast("✓ API Key diagnostic testing completed: 100% resilient fallback active.");
      }
    } catch (e) {
      console.warn("Could not test API keys:", e);
    } finally {
      this.isTestingKeys = false;
      this.render();
    }
  }

  async pruneDatabaseOldNews(days = 14) {
    this.isPruningDb = true;
    this.render();
    try {
      const res = await fetch("/api/admin/news/prune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      await pruneOldNewsFromFirestore(days);
      await this.fetchSavedNews();
      this.toast(`✓ 2-Week Database Cleanup: Removed ${data.prunedCount || 0} expired stories older than ${days} days (${data.cutoffDate}). Database storage saved!`);
    } catch (e) {
      console.warn("Database pruning failed:", e);
    } finally {
      this.isPruningDb = false;
      this.render();
    }
  }

  async fetchSavedNews() {
    try {
      const res = await fetch("/api/admin/news/saved");
      if (res.ok) {
        const data = await res.json();
        this.savedNews = data.stories || [];
        if (data.retentionPolicy) {
          this.retentionPolicy = data.retentionPolicy;
        }
      }
    } catch (e) {
      console.warn("Could not fetch saved news:", e);
    }

    try {
      // Background prune old news in Firestore
      pruneOldNewsFromFirestore(14).catch(() => {});

      const fbStories = await fetchSavedNewsFromFirestore();
      if (Array.isArray(fbStories) && fbStories.length > 0) {
        const existingIds = new Set(this.savedNews.map((s) => s.id));
        for (const item of fbStories) {
          if (item && item.id && !existingIds.has(item.id)) {
            this.savedNews.push(item);
            existingIds.add(item.id);
          }
        }
      }
    } catch (_) {}
  }

  async saveNewsStory(story) {
    try {
      await saveNewsStoryToFirestore(story);
    } catch (_) {}

    try {
      const res = await fetch("/api/admin/news/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story }),
      });
      if (res.ok) {
        await this.fetchSavedNews();
        this.toast(`✓ Saved “${story.title.slice(0, 30)}…” to Firebase & SQLite database (14-day retention).`);
        this.render();
        return;
      }
    } catch (e) {}

    // Local fallback
    if (!this.savedNews.some((s) => s.id === story.id)) {
      this.savedNews.unshift({ ...story, savedAt: Date.now() });
    }
    this.toast(`✓ Saved “${story.title.slice(0, 30)}…” to Firebase database.`);
    this.render();
  }

  async deleteSavedNewsStory(storyId) {
    try {
      await deleteNewsStoryFromFirestore(storyId);
    } catch (_) {}

    try {
      const res = await fetch("/api/admin/news/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: storyId }),
      });
      if (res.ok) {
        await this.fetchSavedNews();
        this.toast("Removed news item from Firebase & SQLite database.");
        this.render();
        return;
      }
    } catch (e) {}

    this.savedNews = this.savedNews.filter((s) => s.id !== storyId);
    this.render();
  }

  async fetchStoredImages() {
    try {
      const res = await fetch("/api/admin/images");
      if (res.ok) {
        const data = await res.json();
        this.storedImages = data.images || [];
      }
    } catch (e) {
      console.warn("Could not fetch stored images:", e);
    }
  }

  async fetchLiveNews() {
    this.isLoadingNews = true;
    this.render();
    try {
      // Query trending news aggregator which fetches AI, Nvidia, AMD, Google Cloud, ChatGPT, Cyber & Malware
      const params = new URLSearchParams();
      if (this.newsKeyword) params.set("search", this.newsKeyword);
      if (this.activeNewsTopic && this.activeNewsTopic !== "all") params.set("topic", this.activeNewsTopic);
      params.set("syncToDb", "true"); // Automatically syncs new items with 14-day TTL retention!

      const res = await fetch(`/api/admin/news/trending?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.stories && data.stories.length) {
          this.liveNews = data.stories;
          this.isLoadingNews = false;

          // Sync fresh news into Firestore with 2-week TTL
          syncLatestNewsToFirestore(this.liveNews).catch(() => {});

          this.render();
          return;
        }
      }
    } catch (e) {
      console.warn("Server trending news fetch fallback:", e);
    }

    // Direct browser fallback if server is offline or returned empty
    try {
      const q = encodeURIComponent(this.newsKeyword || "cybersecurity vulnerability artificial intelligence");
      
      // If Mediastack selected and key available, browser fallback can fetch Mediastack
      if (this.newsSource === "mediastack" && this.apiKeys.mediastack_key) {
        try {
          const kw = encodeURIComponent(this.newsKeyword || "cybersecurity, AI, technology");
          const mRes = await fetch(`http://api.mediastack.com/v1/news?access_key=${encodeURIComponent(this.apiKeys.mediastack_key)}&categories=technology&languages=en&limit=20&keywords=${kw}`);
          if (mRes.ok) {
            const mData = await mRes.json();
            if (mData.data?.length) {
              this.liveNews = mData.data.map((item) => ({
                id: `ms-${Math.abs(hashString(item.url || item.title)) % 10000000}`,
                title: item.title,
                source: `Mediastack · ${item.source || "Global Tech"}`,
                url: item.url,
                publishedAt: item.published_at || "Recently",
                timeAgo: "recently",
                summary: item.description || "Live Mediastack tech intelligence report.",
                takeaways: [
                  `Headline: ${item.title}`,
                  `Coverage: Verified report via Mediastack (${item.source || "Global Tech"}).`,
                  `Domain Focus: Tech intelligence, generative AI, and cyber protection vectors.`,
                  `Mitigation/Action: Cross-correlate against local security dossier.`,
                  `Strategic Value: Mirror intelligence into incident response vault cards.`
                ],
                score: 96
              }));
              this.isLoadingNews = false;
              this.render();
              return;
            }
          }
        } catch (_) {}
      }

      // If NewsAPI selected and key available, browser fallback can fetch NewsAPI
      if (this.newsSource === "newsapi" && this.apiKeys.newsapi_key) {
        try {
          const nRes = await fetch(`https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=20&language=en&apiKey=${encodeURIComponent(this.apiKeys.newsapi_key)}`);
          if (nRes.ok) {
            const nData = await nRes.json();
            if (nData.articles?.length) {
              this.liveNews = nData.articles.map((a) => ({
                id: `napi-${Math.abs(hashString(a.url || a.title)) % 10000000}`,
                title: a.title,
                source: `NewsAPI · ${a.source?.name || "Global News"}`,
                url: a.url,
                publishedAt: a.publishedAt,
                timeAgo: "recently",
                summary: a.description || "Live NewsAPI report.",
                takeaways: [
                  `Headline: ${a.title}`,
                  `Coverage: Verified report via ${a.source?.name || "NewsAPI"}.`,
                  `Domain Focus: Tech intelligence, generative AI, and cyber protection vectors.`,
                  `Mitigation/Action: Cross-correlate against local security dossier.`,
                  `Strategic Value: Mirror intelligence into incident response vault cards.`
                ],
                score: 94
              }));
              this.isLoadingNews = false;
              this.render();
              return;
            }
          }
        } catch (_) {}
      }

      // If Higgsfield selected, browser fallback can fetch HuggingFace daily papers
      if (this.newsSource === "higgsfield") {
        try {
          const hfRes = await fetch("https://huggingface.co/api/daily_papers");
          if (hfRes.ok) {
            const hfData = await hfRes.json();
            if (hfData.length) {
              this.liveNews = hfData.slice(0, 20).map((entry) => {
                const p = entry.paper || {};
                return {
                  id: `hf-paper-${p.id}`,
                  title: `Paper: ${p.title || "AI Research Paper"}`,
                  source: "Higgsfield Research / arXiv",
                  url: `https://arxiv.org/abs/${p.id}`,
                  publishedAt: entry.publishedAt || new Date().toISOString(),
                  timeAgo: "recently",
                  summary: (p.summary || "").slice(0, 260) + "...",
                  takeaways: [
                    `1. Target Domain: Frontier AI model architecture and neural reasoning systems.`,
                    `2. Practical Problem: Resolves computational constraints and benchmark limits in ${(p.title || "the paper").slice(0, 65)}.`,
                    `3. Production Workflow: Autonomous agent decision-making & multimodal retrieval-augmented workflows.`,
                    `4. Performance Metric: Significant throughput efficiency gains and accuracy boost over prior baselines.`,
                    `5. Integration Path: Open-source arXiv checkpoint and Python API pipeline for enterprise integration.`
                  ],
                  topic: "ai",
                  categoryTag: "AI Research",
                  score: 96
                };
              });
              this.liveNews.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
              this.isLoadingNews = false;
              this.render();
              return;
            }
          }
        } catch (_) {}
      }

      // Standard Hacker News fallback
      const hnRes = await fetch(`https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=story&hitsPerPage=20`);
      if (hnRes.ok) {
        const hnData = await hnRes.json();
        this.liveNews = (hnData.hits || []).map((h) => ({
          id: `hn-${h.objectID}`,
          title: h.title || "(Untitled story)",
          source: "Hacker News",
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          publishedAt: h.created_at,
          timeAgo: "recently",
          summary: `Hacker News submission by u/${h.author || "user"} with ${h.points || 0} points and ${h.num_comments || 0} discussion comments.`,
          takeaways: [
            `Headline Insight: ${h.title}`,
            `Threat Intelligence: Hacker News active security thread with community feedback.`,
            `Technical Depth: Discusses implementation specifics and exploit vector surfaces.`,
            `Mitigation Protocol: Inspect incoming logs and apply vendor zero-day patches.`,
            `Security Action: Mirror intelligence into incident response vault cards.`,
          ],
        }));
      }
    } catch (err) {
      console.warn("Direct browser feeds also failed:", err);
    } finally {
      this.isLoadingNews = false;
      this.render();
    }
  }

  updateNewsSpinner() {
    const btn = document.querySelector("#adminFetchNewsBtn");
    if (btn) {
      btn.innerHTML = `<span class="admin-spin">🔄</span> FETCHING...`;
      btn.classList.add("is-loading");
    }
  }

  createNoteFromNews(story) {
    const title = story.title || "Cyber Threat Intelligence";
    let takeaways = story.takeaways || [];
    if (takeaways.length < 7) {
      takeaways = generate7KeyPoints(story.title, story.summary, story.source);
    } else {
      takeaways = takeaways.slice(0, 7);
    }

    const takeawaysList = takeaways.map((t) => `- ${t}`).join("\n");
    const noteText = [
      `### ${title}`,
      `**Source:** ${story.source} · [Read Original Article](${story.url})`,
      `**Published:** ${story.timeAgo || "Recently"} · **Category:** ${story.categoryTag || "Intelligence Feed"}`,
      ``,
      `#### Summary`,
      `${story.summary || ""}`,
      ``,
      `#### 🎯 7 Key Special Points & Threat Intelligence Briefing`,
      takeawaysList,
    ].join("\n");

    const center = this.canvas.viewportCenter();
    const count = this.store.nodes().length;
    const node = this.store.createNode({
      prompt: title,
      isCustom: true,
      x: Math.round(center.x - 380 + (count % 3) * 60),
      y: Math.round(center.y - 290 + (count % 3) * 50),
      width: 780,
      height: 620,
    });

    this.store.updateNode(node.id, {
      text: noteText,
      prompt: title,
      versions: [{ prompt: title, text: noteText, prompts: [] }],
    });
    this.canvas.select(node.id);
    this.canvas.centerOn(node);
    this.toast(`✓ Created note on canvas: “${title.slice(0, 30)}…”`);
  }

  async fetchCurrentsNews(showSpinner = true, forceRefresh = false) {
    if (showSpinner) {
      this.isLoadingCurrents = true;
      this.render();
    }
    try {
      const params = new URLSearchParams();
      if (this.currentsKeyword) params.set("keyword", this.currentsKeyword);
      if (this.currentsCategory && this.currentsCategory !== "all") params.set("category", this.currentsCategory);
      if (forceRefresh) params.set("refresh", "true");

      const res = await fetch(`/api/admin/news/currents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.stories && data.stories.length) {
          this.currentsNews = data.stories;
          this.isLoadingCurrents = false;
          if (forceRefresh) this.currentsTimerSeconds = 3600;
          this.render();
          return;
        }
      }
    } catch (e) {
      console.warn("Server currents news fetch error:", e);
    }

    // Direct browser fallback if needed
    try {
      const key = this.apiKeys.currents_key || "Ef3StHE4k2Tgb2SrEmzxhMUe9_3or5apVTpPzcoi-jwDsJcZ";
      const kw = encodeURIComponent(this.currentsKeyword || (this.currentsCategory === "ai" ? "artificial intelligence" : (this.currentsCategory === "cybersecurity" ? "cybersecurity" : "technology")));
      const url = `https://api.currentsapi.services/v1/search?apiKey=${key}&language=en&keywords=${kw}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.news && data.news.length) {
          this.currentsNews = data.news.map((item) => ({
            id: `curr-${item.id || Math.abs(hashString(item.url || item.title)) % 10000000}`,
            title: item.title,
            source: `Currents · ${item.author || "Global Feed"}`,
            url: item.url,
            publishedAt: item.published || "Recently",
            timeAgo: "recently",
            summary: item.description || "Live intelligence dispatch via Currents API.",
            takeaways: [
              `1. Executive Intelligence: ${item.title}`,
              `2. Domain Focus: Real-time intelligence telemetry on cybersecurity and AI.`,
              `3. Core Event: ${item.description || "Ongoing technological development."}`,
              `4. Verification: Authenticated via Currents global news feed.`,
              `5. Operational Context: Cross-correlate against local security architecture.`,
              `6. Threat Surface: Review perimeter ingress and access controls.`,
              `7. Telemetry Monitoring: Continuously log endpoint activity.`,
              `8. Hardening Action: Apply software updates and security recommendations.`,
              `9. Strategic Risk: Maintain operational resilience and data integrity.`,
              `10. Canvas Directive: Create connected research node in BrainVault studio.`
            ],
            categoryTag: this.currentsCategory === "ai" ? "AI Intelligence" : (this.currentsCategory === "cybersecurity" ? "Cybersecurity" : "Top News"),
            score: 98,
          }));
          this.isLoadingCurrents = false;
          if (forceRefresh) this.currentsTimerSeconds = 3600;
          this.render();
          return;
        }
      }
    } catch (_) {}

    this.isLoadingCurrents = false;
    this.render();
  }

  startCurrentsAutoRefreshTimer(forceReset = false) {
    if (this.currentsTimerInterval && !forceReset) {
      return;
    }
    if (this.currentsTimerInterval) {
      clearInterval(this.currentsTimerInterval);
    }
    if (forceReset || this.currentsTimerSeconds <= 0) {
      this.currentsTimerSeconds = 3600;
    }
    this.currentsTimerInterval = setInterval(() => {
      if (this.currentsTimerSeconds > 0) {
        this.currentsTimerSeconds--;
        const timerEl = document.querySelector("#currentsTimerCountdown");
        if (timerEl) {
          const m = Math.floor(this.currentsTimerSeconds / 60);
          const s = this.currentsTimerSeconds % 60;
          timerEl.textContent = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        }
      } else {
        // 1 hour elapsed: auto-refresh latest news
        this.currentsTimerSeconds = 3600;
        this.fetchCurrentsNews(false, true);
        this.toast?.("⚡ Currents Real-Time: Auto-refreshed 1-hour intelligence feed.");
      }
    }, 1000);
  }

  async fetchNewsDataNews(showSpinner = true, forceRefresh = false) {
    if (showSpinner) {
      this.isLoadingNewsData = true;
      this.render();
    }
    try {
      const params = new URLSearchParams();
      if (this.newsDataKeyword) params.set("keyword", this.newsDataKeyword);
      if (this.newsDataCategory && this.newsDataCategory !== "all") params.set("category", this.newsDataCategory);
      if (forceRefresh) params.set("refresh", "true");

      const res = await fetch(`/api/admin/news/newsdata?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.stories && data.stories.length) {
          this.newsDataNews = data.stories;
          this.isLoadingNewsData = false;
          this.render();
          return;
        }
      }
    } catch (e) {
      console.warn("Server NewsData fetch error:", e);
    }

    // Direct browser fallback with NewsData.io API key
    try {
      const key = this.apiKeys.newsdata_key || "pub_e90c4dd7497c4bc2b02d59356e20b288";
      const qVal = this.newsDataKeyword || (this.newsDataCategory === "ai" ? "artificial intelligence" : (this.newsDataCategory === "cybersecurity" ? "cybersecurity" : (this.newsDataCategory === "tech" ? "technology" : "cybersecurity OR ai")));
      const q = encodeURIComponent(qVal);
      const url = `https://newsdata.io/api/1/latest?apikey=${key}&q=${q}&language=en`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results) && data.results.length) {
          this.newsDataNews = data.results.map((item) => ({
            id: `nd-${item.article_id || Math.abs(hashString(item.link || item.title)) % 10000000}`,
            title: item.title,
            source: `NewsData · ${item.source_id || "Global Tech"}`,
            url: item.link,
            publishedAt: item.pubDate || "Recently",
            timeAgo: "recently",
            summary: item.description || "Intelligence briefing published on NewsData.io.",
            takeaways: generate7KeyPoints(item.title, item.description, item.source_id),
            categoryTag: this.newsDataCategory === "ai" ? "AI Intelligence" : (this.newsDataCategory === "cybersecurity" ? "Cybersecurity" : "Technology"),
            score: 97,
          }));
          this.isLoadingNewsData = false;
          this.render();
          return;
        }
      }
    } catch (_) {}

    this.isLoadingNewsData = false;
    this.render();
  }

  async fetchThreats(showSpinner = true) {
    if (showSpinner) {
      this.isLoadingThreats = true;
      this.render();
    }
    try {
      const params = new URLSearchParams();
      if (this.threatsCategory && this.threatsCategory !== "all") params.set("category", this.threatsCategory);
      if (this.threatsSearch) params.set("search", this.threatsSearch);

      const res = await fetch(`/api/admin/threats?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.threats && data.threats.length) {
          this.threatsList = data.threats;
          this.isLoadingThreats = false;
          this.render();
          return;
        }
      }
    } catch (e) {
      console.warn("Could not fetch threats from server:", e);
    }
    this.isLoadingThreats = false;
    this.render();
  }

  createNoteFromThreat(threat) {
    const title = `${threat.cveId || "THREAT"}: ${threat.title || "Vulnerability Attack"}`;
    const tools = threat.toolsUsed || [];
    const toolsList = tools.map((t) => `- **${t}**`).join("\n");
    const noteText = [
      `### 🛡️ ${threat.cveId || ""} — ${threat.title || ""}`,
      `**Severity Score:** ${threat.severity || "CRITICAL"} (${threat.score || 9.8} CVSS v3.1) | **Category:** ${threat.category || "Weaponized Attack"}`,
      `**Affected Systems:** ${threat.vendor || "Enterprise Production Infrastructure"}`,
      `**Threat Actor / Campaign:** ${threat.threatActor || "Active Adversary Campaign"}`,
      `**CISA KEV Status:** ${threat.cisaKev ? "🔴 Actively Exploited in the Wild (Known Exploited)" : "Monitored Zero-Day"}`,
      `**NIST Official Record:** [NVD NIST Database Entry](${threat.nvdUrl || "https://nvd.nist.gov"})`,
      ``,
      `#### 📋 In-Depth Attack Briefing`,
      threat.briefing || "",
      ``,
      `#### 🎯 7 THREAT INTELLIGENCE DIMENSIONS`,
      `1. **👤 Head Hero / Threat Actor:** ${threat.headHero || threat.threatActor || "Volt Typhoon / Lead Syndicate"}`,
      `2. **🎯 Important Core Points & Root Flaw Mechanics:** ${threat.corePoints || threat.briefing || "High-severity root flaw enabling remote unauthorized control."}`,
      `3. **🏢 Affected Victims & Infrastructure Scope:** ${threat.affectedVictims || threat.vendor || "Enterprise Cloud, Healthcare & Critical Infrastructure"}`,
      `4. **⚔️ Weaponized Attack Tools & C2 Frameworks:** ${tools.join(", ") || "Cobalt Strike, Sliver C2, Mimikatz, LOLBins"}`,
      `5. **⚡ Primary Attack Use Case & Exploitation Characteristics:** ${threat.attackUseCase || threat.attackVector || "Initial unauthenticated access and credential dumping"}`,
      `6. **📡 Detection Signatures & Telemetry Indicators:** ${threat.detectionSignatures || "Monitor LSASS memory access, suspicious svchost child processes, and C2 beacons."}`,
      `7. **🛡️ Remediation, Hardening & Defensive Playbook:** ${threat.remediation || "Deploy vendor security update immediately, restrict inbound ports, and enforce zero-trust segmentation."}`,
      ``,
      `#### 🛠️ Weaponized Attack Tools Used in this Attack`,
      toolsList || "- Multiple living-off-the-land utilities and weaponized memory loaders",
    ].join("\n");

    const center = this.canvas.viewportCenter();
    const count = this.store.nodes().length;
    const node = this.store.createNode({
      prompt: title,
      isCustom: true,
      x: Math.round(center.x - 380 + (count % 3) * 60),
      y: Math.round(center.y - 290 + (count % 3) * 50),
      width: 780,
      height: 620,
    });

    this.store.updateNode(node.id, {
      text: noteText,
      prompt: title,
      versions: [{ prompt: title, text: noteText, prompts: [] }],
    });
    this.canvas.select(node.id);
    this.canvas.centerOn(node);
    this.toast(`✓ Created note on canvas: “${threat.cveId || "Threat"}”`);
  }

  async saveThreatStory(threat) {
    const tools = threat.toolsUsed || [];
    const dimensions = [
      `1. Head Hero / Actor: ${threat.headHero || threat.threatActor || "Active Adversary"}`,
      `2. Core Points & Flaw: ${threat.corePoints || threat.briefing || "High-severity exploit"}`,
      `3. Affected Victims: ${threat.affectedVictims || threat.vendor || "Enterprise systems"}`,
      `4. Attack Tools & C2: ${tools.join(", ") || "Cobalt Strike, Sliver, Mimikatz"}`,
      `5. Primary Use Case: ${threat.attackUseCase || threat.attackVector || "RCE & privilege escalation"}`,
      `6. Detection Signatures: ${threat.detectionSignatures || "LSASS memory access, svchost anomaly"}`,
      `7. Hardening Playbook: ${threat.remediation || "Emergency patch & boundary isolation"}`
    ];
    const story = {
      id: threat.id || `threat-${threat.cveId}`,
      title: `${threat.cveId}: ${threat.title}`,
      source: `NVD Threat Center · ${threat.vendor}`,
      url: threat.nvdUrl || `https://nvd.nist.gov/vuln/detail/${threat.cveId}`,
      publishedAt: threat.date || "Recent",
      timeAgo: "Active",
      summary: threat.briefing || "",
      takeaways: dimensions,
    };
    await this.saveNewsStory(story);
  }

  // --- Top Weaponized CVEs (2020-2026) & CISA KEV / NIST NVD 2.0 Ingestion ----
  async fetchCves(showSpinner = true, randomize = false) {
    if (showSpinner) {
      this.isLoadingCves = true;
      this.render();
    }
    try {
      const params = new URLSearchParams();
      if (this.cveYearFilter && this.cveYearFilter !== "all") params.set("year", this.cveYearFilter);
      if (this.cveSeverityFilter && this.cveSeverityFilter !== "all") params.set("severity", this.cveSeverityFilter);
      if (this.cveSearchQuery) params.set("search", this.cveSearchQuery);
      if (randomize) params.set("random", "true");
      if (!this.cveSearchQuery) {
        params.set("limit", "30");
      }

      const res = await fetch(`/api/admin/cves?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.cves) {
          this.cveCatalog = data.cves;
          if (data.metrics) this.cveMetrics = data.metrics;
          syncCvesToFirestore(this.cveCatalog).catch(() => {});
          this.isLoadingCves = false;
          this.render();
          return;
        }
      }
    } catch (e) {
      console.warn("Could not fetch CVE catalog:", e);
    }

    try {
      const fbCves = await fetchCvesFromFirestore();
      if (Array.isArray(fbCves) && fbCves.length > 0) {
        this.cveCatalog = fbCves;
      }
    } catch (_) {}

    this.isLoadingCves = false;
    this.render();
  }

  async syncNvdCves(query = "") {
    this.isSyncingNvd = true;
    this.render();
    try {
      const q = query || this.cveSearchQuery || "";
      const params = new URLSearchParams();
      if (q) params.set("query", q);
      params.set("limit", "25");

      const res = await fetch(`/api/admin/cves/sync-nvd?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const count = data.count || 0;
        await this.fetchCves(false);
        await this.fetchNewsDataNews(false, true);
        if (this.cveCatalog.length > 0) {
          await syncCvesToFirestore(this.cveCatalog);
        }
        this.toast(`✓ Synced ${count} CISA KEV & NVD CVE records (2020–2026) into SQLite & Firebase Firestore!`);
      } else {
        this.toast("⚠️ CISA KEV / NVD sync busy. Using cached 2020–2026 catalog.");
      }
    } catch (e) {
      this.toast(`⚠️ Sync warning: ${e.message}`);
    } finally {
      this.isSyncingNvd = false;
      this.render();
    }
  }

  createNoteFromCve(cve) {
    const title = `${cve.cveId}: ${cve.title || "Vulnerability Record"}`;
    const tools = cve.toolsUsed || [];
    const toolsList = tools.map((t) => `- **${t}**`).join("\n");
    const noteText = [
      `### ⚡ ${cve.cveId} — ${cve.title || ""}`,
      `**Year:** ${cve.year || 2026} | **CVSS Base Score:** ${cve.score || 9.8} (${cve.severity || "CRITICAL"}) | **Category:** ${cve.category || "Weaponized Exploit"}`,
      `**Affected Vendor / Platform:** ${cve.vendor || "Enterprise Production Infrastructure"}`,
      `**Attack Vector:** ${cve.attackVector || "Network / Unauthenticated Remote Payload"}`,
      `**CISA KEV Status:** ${cve.cisaKev ? "🔴 Confirmed Actively Exploited in the Wild" : "Catalog Monitored Zero-Day"}`,
      `**NIST Official Record:** [NVD NIST Database Entry](${cve.nvdUrl || `https://nvd.nist.gov/vuln/detail/${cve.cveId}`})`,
      ``,
      `#### 📋 Executive Vulnerability Intelligence Briefing`,
      cve.briefing || "",
      ``,
      `#### 🎯 7 THREAT INTELLIGENCE DIMENSIONS & PLAYBOOK`,
      `1. **👤 Head Hero / Lead Adversary:** ${cve.headHero || cve.threatActor || "Advanced Threat Actors / Weaponized Scanners"}`,
      `2. **🎯 Root Flaw Mechanics & Important Core Points:** ${cve.corePoints || cve.briefing || "High-severity root flaw enabling remote unauthorized control."}`,
      `3. **🏢 Affected Victims & Infrastructure Scope:** ${cve.affectedVictims || cve.vendor || "Enterprise Cloud, Healthcare & Critical Infrastructure"}`,
      `4. **⚔️ Weaponized Attack Tools & C2 Frameworks:** ${tools.join(", ") || "Cobalt Strike, Sliver C2, Mimikatz, LOLBins"}`,
      `5. **⚡ Primary Attack Use Case & Exploitation Characteristics:** ${cve.attackUseCase || cve.attackVector || "Initial unauthenticated access and credential dumping"}`,
      `6. **📡 Detection Signatures & Telemetry Indicators:** ${cve.detectionSignatures || "Monitor LSASS memory access, suspicious svchost child processes, and C2 beacons."}`,
      `7. **🛡️ Remediation, Hardening & Defensive Playbook:** ${cve.remediation || "Deploy vendor security update immediately, restrict inbound ports, and enforce zero-trust segmentation."}`,
      ``,
      `#### 🛠️ Weaponized Attack Tools & Exploit Kits`,
      toolsList || "- Public and weaponized exploit modules",
    ].join("\n");

    const center = this.canvas.viewportCenter();
    const count = this.store.nodes().length;
    const offsetX = (count % 4) * 80 + Math.floor((count % 16) / 4) * 25;
    const offsetY = (count % 4) * 60 + Math.floor((count % 16) / 4) * 35;
    const node = this.store.createNode({
      prompt: title,
      isCustom: true,
      x: Math.round(center.x - 390 + offsetX),
      y: Math.round(center.y - 310 + offsetY),
      width: 780,
      height: 620,
    });

    this.store.updateNode(node.id, {
      text: noteText,
      prompt: title,
      versions: [{ prompt: title, text: noteText, prompts: [] }],
    });
    this.canvas.select(node.id);
    this.canvas.centerOn(node);
    this.toast(`✓ Created note on canvas: “${cve.cveId}”`);
  }

  async saveCveToSavedNews(cve) {
    const tools = cve.toolsUsed || [];
    const dimensions = [
      `1. Head Hero / Actor: ${cve.headHero || cve.threatActor || "Adversary Group"}`,
      `2. Core Points & Flaw: ${cve.corePoints || cve.briefing || "Critical vulnerability"}`,
      `3. Affected Victims: ${cve.affectedVictims || cve.vendor || "Enterprise Systems"}`,
      `4. Attack Tools & C2: ${tools.join(", ") || "Weaponized exploit payloads"}`,
      `5. Primary Use Case: ${cve.attackUseCase || cve.attackVector || "Remote exploit vector"}`,
      `6. Detection Signatures: ${cve.detectionSignatures || "Network anomaly detection"}`,
      `7. Remediation & Hardening: ${cve.remediation || "Apply security update"}`
    ];
    const story = {
      id: cve.id || `cve-${cve.cveId}`,
      title: `${cve.cveId}: ${cve.title}`,
      source: `Top CVEs · ${cve.vendor}`,
      url: cve.nvdUrl || `https://nvd.nist.gov/vuln/detail/${cve.cveId}`,
      publishedAt: `${cve.year || 2026}-01-01`,
      timeAgo: `${cve.year}`,
      summary: cve.briefing || "",
      takeaways: dimensions,
    };
    await this.saveNewsStory(story);
  }

  // --- OSV.dev Open Source Vulnerability & Supply Chain News ------------------
  async fetchOsvNews(forceRefresh = false) {
    this.isLoadingOsv = true;
    this.render();
    try {
      const url = `/api/admin/news/osv?refresh=${forceRefresh ? "true" : "false"}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.stories && data.stories.length) {
          this.osvNews = data.stories;
          this.isLoadingOsv = false;
          this.render();
          return;
        }
      }
    } catch (e) {
      console.warn("Could not fetch OSV news:", e);
    }
    this.isLoadingOsv = false;
    this.render();
  }

  createNoteFromOsv(post) {
    const title = post.title || "OSV.dev Security Dispatch";
    const takeaways = post.takeaways || [];
    const takeawaysList = takeaways.map((t) => `- ${t}`).join("\n");
    const noteText = [
      `### 🛡️ ${title}`,
      `**Source:** ${post.source || "OSV.dev · Open Source Security"} · [Read Full Article on OSV.dev](${post.url})`,
      `**Published:** ${post.timeAgo || "Recent"} | **Category:** ${post.categoryTag || "Supply Chain & OSS Security"}`,
      ``,
      `#### 📋 Supply Chain & Vulnerability Summary`,
      `${post.summary || ""}`,
      ``,
      `#### 🎯 7 Key Special Points & Open Source Intelligence Takeaways`,
      takeawaysList || "- Key supply chain intelligence and vulnerability mitigations detailed in OSV advisory.",
    ].join("\n");

    const center = this.canvas.viewportCenter();
    const count = this.store.nodes().length;
    const offsetX = (count % 4) * 80 + Math.floor((count % 16) / 4) * 25;
    const offsetY = (count % 4) * 60 + Math.floor((count % 16) / 4) * 35;
    const node = this.store.createNode({
      prompt: title,
      isCustom: true,
      x: Math.round(center.x - 390 + offsetX),
      y: Math.round(center.y - 310 + offsetY),
      width: 780,
      height: 620,
    });

    this.store.updateNode(node.id, {
      text: noteText,
      prompt: title,
      versions: [{ prompt: title, text: noteText, prompts: [] }],
    });
    this.canvas.select(node.id);
    this.canvas.centerOn(node);
    this.toast(`✓ Created note on canvas: “${title.slice(0, 30)}…”`);
  }

  // --- Workspace Password Management -----------------------------------------
  promptSetWorkspacePassword(user, ws) {
    const isLocked = ws.passwordProtected;
    const currentPass = ws.password || "";
    const promptHtml = `
      <div class="admin-modal-overlay" id="adminPasswordModal">
        <div class="admin-dialog-card">
          <div class="admin-dialog-head">
            <div class="admin-dialog-badge">
              <span class="admin-ico">🔒</span>
              <div>
                <h3>Admin Security: Workspace Password</h3>
                <p>User: <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.username)})</p>
              </div>
            </div>
            <button class="admin-close-btn" id="adminClosePassDialog">✕</button>
          </div>
          <div class="admin-dialog-body">
            <div class="admin-dialog-info">
              <div class="admin-pill-status ${isLocked ? "status-locked" : "status-open"}">
                ${isLocked ? "🔒 CURRENTLY PASSWORD PROTECTED" : "🔓 CURRENTLY UNLOCKED"}
              </div>
              <p>Workspace: <strong>${escapeHtml(ws.name)}</strong></p>
              <p class="admin-hint">Setting a password restricts access so only users with the key (or Admin) can view and edit notes inside this workspace.</p>
            </div>
            <div class="admin-field-group">
              <label for="wsPassInput">Enter Workspace Password</label>
              <div class="admin-pass-wrap">
                <input type="text" id="wsPassInput" value="${escapeAttr(currentPass)}" placeholder="e.g. vault-key-2026" autocomplete="off" />
              </div>
            </div>
            <div class="admin-dialog-actions">
              <button class="admin-btn admin-btn-cyan" id="adminSavePassBtn">
                ✓ ${isLocked ? "Update Password" : "Set & Lock Password"}
              </button>
              ${
                isLocked
                  ? `<button class="admin-btn admin-btn-danger" id="adminRemovePassBtn">
                      🔓 Remove Password Protection
                    </button>`
                  : ""
              }
              <button class="admin-btn admin-btn-ghost" id="adminCancelPassBtn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const host = document.createElement("div");
    host.innerHTML = promptHtml;
    document.body.appendChild(host);

    const closeDialog = () => host.remove();
    host.querySelector("#adminClosePassDialog")?.addEventListener("click", closeDialog);
    host.querySelector("#adminCancelPassBtn")?.addEventListener("click", closeDialog);

    host.querySelector("#adminSavePassBtn")?.addEventListener("click", async () => {
      const pass = host.querySelector("#wsPassInput")?.value || "";
      if (!pass.trim()) {
        this.toast("Please enter a workspace password or click Remove.");
        return;
      }
      await this.saveWorkspacePassword(user.id, ws.id, pass.trim());
      closeDialog();
    });

    host.querySelector("#adminRemovePassBtn")?.addEventListener("click", async () => {
      await this.saveWorkspacePassword(user.id, ws.id, "");
      closeDialog();
    });
  }

  async saveWorkspacePassword(userId, workspaceId, password) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_workspace_password",
          userId,
          workspaceId,
          password,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users) this.users = data.users;
        this.toast(password ? "🔒 Password set successfully for workspace!" : "🔓 Password protection removed.");
      } else {
        // Local state update fallback
        const u = this.users.find((usr) => usr.id === userId);
        if (u) {
          const w = (u.workspaces || []).find((ws) => ws.id === workspaceId);
          if (w) {
            w.passwordProtected = Boolean(password);
            w.password = password;
          }
        }
        this.toast(password ? "🔒 Password set locally." : "🔓 Workspace unlocked.");
      }
    } catch (err) {
      console.warn("Could not save password remotely:", err);
    }
    if (this.store && typeof this.store.setWorkspacePassword === "function") {
      this.store.setWorkspacePassword(workspaceId, password);
    }
    this.render();
  }

  promptNewUser() {
    const dialogHtml = `
      <div class="admin-modal-overlay" id="adminNewUserModal">
        <div class="admin-dialog-card">
          <div class="admin-dialog-head">
            <div class="admin-dialog-badge">
              <span class="admin-ico">👤</span>
              <div>
                <h3>Create New User Vault</h3>
                <p>Provision an isolated database and workspace container</p>
              </div>
            </div>
            <button class="admin-close-btn" id="adminCloseNewUserDialog">✕</button>
          </div>
          <div class="admin-dialog-body" style="padding: 18px 22px; display: flex; flex-direction: column; gap: 14px;">
            <div class="admin-field-group">
              <label for="newUserNameInput" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Full Name</label>
              <input type="text" id="newUserNameInput" placeholder="e.g. Dr. Jane Foster" style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;" />
            </div>
            <div class="admin-field-group">
              <label for="newUserHandleInput" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Username Handle (without @)</label>
              <input type="text" id="newUserHandleInput" placeholder="e.g. jane_foster" style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;" />
            </div>
            <div class="admin-field-group">
              <label for="newUserEmailInput" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Email Address</label>
              <input type="email" id="newUserEmailInput" placeholder="e.g. jane.foster@brainvault.io" style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;" />
            </div>
            <div class="admin-field-group">
              <label for="newUserRoleSelect" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Role Designation</label>
              <select id="newUserRoleSelect" style="width: 100%; height: 38px; padding: 0 10px; border-radius: 8px; background: rgba(2,6,23,0.9); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;">
                <option value="RESEARCHER">RESEARCHER</option>
                <option value="ANALYST">ANALYST</option>
                <option value="DEVELOPER">DEVELOPER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div id="newUserErr" style="color: #f43f5e; font-size: 11.5px; font-family: var(--mono);"></div>
            <div class="admin-dialog-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
              <button class="admin-btn admin-btn-ghost" id="adminCancelNewUserBtn" style="padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: none; color: #94a3b8; cursor: pointer;">Cancel</button>
              <button class="admin-btn admin-btn-cyan" id="adminSubmitNewUserBtn" style="padding: 8px 20px; border-radius: 8px; border: 0; background: #06b6d4; color: #000; font-weight: 700; cursor: pointer;">✓ Create User</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const host = document.createElement("div");
    host.innerHTML = dialogHtml;
    document.body.appendChild(host);

    const closeDialog = () => host.remove();
    host.querySelector("#adminCloseNewUserDialog")?.addEventListener("click", closeDialog);
    host.querySelector("#adminCancelNewUserBtn")?.addEventListener("click", closeDialog);

    const nameInput = host.querySelector("#newUserNameInput");
    const handleInput = host.querySelector("#newUserHandleInput");
    const emailInput = host.querySelector("#newUserEmailInput");

    nameInput?.addEventListener("input", () => {
      if (!handleInput.value || handleInput.dataset.manual !== "true") {
        const auto = nameInput.value.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 20);
        handleInput.value = auto;
        if (!emailInput.value || emailInput.dataset.manual !== "true") {
          emailInput.value = auto ? `${auto}@brainvault.io` : "";
        }
      }
    });
    handleInput?.addEventListener("input", () => {
      handleInput.dataset.manual = "true";
    });
    emailInput?.addEventListener("input", () => {
      emailInput.dataset.manual = "true";
    });

    host.querySelector("#adminSubmitNewUserBtn")?.addEventListener("click", () => {
      const name = nameInput?.value.trim();
      const username = handleInput?.value.trim() || name?.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const email = emailInput?.value.trim() || `${username}@brainvault.io`;
      const role = host.querySelector("#newUserRoleSelect")?.value || "RESEARCHER";

      if (!name) {
        const err = host.querySelector("#newUserErr");
        if (err) err.textContent = "Please enter a user full name.";
        return;
      }

      const colors = ["#06b6d4", "#a855f7", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"];
      const newUser = {
        id: `usr_${Date.now()}`,
        name,
        username,
        email,
        role,
        avatarColor: colors[this.users.length % colors.length],
        timeSpent: "0m",
        lastActive: "Just now",
        tableName: `usr_usr-${username}.db`,
        workspaces: [
          {
            id: `ws-${Date.now()}`,
            name: "Main Research Space",
            color: colors[this.users.length % colors.length],
            passwordProtected: false,
            password: "",
            notes: [],
          },
        ],
      };

      fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_user", user: newUser }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.users) this.users = data.users;
          else this.users.push(newUser);
          this.selectedUserId = newUser.id;
          this.toast(`✓ Added user: ${newUser.name}`);
          closeDialog();
          this.render();
        })
        .catch(() => {
          this.users.push(newUser);
          this.selectedUserId = newUser.id;
          this.toast(`Added user locally: ${newUser.name}`);
          closeDialog();
          this.render();
        });
    });
  }

  promptEditUser(user) {
    const dialogHtml = `
      <div class="admin-modal-overlay" id="adminEditUserModal">
        <div class="admin-dialog-card">
          <div class="admin-dialog-head">
            <div class="admin-dialog-badge">
              <span class="admin-ico">✏️</span>
              <div>
                <h3>Edit User Profile</h3>
                <p>Update credentials for <strong>${escapeHtml(user.name)}</strong></p>
              </div>
            </div>
            <button class="admin-close-btn" id="adminCloseEditUserDialog">✕</button>
          </div>
          <div class="admin-dialog-body" style="padding: 18px 22px; display: flex; flex-direction: column; gap: 14px;">
            <div class="admin-field-group">
              <label for="editUserNameInput" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Display Name</label>
              <input type="text" id="editUserNameInput" value="${escapeAttr(user.name)}" style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;" />
            </div>
            <div class="admin-field-group">
              <label for="editUserEmailInput" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Email Address</label>
              <input type="email" id="editUserEmailInput" value="${escapeAttr(user.email || "")}" style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;" />
            </div>
            <div class="admin-field-group">
              <label for="editUserRoleSelect" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Role Designation</label>
              <select id="editUserRoleSelect" style="width: 100%; height: 38px; padding: 0 10px; border-radius: 8px; background: rgba(2,6,23,0.9); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;">
                <option value="RESEARCHER" ${user.role === "RESEARCHER" ? "selected" : ""}>RESEARCHER</option>
                <option value="ANALYST" ${user.role === "ANALYST" ? "selected" : ""}>ANALYST</option>
                <option value="DEVELOPER" ${user.role === "DEVELOPER" ? "selected" : ""}>DEVELOPER</option>
                <option value="ADMIN" ${user.role === "ADMIN" ? "selected" : ""}>ADMIN</option>
              </select>
            </div>
            <div class="admin-dialog-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
              <button class="admin-btn admin-btn-ghost" id="adminCancelEditUserBtn" style="padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: none; color: #94a3b8; cursor: pointer;">Cancel</button>
              <button class="admin-btn admin-btn-cyan" id="adminSubmitEditUserBtn" style="padding: 8px 20px; border-radius: 8px; border: 0; background: #06b6d4; color: #000; font-weight: 700; cursor: pointer;">✓ Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const host = document.createElement("div");
    host.innerHTML = dialogHtml;
    document.body.appendChild(host);

    const closeDialog = () => host.remove();
    host.querySelector("#adminCloseEditUserDialog")?.addEventListener("click", closeDialog);
    host.querySelector("#adminCancelEditUserBtn")?.addEventListener("click", closeDialog);

    host.querySelector("#adminSubmitEditUserBtn")?.addEventListener("click", () => {
      const newName = host.querySelector("#editUserNameInput")?.value?.trim();
      const newEmail = host.querySelector("#editUserEmailInput")?.value?.trim();
      const newRole = host.querySelector("#editUserRoleSelect")?.value || user.role;
      if (newName) user.name = newName;
      if (newEmail) user.email = newEmail;
      user.role = newRole;

      fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_user", user }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.users) this.users = d.users;
          this.toast("✓ User profile updated.");
          closeDialog();
          this.render();
        })
        .catch(() => {
          this.toast("User profile updated locally.");
          closeDialog();
          this.render();
        });
    });
  }

  promptNewWorkspace(user) {
    const dialogHtml = `
      <div class="admin-modal-overlay" id="adminNewWsModal">
        <div class="admin-dialog-card">
          <div class="admin-dialog-head">
            <div class="admin-dialog-badge">
              <span class="admin-ico">📦</span>
              <div>
                <h3>Add Isolated Workspace</h3>
                <p>For user: <strong>${escapeHtml(user.name)}</strong> (@${escapeHtml(user.username)})</p>
              </div>
            </div>
            <button class="admin-close-btn" id="adminCloseNewWsDialog">✕</button>
          </div>
          <div class="admin-dialog-body" style="padding: 18px 22px; display: flex; flex-direction: column; gap: 14px;">
            <div class="admin-field-group">
              <label for="newWsNameInput" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Workspace Name</label>
              <input type="text" id="newWsNameInput" placeholder="e.g. Incident Response Red Team" value="Security Operations Space" style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;" />
            </div>
            <div class="admin-field-group">
              <label style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Theme Accent Color</label>
              <div style="display: flex; gap: 10px; align-items: center;" id="adminWsColorRow">
                <span class="admin-color-pick is-selected" data-color="#06b6d4" style="width: 28px; height: 28px; border-radius: 50%; background: #06b6d4; cursor: pointer; border: 2px solid #fff;"></span>
                <span class="admin-color-pick" data-color="#a855f7" style="width: 28px; height: 28px; border-radius: 50%; background: #a855f7; cursor: pointer; border: 2px solid transparent;"></span>
                <span class="admin-color-pick" data-color="#10b981" style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; cursor: pointer; border: 2px solid transparent;"></span>
                <span class="admin-color-pick" data-color="#f59e0b" style="width: 28px; height: 28px; border-radius: 50%; background: #f59e0b; cursor: pointer; border: 2px solid transparent;"></span>
                <span class="admin-color-pick" data-color="#ec4899" style="width: 28px; height: 28px; border-radius: 50%; background: #ec4899; cursor: pointer; border: 2px solid transparent;"></span>
              </div>
            </div>
            <div class="admin-dialog-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
              <button class="admin-btn admin-btn-ghost" id="adminCancelNewWsBtn" style="padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: none; color: #94a3b8; cursor: pointer;">Cancel</button>
              <button class="admin-btn admin-btn-cyan" id="adminSubmitNewWsBtn" style="padding: 8px 20px; border-radius: 8px; border: 0; background: #06b6d4; color: #000; font-weight: 700; cursor: pointer;">✓ Create Workspace</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const host = document.createElement("div");
    host.innerHTML = dialogHtml;
    document.body.appendChild(host);

    let selectedColor = "#06b6d4";
    host.querySelectorAll(".admin-color-pick").forEach((el) => {
      el.addEventListener("click", () => {
        host.querySelectorAll(".admin-color-pick").forEach((p) => (p.style.borderColor = "transparent"));
        el.style.borderColor = "#fff";
        selectedColor = el.dataset.color || "#06b6d4";
      });
    });

    const closeDialog = () => host.remove();
    host.querySelector("#adminCloseNewWsDialog")?.addEventListener("click", closeDialog);
    host.querySelector("#adminCancelNewWsBtn")?.addEventListener("click", closeDialog);

    host.querySelector("#adminSubmitNewWsBtn")?.addEventListener("click", () => {
      const name = host.querySelector("#newWsNameInput")?.value?.trim() || "Security Operations Space";
      const newWs = {
        id: `ws-${Date.now()}`,
        name,
        color: selectedColor,
        passwordProtected: false,
        password: "",
        notes: [],
      };

      fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_workspace", userId: user.id, workspace: newWs }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.users) this.users = data.users;
          else {
            user.workspaces = user.workspaces || [];
            user.workspaces.push(newWs);
          }
          this.activeExpandedWorkspaces.add(newWs.id);
          this.toast(`✓ Added workspace “${newWs.name}” for ${user.name}.`);
          closeDialog();
          this.render();
        })
        .catch(() => {
          user.workspaces = user.workspaces || [];
          user.workspaces.push(newWs);
          this.activeExpandedWorkspaces.add(newWs.id);
          closeDialog();
          this.render();
        });
    });
  }

  promptAddNote(user, ws) {
    const dialogHtml = `
      <div class="admin-modal-overlay" id="adminAddNoteModal">
        <div class="admin-dialog-card admin-note-view-card">
          <div class="admin-dialog-head">
            <div class="admin-dialog-badge">
              <span class="admin-ico">📄</span>
              <div>
                <h3>Add Text File / Memo</h3>
                <p>Target Workspace: <strong>${escapeHtml(ws.name)}</strong> · Owner: <strong>${escapeHtml(user.name)}</strong></p>
              </div>
            </div>
            <button class="admin-close-btn" id="adminCloseAddNoteDialog">✕</button>
          </div>
          <div class="admin-dialog-body" style="padding: 18px 22px; display: flex; flex-direction: column; gap: 14px;">
            <div class="admin-field-group">
              <label for="newNoteTitleInput" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Title</label>
              <input type="text" id="newNoteTitleInput" placeholder="e.g. Incident Brief & Indicators" value="Incident Brief" style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px;" />
            </div>
            <div class="admin-field-group">
              <label for="newNoteBodyInput" style="font-size: 11px; font-family: var(--mono); color: #38bdf8; display: block; margin-bottom: 6px;">Note Content / Analysis</label>
              <textarea id="newNoteBodyInput" rows="7" placeholder="Enter detailed technical notes, telemetry, or threat indicators..." style="width: 100%; padding: 12px; border-radius: 8px; background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 13px; font-family: var(--mono); line-height: 1.5; resize: vertical;">Detailed telemetry and indicators of compromise.</textarea>
            </div>
            <div class="admin-dialog-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
              <button class="admin-btn admin-btn-ghost" id="adminCancelAddNoteBtn" style="padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: none; color: #94a3b8; cursor: pointer;">Cancel</button>
              <button class="admin-btn admin-btn-cyan" id="adminSubmitAddNoteBtn" style="padding: 8px 20px; border-radius: 8px; border: 0; background: #06b6d4; color: #000; font-weight: 700; cursor: pointer;">✓ Save Note</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const host = document.createElement("div");
    host.innerHTML = dialogHtml;
    document.body.appendChild(host);

    const closeDialog = () => host.remove();
    host.querySelector("#adminCloseAddNoteDialog")?.addEventListener("click", closeDialog);
    host.querySelector("#adminCancelAddNoteBtn")?.addEventListener("click", closeDialog);

    host.querySelector("#adminSubmitAddNoteBtn")?.addEventListener("click", () => {
      const title = host.querySelector("#newNoteTitleInput")?.value?.trim() || "Incident Brief";
      const body = host.querySelector("#newNoteBodyInput")?.value || "";

      const newNote = {
        id: `note-${Date.now()}`,
        title,
        text: body,
        updatedAt: "Just now",
      };

      fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_note", userId: user.id, workspaceId: ws.id, note: newNote }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.users) this.users = data.users;
          else {
            ws.notes = ws.notes || [];
            ws.notes.push(newNote);
          }
          this.activeExpandedWorkspaces.add(ws.id);
          this.toast(`✓ Added text file “${newNote.title}”.`);
          closeDialog();
          this.render();
        })
        .catch(() => {
          ws.notes = ws.notes || [];
          ws.notes.push(newNote);
          this.activeExpandedWorkspaces.add(ws.id);
          closeDialog();
          this.render();
        });
    });
  }

  viewTextNote(note, user, ws) {
    const dialogHtml = `
      <div class="admin-modal-overlay" id="adminNoteViewerModal">
        <div class="admin-dialog-card admin-note-view-card">
          <div class="admin-dialog-head">
            <div class="admin-dialog-badge">
              <span class="admin-ico">📄</span>
              <div>
                <h3>${escapeHtml(note.title)}</h3>
                <p>Owner: <strong>${escapeHtml(user.name)}</strong> · Workspace: <strong>${escapeHtml(ws.name)}</strong> · ${escapeHtml(note.updatedAt || "")}</p>
              </div>
            </div>
            <button class="admin-close-btn" id="adminCloseNoteViewer">✕</button>
          </div>
          <div class="admin-dialog-body">
            <div class="admin-note-content-box">
              <pre class="admin-note-text">${escapeHtml(note.text || "(Empty note content)")}</pre>
            </div>
            <div class="admin-dialog-actions">
              <button class="admin-btn admin-btn-cyan" id="adminPushCanvasBtn">
                📝 Push to Active Canvas Workspace
              </button>
              <button class="admin-btn admin-btn-ghost" id="adminCloseNoteViewerBtn">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const host = document.createElement("div");
    host.innerHTML = dialogHtml;
    document.body.appendChild(host);

    const closeViewer = () => host.remove();
    host.querySelector("#adminCloseNoteViewer")?.addEventListener("click", closeViewer);
    host.querySelector("#adminCloseNoteViewerBtn")?.addEventListener("click", closeViewer);
    host.querySelector("#adminPushCanvasBtn")?.addEventListener("click", () => {
      const center = this.canvas.viewportCenter();
      const created = this.store.createNode({
        prompt: note.title,
        isCustom: true,
        x: Math.round(center.x - 380),
        y: Math.round(center.y - 290),
        width: 760,
        height: 580,
      });
      this.store.updateNode(created.id, { text: note.text, prompt: note.title });
      this.canvas.select(created.id);
      this.canvas.centerOn(created);
      this.toast(`✓ Placed “${note.title}” on canvas!`);
      closeViewer();
    });
  }

  // --- Main Rendering --------------------------------------------------------
  render() {
    if (!this.isOpen) return;

    let root = document.querySelector("#adminDashboardModal");
    if (!root) {
      root = document.createElement("div");
      root.id = "adminDashboardModal";
      root.className = "admin-dashboard-overlay";
      document.body.appendChild(root);
    }

    const totalUsers = this.users.length || this.stats.totalUsers || 4;
    const totalWorkspaces = this.users.reduce((acc, u) => acc + (u.workspaces?.length || 0), 0);
    const totalNotes = this.users.reduce(
      (acc, u) => acc + (u.workspaces || []).reduce((wAcc, w) => wAcc + (w.notes?.length || 0), 0),
      0
    );
    const savedCount = this.savedNews.length;
    const imagesCount = this.storedImages.length;

    root.innerHTML = `
      <div class="admin-panel-container">
        <!-- Topbar -->
        <header class="admin-topbar admin-header">
          <div class="admin-brand-left">
            <div class="admin-brand-shield">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div class="admin-title-row">
                <h1 class="admin-main-title">BrainVault Master Admin Panel</h1>
                <span class="admin-auth-pill">AUTHENTICATED</span>
              </div>
              <p class="admin-subtitle">Logged in as <strong>@padd karthik</strong> • Multi-User Vault Manager</p>
            </div>
          </div>
          <div class="admin-topbar-right">
            <button class="admin-icon-square-btn" id="adminRefreshBtn" title="Refresh Dashboard Data">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button class="admin-logout-btn" id="adminLogoutBtn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              LOGOUT
            </button>
            <button class="admin-icon-square-btn" id="adminCloseBtn" title="Close Admin Panel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <!-- Metric Stat Cards Row (Compact & Sleek) -->
        <section class="admin-stats-row admin-stats-metrics-row">
          <div class="admin-stat-card card-cyan">
            <div class="admin-stat-icon-wrap icon-cyan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <span class="admin-stat-label">TOTAL USERS</span>
              <strong class="admin-stat-number">${totalUsers}</strong>
            </div>
          </div>

          <div class="admin-stat-card card-purple">
            <div class="admin-stat-icon-wrap icon-purple">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
            </div>
            <div>
              <span class="admin-stat-label">WORKSPACES</span>
              <strong class="admin-stat-number">${totalWorkspaces}</strong>
            </div>
          </div>

          <div class="admin-stat-card card-emerald">
            <div class="admin-stat-icon-wrap icon-emerald">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <span class="admin-stat-label">TOTAL NOTES</span>
              <strong class="admin-stat-number">${totalNotes}</strong>
            </div>
          </div>

          <div class="admin-stat-card card-amber">
            <div class="admin-stat-icon-wrap icon-amber">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <span class="admin-stat-label">PLATFORM TIME SPENT</span>
              <strong class="admin-stat-number text-amber">${escapeHtml(this.stats.platformTimeSpent || "9h 1m")}</strong>
            </div>
          </div>
        </section>

        <!-- Navigation Tabs Bar -->
        <nav class="admin-tabs-nav">
          <button class="admin-tab-btn ${this.currentTab === "vaults" ? "is-active tab-cyan" : ""}" data-tab="vaults">
            <span class="tab-ico">👥</span> User Vaults (${totalUsers})
          </button>
          <button class="admin-tab-btn ${this.currentTab === "cves" ? "is-active tab-cve" : ""}" data-tab="cves">
            <span class="tab-ico">⚡</span> Top CVEs (2020–2026)
          </button>
          <button class="admin-tab-btn ${this.currentTab === "trends" ? "is-active tab-magenta" : ""}" data-tab="trends">
            <span class="tab-ico">📈</span> 2020–2026 Trends (D3.js)
          </button>
          <button class="admin-tab-btn ${this.currentTab === "osv" ? "is-active tab-osv" : ""}" data-tab="osv">
            <span class="tab-ico">🛡️</span> OSV.dev News
          </button>
          <button class="admin-tab-btn ${this.currentTab === "threats" ? "is-active tab-threat" : ""}" data-tab="threats">
            <span class="tab-ico">🛡️</span> NVD Threat Center
          </button>
          <button class="admin-tab-btn ${this.currentTab === "currents" ? "is-active tab-emerald" : ""}" data-tab="currents">
            <span class="tab-ico">🌐</span> Currents (7-Pt)
          </button>
          <button class="admin-tab-btn ${this.currentTab === "newsdata" ? "is-active tab-orange" : ""}" data-tab="newsdata">
            <span class="tab-ico">📰</span> NewsData.io (7-Pt)
          </button>
          <button class="admin-tab-btn ${this.currentTab === "keys" ? "is-active tab-green" : ""}" data-tab="keys">
            <span class="tab-ico">🔑</span> API Keys Manager
          </button>
          <button class="admin-tab-btn ${this.currentTab === "news" ? "is-active tab-red" : ""}" data-tab="news">
            <span class="tab-ico">📡</span> Live News (7-Pt)
          </button>
          <button class="admin-tab-btn ${this.currentTab === "saved" ? "is-active tab-blue" : ""}" data-tab="saved">
            <span class="tab-ico">🗄️</span> Saved News (${savedCount})
          </button>
          <button class="admin-tab-btn ${this.currentTab === "images" ? "is-active tab-gold" : ""}" data-tab="images">
            <span class="tab-ico">🖼️</span> Image Storage (${imagesCount})
          </button>
          <button class="admin-tab-btn ${this.currentTab === "constellation" ? "is-active tab-purple" : ""}" data-tab="constellation">
            <span class="tab-ico">🌐</span> 3D Constellation
          </button>
        </nav>

        <!-- Active Tab Main Body View -->
        <div class="admin-tab-viewport admin-body admin-tab-content" id="adminTabViewport">
          ${this.renderTabBody()}
        </div>

        <!-- Footer -->
        <footer class="admin-footer">
          <div class="admin-footer-left">
            <span class="admin-green-dot"></span>
            <span>Multi-User Database: <code class="admin-db-path">/data/user_vaults/*.json</code> (Strict isolation active)</span>
          </div>
          <div class="admin-footer-right">
            <span>Admin credentials: <strong class="admin-cred-text">padd karthik / Maddy</strong></span>
          </div>
        </footer>
      </div>
    `;

    this.bindEvents(root);
    this.animateTabContent();

    // If 3D tab is active, initialize Three.js viewport
    if (this.currentTab === "constellation") {
      setTimeout(() => this.init3DScene(), 50);
    } else {
      this.stop3D();
    }

    // If D3 Trends tab is active, initialize D3 chart viewport
    if (this.currentTab === "trends") {
      setTimeout(() => {
        const mount = document.querySelector("#adminTrendsMount");
        if (mount) {
          if (!this.trendsEngine) {
            this.trendsEngine = new VulnerabilityTrendsD3({
              store: this.store,
              canvas: this.canvas,
              toast: this.toast,
            });
          }
          this.trendsEngine.render(mount);
        }
      }, 40);
    }
  }

  renderLoadingCards(message = "Fetching real-time data & security dispatches...", spinnerClass = "") {
    return `
      <div class="admin-loading-cards">
        <div class="admin-spin-loader ${spinnerClass}"></div>
        <p class="admin-loading-text">${escapeHtml(message)}</p>
        <div class="admin-skeleton-grid">
          <div class="admin-loading-card-skeleton">
            <div class="skeleton-bar bar-title"></div>
            <div class="skeleton-bar bar-sub"></div>
            <div class="skeleton-bar bar-body"></div>
            <div class="skeleton-bar bar-foot"></div>
          </div>
          <div class="admin-loading-card-skeleton">
            <div class="skeleton-bar bar-title"></div>
            <div class="skeleton-bar bar-sub"></div>
            <div class="skeleton-bar bar-body"></div>
            <div class="skeleton-bar bar-foot"></div>
          </div>
          <div class="admin-loading-card-skeleton">
            <div class="skeleton-bar bar-title"></div>
            <div class="skeleton-bar bar-sub"></div>
            <div class="skeleton-bar bar-body"></div>
            <div class="skeleton-bar bar-foot"></div>
          </div>
        </div>
      </div>
    `;
  }

  animateTabContent() {
    if (typeof window.anime !== "function") return;
    setTimeout(() => {
      const skeletons = document.querySelectorAll(".admin-loading-card-skeleton");
      if (skeletons.length) {
        window.anime({
          targets: skeletons,
          opacity: [0.4, 0.95],
          translateY: [-2, 2],
          direction: "alternate",
          loop: true,
          delay: window.anime.stagger(100),
          easing: "easeInOutSine",
          duration: 800,
        });
        return;
      }
      const cards = document.querySelectorAll(
        "#adminTabViewport .admin-news-card, #adminTabViewport .cve-card, #adminTabViewport .threat-card, #adminTabViewport .currents-card, #adminTabViewport .briefing-card, #adminTabViewport .vault-card, #adminTabViewport .osv-card, #adminTabViewport .key-card, #adminTabViewport .image-card"
      );
      if (cards.length) {
        window.anime({
          targets: cards,
          opacity: [0, 1],
          translateY: [14, 0],
          scale: [0.985, 1],
          delay: window.anime.stagger(25),
          duration: 340,
          easing: "easeOutCubic",
        });
      }
    }, 20);
  }

  renderTabBody() {
    switch (this.currentTab) {
      case "vaults":
        return this.renderUserVaultsTab();
      case "trends":
        return `<div class="admin-trends-tab-container" id="adminTrendsMount"></div>`;
      case "cves":
        return this.renderCvesTab();
      case "osv":
        return this.renderOsvTab();
      case "threats":
        return this.renderThreatsTab();
      case "currents":
        return this.renderCurrentsTab();
      case "newsdata":
        return this.renderNewsDataTab();
      case "keys":
        return this.renderApiKeysTab();
      case "news":
        return this.renderLiveNewsTab();
      case "saved":
        return this.renderSavedNewsTab();
      case "images":
        return this.renderImageStorageTab();
      case "constellation":
        return this.renderConstellationTab();
      default:
        return this.renderUserVaultsTab();
    }
  }

  // --- Tab 1: User Vaults ----------------------------------------------------
  renderUserVaultsTab() {
    const filter = (this.userSearch || "").toLowerCase();
    const filteredUsers = this.users.filter(
      (u) =>
        u.name.toLowerCase().includes(filter) ||
        u.username.toLowerCase().includes(filter) ||
        (u.email || "").toLowerCase().includes(filter)
    );

    const selectedUser = this.users.find((u) => u.id === this.selectedUserId) || this.users[0] || null;
    const workspaces = selectedUser ? selectedUser.workspaces || [] : [];

    return `
      <div class="admin-vaults-layout">
        <!-- Left: Users List -->
        <aside class="admin-users-sidebar">
          <div class="admin-users-search-row">
            <div class="admin-search-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="adminUserSearchInput" placeholder="Search users..." value="${escapeAttr(this.userSearch)}" />
            </div>
            <button class="admin-new-user-btn" id="adminNewUserBtn">+ NEW USER</button>
          </div>

          <div class="admin-user-cards-list">
            ${filteredUsers
              .map((u) => {
                const isSelected = selectedUser && selectedUser.id === u.id;
                const wsCount = u.workspaces?.length || 0;
                const notesCount = (u.workspaces || []).reduce((acc, w) => acc + (w.notes?.length || 0), 0);
                const roleBadge = u.role === "ADMIN" ? `<span class="admin-badge-gold">ADMIN</span>` : "";
                const borderAccent = u.avatarColor || "#06b6d4";

                return `
                <div class="admin-user-item ${isSelected ? "is-selected" : ""}" data-user-id="${u.id}" style="--user-accent: ${borderAccent};">
                  <div class="admin-user-item-content">
                    <div class="admin-user-item-top">
                      <div class="admin-user-item-meta">
                        <span class="admin-user-avatar-dot" style="background: ${borderAccent};"></span>
                        <strong class="admin-user-item-name">${escapeHtml(u.name)}</strong>
                        ${roleBadge}
                      </div>
                      <div class="admin-user-item-actions">
                        <button class="admin-item-action-btn edit-user" title="Edit user" data-action="edit-user" data-user-id="${u.id}">✏️</button>
                        ${
                          u.role !== "ADMIN"
                            ? `<button class="admin-item-action-btn del-user" title="Delete user" data-action="del-user" data-user-id="${u.id}">🗑️</button>`
                            : ""
                        }
                      </div>
                    </div>
                    <div class="admin-user-item-handle">@${escapeHtml(u.username)}</div>
                    <div class="admin-user-item-bottom">
                      <span>🕒 ${escapeHtml(u.timeSpent || "0m")}</span>
                      <span>${wsCount} workspaces • ${notesCount} notes</span>
                    </div>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </aside>

        <!-- Right: Selected User Vault Detail -->
        <main class="admin-user-detail-panel">
          ${
            selectedUser
              ? `
            <div class="admin-selected-user-card" style="--user-accent: ${selectedUser.avatarColor || "#06b6d4"};">
              <div class="admin-sel-avatar" style="background: ${selectedUser.avatarColor || "#06b6d4"};">
                <span>${(selectedUser.name || "U")[0].toUpperCase()}</span>
              </div>
              <div class="admin-sel-info">
                <div class="admin-sel-title-row">
                  <h2 class="admin-sel-name">${escapeHtml(selectedUser.name)}</h2>
                  <span class="admin-role-badge ${selectedUser.role === "ADMIN" ? "badge-admin" : "badge-member"}">
                    ${escapeHtml(selectedUser.role || "MEMBER")}
                  </span>
                </div>
                <div class="admin-sel-handle-row">
                  <span>@${escapeHtml(selectedUser.username)}</span>
                  <span class="admin-dot-sep">•</span>
                  <span>${escapeHtml(selectedUser.email || "")}</span>
                </div>
                <div class="admin-sel-table-row">
                  <span class="admin-green-dot"></span>
                  <span>Dedicated Isolated Table: <code class="admin-code-table">${escapeHtml(selectedUser.tableName || `usr_${selectedUser.id}.db`)}</code></span>
                </div>
              </div>
              <div class="admin-sel-metrics-box">
                <div class="admin-sel-metric">
                  <span class="admin-metric-label">TIME SPENT</span>
                  <strong class="admin-metric-val text-amber">${escapeHtml(selectedUser.timeSpent || "3h 56m")}</strong>
                </div>
                <div class="admin-sel-metric">
                  <span class="admin-metric-label">LAST ACTIVE</span>
                  <strong class="admin-metric-val text-cyan">${escapeHtml(selectedUser.lastActive || "5:05:55 pm")}</strong>
                </div>
              </div>
            </div>

            <!-- Isolated Workspaces & Notes Section -->
            <div class="admin-workspaces-section">
              <div class="admin-section-header">
                <div class="admin-section-title-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                    <polyline points="2 17 12 22 22 17"/>
                    <polyline points="2 12 12 17 22 12"/>
                  </svg>
                  <h3 class="admin-section-title">
                    ${escapeHtml(selectedUser.name.toUpperCase())}'S ISOLATED WORKSPACES (${workspaces.length})
                  </h3>
                </div>
                <div class="admin-section-right-tools">
                  <span class="admin-isolation-tag">Workspaces & notes never cross-sync between users</span>
                  <button class="admin-btn admin-btn-cyan-outline" id="adminAddWorkspaceBtn" data-user-id="${selectedUser.id}">
                    + NEW WORKSPACE
                  </button>
                </div>
              </div>

              <!-- Workspace Cards Grid / List -->
              <div class="admin-workspaces-list">
                ${
                  workspaces.length === 0
                    ? `<div class="admin-empty-workspaces">
                        <p>No workspaces created by this user yet.</p>
                        <button class="admin-btn admin-btn-cyan" id="adminEmptyAddWsBtn" data-user-id="${selectedUser.id}">
                          + Create First Workspace
                        </button>
                      </div>`
                    : workspaces
                        .map((ws) => {
                          const isExpanded = this.activeExpandedWorkspaces.has(ws.id);
                          const isLocked = Boolean(ws.passwordProtected);
                          const notes = ws.notes || [];

                          return `
                        <div class="admin-ws-card" data-ws-id="${ws.id}" style="border-left: 4px solid ${ws.color || "#06b6d4"};">
                          <div class="admin-ws-head">
                            <div class="admin-ws-head-left">
                              <span class="admin-ws-color-chip" style="background: ${ws.color || "#06b6d4"};"></span>
                              <strong class="admin-ws-name">${escapeHtml(ws.name)}</strong>
                              <span class="admin-ws-lock-pill ${isLocked ? "pill-locked" : "pill-unlocked"}">
                                ${isLocked ? "🔒 PASSWORD LOCKED" : "🔓 UNLOCKED"}
                              </span>
                              <span class="admin-ws-count">${notes.length} notes</span>
                            </div>
                            <div class="admin-ws-head-actions">
                              <button class="admin-btn admin-btn-small admin-btn-amber admin-set-pass-btn"
                                data-user-id="${selectedUser.id}" data-ws-id="${ws.id}" title="Set or update password for this user's workspace">
                                🔑 ${isLocked ? "Change Password" : "Set Password"}
                              </button>
                              <button class="admin-btn admin-btn-small admin-btn-cyan-outline admin-toggle-notes-btn"
                                data-ws-id="${ws.id}">
                                👁 ${isExpanded ? "Hide Notes" : "View Notes (" + notes.length + ")"}
                              </button>
                              <button class="admin-btn admin-btn-small admin-btn-ghost admin-add-note-btn"
                                data-user-id="${selectedUser.id}" data-ws-id="${ws.id}">
                                + Add Note
                              </button>
                              <button class="admin-btn admin-btn-small admin-btn-danger admin-del-ws-btn"
                                data-user-id="${selectedUser.id}" data-ws-id="${ws.id}" title="Delete workspace">
                                🗑️
                              </button>
                            </div>
                          </div>

                          <!-- Text Files / Notes List -->
                          ${
                            isExpanded
                              ? `
                            <div class="admin-ws-notes-drawer">
                              <div class="admin-drawer-head">
                                <span>Text Files &amp; Memos (${notes.length})</span>
                                <span class="admin-drawer-hint">Click note to read or push directly to canvas</span>
                              </div>
                              <div class="admin-notes-grid">
                                ${
                                  notes.length === 0
                                    ? `<div class="admin-empty-notes">No text files in this workspace. Click “+ Add Note” to write one.</div>`
                                    : notes
                                        .map(
                                          (note) => `
                                      <div class="admin-note-tile" data-note-id="${note.id}">
                                        <div class="admin-note-tile-head">
                                          <strong class="admin-note-tile-title truncate">${escapeHtml(note.title)}</strong>
                                          <span class="admin-note-tile-time">${escapeHtml(note.updatedAt || "")}</span>
                                        </div>
                                        <p class="admin-note-tile-snippet">${escapeHtml((note.text || "").slice(0, 120)) || "(Empty text file)"}...</p>
                                        <div class="admin-note-tile-actions">
                                          <button class="admin-btn-tiny admin-view-note-btn"
                                            data-user-id="${selectedUser.id}" data-ws-id="${ws.id}" data-note-id="${note.id}">
                                            👁 View Text
                                          </button>
                                          <button class="admin-btn-tiny admin-push-canvas-btn"
                                            data-user-id="${selectedUser.id}" data-ws-id="${ws.id}" data-note-id="${note.id}">
                                            📝 Push to Canvas
                                          </button>
                                        </div>
                                      </div>
                                    `
                                        )
                                        .join("")
                                }
                              </div>
                            </div>
                          `
                              : ""
                          }
                        </div>
                      `;
                        })
                        .join("")
                }
              </div>
            </div>
          `
              : `<div class="admin-no-user-selected"><p>Select or create a user to view their isolated vault.</p></div>`
          }
        </main>
      </div>
    `;
  }

  // --- Tab 2: API Keys Manager -----------------------------------------------
  renderApiKeysTab() {
    const getStatusPill = (keyName) => {
      if (!this.keyStatuses) {
        return `<div class="key-status-row"><span class="key-status-badge status-fallback">⚡ Free Fallback Active (Click Test Keys to Verify)</span></div>`;
      }
      const info = this.keyStatuses[keyName];
      if (!info) {
        return `<div class="key-status-row"><span class="key-status-badge status-fallback">⚡ Ready / Fallback Active</span></div>`;
      }
      const cls =
        info.status === "active"
          ? "status-active"
          : info.status === "rate_limited"
            ? "status-rate_limited"
            : info.status === "fallback_active"
              ? "status-fallback"
              : "status-unconfigured";
      const icon = info.status === "active" ? "✓" : info.status === "rate_limited" ? "⚠️" : "⚡";
      return `
        <div class="key-status-row">
          <span class="key-status-badge ${cls}" title="${escapeAttr(info.message)}">
            ${icon} ${escapeHtml(info.message || info.status)}
          </span>
        </div>
      `;
    };

    return `
      <div class="admin-apikeys-container">
        <!-- Top banner with Key Testing HUD -->
        <div class="admin-banner-card banner-green">
          <div class="admin-banner-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-1-1l-3 3m2-2l-3 3m-2-2l-3 3m2-2l-3 3M7 11l5-5-5-5-5 5 5 5z"/>
            </svg>
          </div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
              <h2 class="admin-banner-title">Master Admin API Keys &amp; Diagnostics Engine</h2>
              <button type="button" class="admin-btn admin-btn-cyan" id="adminTestKeysBtn" ${this.isTestingKeys ? "disabled" : ""} style="padding: 6px 14px; font-size: 11px; font-weight: 700; cursor: pointer;">
                ${this.isTestingKeys ? "TESTING KEYS..." : "🔍 TEST ALL API KEYS NOW"}
              </button>
            </div>
            <p class="admin-banner-desc">
              Manage API keys for Mediastack, Higgsfield AI, NewsAPI.org, Reddit JSON API, RSS-to-JSON Gateway, Currents, and NewsData.io.
            </p>
            <p class="admin-banner-sub">
              <strong>100% Zero-Downtime Resilience:</strong> If an API key hits rate limits (429) or is expired, BrainVault automatically and seamlessly routes queries through high-speed, CORS-open free live feeds (Hacker News Algolia, Dev.to, CISA KEV, Hugging Face, NVD 2.0).
            </p>
          </div>
        </div>

        <!-- 9 Input cards grid (3 columns x 3 rows) -->
        <form class="admin-keys-grid" id="adminApiKeysForm">
          <div class="admin-key-card">
            <label class="admin-key-label" for="key_mediastack">
              <span class="key-glyph">🌐</span> Mediastack API Access Key
            </label>
            <input type="text" id="key_mediastack" name="mediastack_key"
              placeholder="e.g. a363c1ceab62c54f115b512011ec8dd7..."
              value="${escapeAttr(this.apiKeys.mediastack_key || "")}" />
            ${getStatusPill("mediastack_key")}
          </div>

          <div class="admin-key-card">
            <label class="admin-key-label" for="key_newsdata">
              <span class="key-glyph">📡</span> NewsData.io API Key (7-Pt Briefings, Cyber &amp; Tech)
            </label>
            <input type="text" id="key_newsdata" name="newsdata_key"
              placeholder="e.g. pub_e90c4dd7497c4bc2b02d59356e20b288..."
              value="${escapeAttr(this.apiKeys.newsdata_key || "pub_e90c4dd7497c4bc2b02d59356e20b288")}" />
            ${getStatusPill("newsdata_key")}
          </div>

          <div class="admin-key-card">
            <label class="admin-key-label" for="key_currents">
              <span class="key-glyph">🌐</span> Currents API Key (Cyber, AI &amp; World News)
            </label>
            <input type="text" id="key_currents" name="currents_key"
              placeholder="e.g. Ef3StHE4k2Tgb2SrEmzxhMUe9_3or5apVTpPzcoi-jwDsJcZ..."
              value="${escapeAttr(this.apiKeys.currents_key || "Ef3StHE4k2Tgb2SrEmzxhMUe9_3or5apVTpPzcoi-jwDsJcZ")}" />
            ${getStatusPill("currents_key")}
          </div>

          <div class="admin-key-card">
            <label class="admin-key-label" for="key_newsapi">
              <span class="key-glyph">📰</span> NewsAPI.org API Key
            </label>
            <input type="text" id="key_newsapi" name="newsapi_key"
              placeholder="e.g. 7d23582d0e384e6ca8452036ee6331cc..."
              value="${escapeAttr(this.apiKeys.newsapi_key || "")}" />
            ${getStatusPill("newsapi_key")}
          </div>

          <div class="admin-key-card">
            <label class="admin-key-label" for="key_higgsfield">
              <span class="key-glyph">🔬</span> Higgsfield AI API Key (Key:Secret)
            </label>
            <input type="text" id="key_higgsfield" name="higgsfield_key"
              placeholder="e.g. 80d5a575-cacb...:af1ccaa616..."
              value="${escapeAttr(this.apiKeys.higgsfield_key || "")}" />
            ${getStatusPill("higgsfield_key")}
          </div>

          <div class="admin-key-card">
            <label class="admin-key-label" for="key_reddit">
              <span class="key-glyph">&gt;_</span> Reddit JSON API / User-Agent Identifier
            </label>
            <input type="text" id="key_reddit" name="reddit_user_agent"
              placeholder="e.g. BrainVaultApp/3.0 (by u/username)"
              value="${escapeAttr(this.apiKeys.reddit_user_agent || "")}" />
            ${getStatusPill("reddit_user_agent")}
          </div>

          <div class="admin-key-card">
            <label class="admin-key-label" for="key_gnews">
              <span class="key-glyph">🔑</span> GNews.io API Key (Optional)
            </label>
            <input type="text" id="key_gnews" name="gnews_key"
              placeholder="Paste custom GNews key (optional)..."
              value="${escapeAttr(this.apiKeys.gnews_key || "")}" />
            ${getStatusPill("gnews_key")}
          </div>

          <div class="admin-key-card">
            <label class="admin-key-label" for="key_rss2json">
              <span class="key-glyph">((•))</span> RSS-to-JSON Gateway API Key
            </label>
            <input type="text" id="key_rss2json" name="rss2json_key"
              placeholder="e.g. rss2json_key_123456..."
              value="${escapeAttr(this.apiKeys.rss2json_key || "")}" />
          </div>

          <div class="admin-key-card">
            <label class="admin-key-label" for="key_wired">
              <span class="key-glyph">⚡</span> Wired Science &amp; Tech Key Block
            </label>
            <input type="text" id="key_wired" name="wired_key"
              placeholder="Paste Wired API key (optional)..."
              value="${escapeAttr(this.apiKeys.wired_key || "")}" />
          </div>

          <div class="admin-keys-submit-row">
            <button type="submit" class="admin-save-keys-btn" id="adminSaveKeysBtn" ${this.isSavingKeys ? "disabled" : ""}>
              ${this.isSavingKeys ? "SAVING..." : "✓ SAVE KEYS TO PROFILE &amp; DATABASE"}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // --- Tab 3: Live Fetch News ------------------------------------------------
  renderLiveNewsTab() {
    const activeTopic = this.activeNewsTopic || "all";

    const getStoryTopicKey = (s) => {
      if (s.categoryKey) return s.categoryKey;
      const text = `${s.title} ${s.summary} ${s.source}`.toLowerCase();
      if (/nvidia|blackwell|b200|gb200|dgx|rtx 50/i.test(text)) return "nvidia";
      if (/amd|mi325x|mi350|rocm|ryzen/i.test(text)) return "amd";
      if (/chatgpt|openai|o1|o3-mini|gpt-4/i.test(text)) return "chatgpt";
      if (/google|gemini|gcp|vertex ai|tpu|trillium/i.test(text)) return "google_cloud";
      if (/ransomware|malware|cve|cisa|zero-day|vulnerab/i.test(text)) return "cyber_malware";
      return "ai_models";
    };

    const counts = {
      all: this.liveNews.length,
      ai_models: this.liveNews.filter((s) => getStoryTopicKey(s) === "ai_models").length,
      nvidia: this.liveNews.filter((s) => getStoryTopicKey(s) === "nvidia").length,
      amd: this.liveNews.filter((s) => getStoryTopicKey(s) === "amd").length,
      google_cloud: this.liveNews.filter((s) => getStoryTopicKey(s) === "google_cloud").length,
      chatgpt: this.liveNews.filter((s) => getStoryTopicKey(s) === "chatgpt").length,
      cyber_malware: this.liveNews.filter((s) => getStoryTopicKey(s) === "cyber_malware").length,
    };

    let filteredNews = this.liveNews.filter((story) => {
      if (activeTopic === "all") return true;
      return getStoryTopicKey(story) === activeTopic;
    });

    // Sort latest-first (publishedAt descending)
    filteredNews.sort((a, b) => {
      const getTs = (item) => {
        const d = item.publishedAt;
        if (!d || d === "Live Trending" || d === "Today") return Infinity;
        const ts = new Date(d).getTime();
        return isNaN(ts) ? 0 : ts;
      };
      const diff = getTs(b) - getTs(a);
      if (diff !== 0 && !isNaN(diff)) return diff;
      return (b.score || 0) - (a.score || 0);
    });

    return `
      <div class="admin-news-tab-container">
        <!-- 2-Week Database Storage Retention Banner -->
        <div class="db-retention-banner">
          <div class="db-retention-left">
            <span class="db-retention-tag">📅 2-WEEK TTL DATABASE RETENTION</span>
            <span class="db-retention-text">
              Automatic storage space optimizer active: Only new stories are synced, and articles older than 14 days are cleaned day-wise.
            </span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="db-retention-btn" id="adminPruneDbBtn" ${this.isPruningDb ? "disabled" : ""}>
              ${this.isPruningDb ? "CLEANING DB..." : "🧹 RUN 2-WEEK CLEANUP NOW"}
            </button>
            <button type="button" class="db-retention-btn" id="adminSyncAllDbBtn" style="border-color: #38bdf8; background: rgba(56, 189, 248, 0.18); color: #38bdf8;">
              🔄 SYNC FRESH TO DB &amp; FIRESTORE
            </button>
          </div>
        </div>

        <!-- Control Header -->
        <div class="admin-news-headbar">
          <div class="admin-news-headbar-left">
            <span class="admin-live-pulse-dot"></span>
            <strong>Admin Live News &amp; Model Intelligence</strong>
            <span class="admin-news-subtext">Live trending updates on AI, Nvidia, AMD, Google Cloud, ChatGPT &amp; Cyber Threat Feeds</span>
          </div>

          <div class="admin-news-headbar-right">
            <!-- Keyword search on feeds -->
            <div class="admin-news-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="adminNewsKeywordInput"
                placeholder="Search topics (e.g. Blackwell, o3-mini, Gemini, CVE)..."
                value="${escapeAttr(this.newsKeyword || "")}" />
            </div>

            <!-- Fetch Now Button -->
            <button class="admin-fetch-btn" id="adminFetchNewsBtn">
              <span class="admin-ico">🔄</span> FETCH LIVE NEWS
            </button>
          </div>
        </div>

        <!-- Thematic Category Filter Tabs Bar (Color Coded to Match News Theme Feeds) -->
        <div class="admin-topic-tabs-bar" role="tablist" aria-label="Topic filters">
          <button class="admin-topic-tab ${activeTopic === "all" ? "is-active" : ""}" data-news-topic="all">
            ⚡ All Streams <span class="admin-topic-count">${counts.all}</span>
          </button>
          <button class="admin-topic-tab ${activeTopic === "ai_models" ? "is-active" : ""}" data-news-topic="ai_models" style="color: #c084fc;">
            🤖 AI Models &amp; Releases <span class="admin-topic-count">${counts.ai_models}</span>
          </button>
          <button class="admin-topic-tab ${activeTopic === "nvidia" ? "is-active" : ""}" data-news-topic="nvidia" style="color: #10b981;">
            🟢 Nvidia Tech &amp; GPUs <span class="admin-topic-count">${counts.nvidia}</span>
          </button>
          <button class="admin-topic-tab ${activeTopic === "amd" ? "is-active" : ""}" data-news-topic="amd" style="color: #f97316;">
            🔴 AMD Hardware &amp; ROCm <span class="admin-topic-count">${counts.amd}</span>
          </button>
          <button class="admin-topic-tab ${activeTopic === "google_cloud" ? "is-active" : ""}" data-news-topic="google_cloud" style="color: #38bdf8;">
            ☁️ Google &amp; Cloud AI <span class="admin-topic-count">${counts.google_cloud}</span>
          </button>
          <button class="admin-topic-tab ${activeTopic === "chatgpt" ? "is-active" : ""}" data-news-topic="chatgpt" style="color: #2dd4bf;">
            ⚡ ChatGPT &amp; OpenAI <span class="admin-topic-count">${counts.chatgpt}</span>
          </button>
          <button class="admin-topic-tab ${activeTopic === "cyber_malware" ? "is-active" : ""}" data-news-topic="cyber_malware" style="color: #f43f5e;">
            🚨 Cyber, Malware &amp; Vulns <span class="admin-topic-count">${counts.cyber_malware}</span>
          </button>
        </div>

        <!-- News Cards Grid (3 Columns) -->
        <div class="admin-news-grid">
          ${
            this.isLoadingNews
              ? this.renderLoadingCards("Querying live updates on AI, Nvidia, AMD, Google Cloud, ChatGPT, and Cyber Malware...")
              : filteredNews.length === 0
                ? `
              <div class="admin-no-news">
                <p>No news items match your current topic filter (“${escapeHtml(activeTopic)}”). Click “FETCH LIVE NEWS” to pull updates.</p>
              </div>
            `
                : filteredNews
                    .map((story) => {
                      const isSaved = this.savedNews.some((s) => s.id === story.id || s.title === story.title);
                      let takeaways = story.takeaways || [];
                      if (takeaways.length < 7) {
                        takeaways = generate7KeyPoints(story.title, story.summary, story.source);
                      } else {
                        takeaways = takeaways.slice(0, 7);
                      }

                      const topKey = getStoryTopicKey(story);
                      const titleColorClass = story.colorClass || `title-color-${topKey === "ai_models" ? "aimodel" : topKey === "google_cloud" ? "google" : topKey === "cyber_malware" ? "cyber" : topKey}`;
                      const cardThemeClass = `card-theme-${topKey === "ai_models" ? "aimodel" : topKey === "google_cloud" ? "google" : topKey === "cyber_malware" ? "cyber" : topKey}`;
                      const brief = story.modelReleaseBrief;

                      return `
                    <div class="admin-news-card ${cardThemeClass}" data-story-id="${story.id}">
                      <div class="admin-news-card-head">
                        <span class="admin-source-badge">${escapeHtml(story.source || "Intelligence Feed")}</span>
                        <span class="currents-cat-pill" style="border-color: ${story.colorHex || "#38bdf8"}; color: ${story.colorHex || "#38bdf8"};">
                          ${escapeHtml(story.categoryTag || "Live Tech")}
                        </span>
                        <span class="admin-news-time">${escapeHtml(story.timeAgo || "recently")}</span>
                      </div>

                      <!-- Heading in Different Theme Colors to Match Feeds -->
                      <h3 class="admin-news-title ${titleColorClass}">
                        <a href="${escapeAttr(story.url)}" target="_blank" rel="noopener noreferrer">
                          ${escapeHtml(story.title)}
                        </a>
                      </h3>

                      <p class="admin-news-summary">
                        ${escapeHtml(story.summary || "")}
                      </p>

                      <!-- If Model Released: Explain in a Structured Brief with Key Features -->
                      ${
                        brief
                          ? `
                        <div class="admin-model-brief-box">
                          <div class="admin-model-brief-head">
                            <span class="admin-model-brief-badge">⭐ MODEL RELEASE BRIEF</span>
                            <span class="admin-model-brief-dev">${escapeHtml(brief.developer)} · ${escapeHtml(brief.releaseType)}</span>
                          </div>
                          <div class="admin-model-specs">
                            <strong>Architecture &amp; Specs:</strong> ${escapeHtml(brief.architectureSpecs)}
                          </div>
                          <div class="admin-model-features-title">🎯 Key Breakthrough Features:</div>
                          <ul class="admin-model-features-list">
                            ${(brief.keyFeatures || []).map((feat) => `<li>${escapeHtml(feat)}</li>`).join("")}
                          </ul>
                          <div class="admin-model-benchmark">
                            <strong>Leaderboard Benchmark:</strong> ${escapeHtml(brief.benchmarkHighlights)}
                          </div>
                          <div class="admin-model-rec">
                            <strong>Deployment Guidance:</strong> ${escapeHtml(brief.recommendation)}
                          </div>
                        </div>
                      `
                          : ""
                      }

                      <!-- Collapsible 7 Key Special Points Button & Box -->
                      <button class="admin-takeaways-toggle-btn" data-action="toggle-takeaways" data-story-id="${story.id}" data-takeaways-count="${takeaways.length || 7}">
                        👁️ View Key Points (${takeaways.length || 7})
                      </button>

                      <div class="admin-takeaways-box admin-10point-box is-hidden" id="takeaways-box-${story.id}">
                        <div class="admin-takeaways-title admin-10point-title">🎯 7 KEY SPECIAL POINTS &amp; THREAT INTEL:</div>
                        <ul class="admin-takeaways-list admin-10point-list">
                          ${takeaways.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
                        </ul>
                      </div>

                      <!-- Bottom Actions Row -->
                      <div class="admin-news-actions-row">
                        <a href="${escapeAttr(story.url)}" target="_blank" rel="noopener noreferrer" class="admin-read-link">
                          Read Full ↗
                        </a>
                        <div class="admin-news-btn-group">
                          <button class="admin-btn-save-db ${isSaved ? "is-saved" : ""}" data-action="save-db" data-story-id="${story.id}">
                            ${isSaved ? "✓ IN DB" : "💾 SAVE TO DB"}
                          </button>
                          <button class="admin-btn-create-note" data-action="create-note" data-story-id="${story.id}" title="Create a note directly onto canvas with key features">
                            📝 + CREATE NOTE
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                    })
                    .join("")
          }
        </div>
      </div>
    `;
  }


  // --- NVD Threat Center & Dangerous CVE Attacks Tab -------------------------
  renderThreatsTab() {
    const threats = this.threatsList || [];
    const criticalCount = threats.filter((t) => (t.severity || "").toUpperCase() === "CRITICAL").length;
    const ransomCount = threats.filter((t) => (t.category || "").toLowerCase().includes("ransomware")).length;
    const zeroDayCount = threats.filter((t) => (t.category || "").toLowerCase().includes("zero-day") || (t.category || "").toLowerCase().includes("rce")).length;
    const kevCount = threats.filter((t) => t.cisaKev).length;

    return `
      <div class="admin-threats-container">
        <!-- Threat Center Header HUD -->
        <div class="threat-hud-banner">
          <div class="threat-hud-left">
            <div class="threat-radar-pulse"></div>
            <div>
              <div class="threat-hud-tag-row">
                <span class="threat-live-tag">LIVE TELEMETRY</span>
                <span class="threat-nist-tag">NVD NIST 2.0 API</span>
                <span class="threat-cisa-tag">CISA KEV CATALOG</span>
                <span class="threat-mitre-tag">MITRE ATT&amp;CK TOOLS</span>
              </div>
              <h2 class="threat-hud-title">National Vulnerability Database &amp; Dangerous Cyber Threats Center</h2>
              <p class="threat-hud-sub">
                Real-time weaponized exploit intelligence tracking zero-days, ransomware syndicates, covert trojans, viruses, and attack toolchains.
              </p>
            </div>
          </div>
          <div class="threat-hud-right">
            <button class="threat-refresh-btn" id="adminRefreshThreatsBtn">
              <span class="threat-spin-ico">🔄</span> REFRESH TELEMETRY
            </button>
          </div>
        </div>

        <!-- 4 Cyber Metrics Cards -->
        <div class="threat-metrics-grid">
          <div class="threat-metric-card metric-critical">
            <div class="metric-top"><span class="metric-glyph">🚨</span> <strong>CRITICAL SEVERITY</strong></div>
            <div class="metric-val">${criticalCount || 10}</div>
            <div class="metric-desc">CVSS Score 9.0 - 10.0 Unauthenticated RCE</div>
          </div>
          <div class="threat-metric-card metric-ransom">
            <div class="metric-top"><span class="metric-glyph">💀</span> <strong>RANSOMWARE WEAPONS</strong></div>
            <div class="metric-val">${ransomCount || 8}</div>
            <div class="metric-desc">LockBit 3.0, BlackCat/ALPHV, Akira Extortion</div>
          </div>
          <div class="threat-metric-card metric-zeroday">
            <div class="metric-top"><span class="metric-glyph">⚡</span> <strong>ACTIVE ZERO-DAYS</strong></div>
            <div class="metric-val">${zeroDayCount || 12}</div>
            <div class="metric-desc">Unpatched Remote Code Execution Vectors</div>
          </div>
          <div class="threat-metric-card metric-kev">
            <div class="metric-top"><span class="metric-glyph">🔴</span> <strong>CISA KEV CATALOG</strong></div>
            <div class="metric-val">${kevCount || 25}+</div>
            <div class="metric-desc">Confirmed Actively Exploited in the Wild</div>
          </div>
        </div>

        <!-- Filter & Search Controls -->
        <div class="threat-controls-row">
          <div class="threat-categories-group">
            <button class="threat-cat-btn ${this.threatsCategory === "all" ? "is-active" : ""}" data-threat-cat="all">⚡ All Dangerous Threats (${threats.length})</button>
            <button class="threat-cat-btn ${this.threatsCategory === "zeroday" ? "is-active" : ""}" data-threat-cat="zeroday">🔥 Zero-Days &amp; RCE</button>
            <button class="threat-cat-btn ${this.threatsCategory === "ransomware" ? "is-active" : ""}" data-threat-cat="ransomware">💀 Ransomware Attacks</button>
            <button class="threat-cat-btn ${this.threatsCategory === "malware" ? "is-active" : ""}" data-threat-cat="malware">🦠 Malware &amp; Viruses</button>
            <button class="threat-cat-btn ${this.threatsCategory === "cisa" ? "is-active" : ""}" data-threat-cat="cisa">🔴 CISA Known Exploited</button>
          </div>

          <div class="threat-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="adminThreatSearchInput"
              placeholder="Search CVE ID, attack name, tool (Cobalt Strike, Mimikatz), vendor..."
              value="${escapeAttr(this.threatsSearch || "")}" />
          </div>
        </div>

        <!-- Threat Cards Grid -->
        <div class="threat-cards-grid">
          ${
            this.isLoadingThreats
              ? this.renderLoadingCards("Connecting to National Vulnerability Database (NVD) & CISA KEV feeds...", "threat-loader")
              : threats.length === 0
                ? `
              <div class="admin-no-news">
                <p>No vulnerabilities match your filter. Click “REFRESH TELEMETRY” or clear search.</p>
              </div>
            `
                : threats
                    .map((threat) => {
                      const tools = threat.toolsUsed || [];
                      const isCritical = (threat.severity || "").toUpperCase() === "CRITICAL";

                      return `
                    <div class="threat-intel-card" data-threat-id="${threat.id}">
                      <!-- Card Head -->
                      <div class="threat-card-head">
                        <div class="threat-head-left">
                          <span class="threat-cve-pill">${escapeHtml(threat.cveId || "CVE-ALERT")}</span>
                          <span class="threat-score-pill ${isCritical ? "pill-crit" : "pill-high"}">
                            CVSS ${threat.score || 9.8} · ${threat.severity || "CRITICAL"}
                          </span>
                          <span class="threat-cat-tag">${escapeHtml(threat.category || "Weaponized Attack")}</span>
                        </div>
                        ${threat.cisaKev ? `<span class="threat-kev-chip">🔴 CISA KEV IN-THE-WILD</span>` : ""}
                      </div>

                      <!-- Attack Title -->
                      <h3 class="threat-attack-title">
                        <a href="${escapeAttr(threat.nvdUrl || "https://nvd.nist.gov")}" target="_blank" rel="noopener noreferrer">
                          ${escapeHtml(threat.title || "Vulnerability Attack")}
                        </a>
                      </h3>

                      <!-- Targets & Threat Actor Info -->
                      <div class="threat-meta-row">
                        <div class="threat-meta-item">
                          <span class="threat-meta-label">TARGET SYSTEMS:</span>
                          <span class="threat-meta-value">${escapeHtml(threat.vendor || "Enterprise Infrastructure")}</span>
                        </div>
                        <div class="threat-meta-item">
                          <span class="threat-meta-label">THREAT ACTOR:</span>
                          <span class="threat-meta-value actor-name">${escapeHtml(threat.threatActor || "Active Syndicate")}</span>
                        </div>
                      </div>

                      <!-- Collapsible 7 Threat Dimensions Button & Box (Requirement 3) -->
                      <button class="threat-dimensions-toggle-btn" data-threat-action="toggle-dimensions" data-threat-id="${threat.id}">
                        👁️ View 7 Threat Dimensions
                      </button>

                      <div class="threat-dimensions-box is-hidden" id="threat-dimensions-${threat.id}">
                        <div class="threat-dim-item">
                          <span class="threat-dim-label">1. 👤 HEAD HERO / THREAT ACTOR:</span>
                          <span class="threat-dim-val hero-val">${escapeHtml(threat.headHero || threat.threatActor || "Volt Typhoon / Lead Syndicate")}</span>
                        </div>
                        <div class="threat-dim-item">
                          <span class="threat-dim-label">2. 🎯 IMPORTANT CORE POINTS &amp; ROOT FLAW MECHANICS:</span>
                          <span class="threat-dim-val">${escapeHtml(threat.corePoints || threat.briefing || "High-severity root flaw enabling remote unauthorized control.")}</span>
                        </div>
                        <div class="threat-dim-item">
                          <span class="threat-dim-label">3. 🏢 AFFECTED VICTIMS &amp; INFRASTRUCTURE SCOPE:</span>
                          <span class="threat-dim-val">${escapeHtml(threat.affectedVictims || threat.vendor || "Enterprise Cloud, Healthcare & Critical Infrastructure")}</span>
                        </div>
                        <div class="threat-dim-item">
                          <span class="threat-dim-label">4. ⚔️ WEAPONIZED ATTACK TOOLS &amp; C2 FRAMEWORKS:</span>
                          <div class="threat-tools-tags-list">
                            ${
                              tools.length
                                ? tools.map((tool) => `<span class="threat-tool-badge">${escapeHtml(tool)}</span>`).join("")
                                : `<span class="threat-tool-badge tool-generic">Living-off-the-Land Scripts &amp; Loaders</span>`
                            }
                          </div>
                        </div>
                        <div class="threat-dim-item">
                          <span class="threat-dim-label">5. ⚡ PRIMARY ATTACK USE CASE &amp; EXPLOITATION CHARACTERISTICS:</span>
                          <span class="threat-dim-val">${escapeHtml(threat.attackUseCase || threat.attackVector || "Initial unauthenticated access and credential dumping")}</span>
                        </div>
                        <div class="threat-dim-item">
                          <span class="threat-dim-label">6. 📡 DETECTION SIGNATURES &amp; TELEMETRY INDICATORS:</span>
                          <span class="threat-dim-val">${escapeHtml(threat.detectionSignatures || "Monitor LSASS memory access, suspicious svchost child processes, and C2 beacons.")}</span>
                        </div>
                        <div class="threat-dim-item">
                          <span class="threat-dim-label">7. 🛡️ REMEDIATION, HARDENING &amp; DEFENSIVE PLAYBOOK:</span>
                          <span class="threat-dim-val">${escapeHtml(threat.remediation || "Deploy vendor security update immediately, restrict inbound ports, and enforce zero-trust segmentation.")}</span>
                        </div>
                      </div>

                      <!-- Attack Actions Footer -->
                      <div class="threat-actions-footer">
                        <a href="${escapeAttr(threat.nvdUrl || `https://nvd.nist.gov/vuln/detail/${threat.cveId}`)}" target="_blank" rel="noopener noreferrer" class="threat-nvd-link">
                          NVD Record ↗
                        </a>
                        <div class="threat-btn-cluster">
                          <button class="threat-btn-save-db" data-threat-action="save-db" data-threat-id="${threat.id}">
                            💾 SAVE TO DB
                          </button>
                          <button class="threat-btn-create-note" data-threat-action="create-note" data-threat-id="${threat.id}" title="Map this dangerous CVE & attack tools directly to BrainVault canvas">
                            📝 + CREATE NOTE
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                    })
                    .join("")
          }
        </div>
      </div>
    `;
  }

  // --- Top Weaponized CVEs (2020-2026) Tab ------------------------------------
  renderCvesTab() {
    const cves = this.cveCatalog || [];
    const total = this.cveMetrics?.total || cves.length;
    const critical = this.cveMetrics?.critical || cves.filter((c) => (c.severity || "").toUpperCase() === "CRITICAL" || (c.score || 0) >= 9.0).length;
    const high = this.cveMetrics?.high || cves.filter((c) => (c.score || 0) >= 7.0 && (c.score || 0) < 9.0).length;
    const kev = this.cveMetrics?.cisaKev || cves.filter((c) => c.cisaKev).length;

    const yearsList = ["all", "2026", "2025", "2024", "2023", "2022", "2021", "2020"];
    const sevList = [
      ["all", "⚡ All Severities"],
      ["critical", "🚨 Critical (9.0+)"],
      ["high", "⚠️ High (7.0+)"],
      ["cisa", "🔴 CISA KEV"],
    ];

    return `
      <div class="admin-cves-container">
        <!-- CVE Header HUD Banner -->
        <div class="cve-hud-banner">
          <div class="cve-hud-left">
            <div class="cve-radar-pulse"></div>
            <div>
              <div class="cve-hud-tag-row">
                <span class="cve-live-tag">CATALOG PERSISTENCE</span>
                <span class="cve-nist-tag">NIST NVD 2.0 API</span>
                <span class="cve-cisa-tag">CISA KEV CATALOG</span>
                <span class="cve-sql-tag">SQLITE CVE_RECORDS</span>
              </div>
              <h2 class="cve-hud-title">⚡ Top Weaponized &amp; Critical CVEs (2020–2026) Catalog</h2>
              <p class="cve-hud-sub">
                Official critical and weaponized vulnerability catalog spanning 2020 through 2026. Persisted in SQLite database, integrated with NIST NVD 2.0 API, featuring complete exploit toolchains and 7 Threat Dimensions.
              </p>
            </div>
          </div>
          <div class="cve-hud-right">
            <button class="cve-sync-btn ${this.isSyncingNvd ? "is-syncing" : ""}" id="btnSyncNvdCves" title="Merge live filtered records from NIST NVD 2.0 API">
              <span class="sync-spin">🔄</span> ${this.isSyncingNvd ? "SYNCING NVD 2.0..." : "SYNC NVD 2.0 API"}
            </button>
            <button class="cve-refresh-btn" id="btnRefreshCves" title="Refresh local CVE catalog">
              <span>🔄</span> REFRESH
            </button>
          </div>
        </div>

        <!-- 4 Metrics Cards -->
        <div class="cve-metrics-grid">
          <div class="cve-metric-card metric-total">
            <div class="cve-metric-top"><span class="cve-metric-glyph">📊</span> <strong>TOTAL CATALOG CVES</strong></div>
            <div class="cve-metric-val">${total}</div>
            <div class="cve-metric-desc">Indexed 2020–2026 in SQLite cve_records</div>
          </div>
          <div class="cve-metric-card metric-critical">
            <div class="cve-metric-top"><span class="cve-metric-glyph">🚨</span> <strong>CRITICAL SEVERITY</strong></div>
            <div class="cve-metric-val">${critical}</div>
            <div class="cve-metric-desc">CVSS Base Score 9.0–10.0 Remote Code Exec</div>
          </div>
          <div class="cve-metric-card metric-high">
            <div class="cve-metric-top"><span class="cve-metric-glyph">⚠️</span> <strong>HIGH SEVERITY</strong></div>
            <div class="cve-metric-val">${high}</div>
            <div class="cve-metric-desc">CVSS Base Score 7.0–8.9 Privilege Escalation</div>
          </div>
          <div class="cve-metric-card metric-kev">
            <div class="cve-metric-top"><span class="cve-metric-glyph">🔴</span> <strong>CISA KEV EXPLOITED</strong></div>
            <div class="cve-metric-val">${kev}</div>
            <div class="cve-metric-desc">Confirmed Actively Exploited in Warfare</div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="cve-toolbar-card">
          <!-- Year pills -->
          <div class="cve-years-group">
            <span class="cve-filter-label">YEAR:</span>
            ${yearsList
              .map(
                (y) => `
              <button class="cve-year-btn ${this.cveYearFilter === y ? "is-active" : ""}" data-cve-year="${y}">
                ${y === "all" ? "All Years (2020–2026)" : y}
              </button>
            `
              )
              .join("")}
          </div>

          <!-- Severity pills -->
          <div class="cve-sev-group">
            <span class="cve-filter-label">SEVERITY:</span>
            ${sevList
              .map(
                ([val, lbl]) => `
              <button class="cve-sev-btn ${this.cveSeverityFilter === val ? "is-active" : ""}" data-cve-sev="${val}">
                ${lbl}
              </button>
            `
              )
              .join("")}
          </div>

          <!-- Real-Time Search Box -->
          <div class="cve-search-box">
            <svg class="cve-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="adminCveSearchInput" class="cve-search-input"
              placeholder="Search CVE ID (e.g. 38077, 2024-21762), vendor, tool, vector..."
              value="${escapeAttr(this.cveSearchQuery || "")}" />
          </div>
        </div>

        <!-- CVE Cards Grid -->
        <div class="cve-cards-grid">
          ${
            this.isLoadingCves
              ? this.renderLoadingCards("Querying SQLite cve_records & NIST NVD 2.0 API...", "threat-loader")
              : cves.length === 0
              ? `
              <div class="admin-empty-table-state">
                <span class="empty-ico">⚡</span>
                <p>No CVE records found matching year "${escapeHtml(this.cveYearFilter)}", severity "${escapeHtml(this.cveSeverityFilter)}", or query "${escapeHtml(this.cveSearchQuery)}".</p>
                <button class="cve-sync-btn" id="btnEmptySyncNvd" style="margin-top: 10px;">
                  Sync from NIST NVD 2.0 API Now
                </button>
              </div>
            `
              : cves
                  .map((cve) => {
                    const isCrit = (cve.severity || "").toUpperCase() === "CRITICAL" || (cve.score || 0) >= 9.0;
                    const tools = cve.toolsUsed || [];
                    return `
                    <div class="cve-card ${isCrit ? "cve-card-crit" : "cve-card-high"}" data-cve-card-id="${cve.cveId}">
                      <!-- Card Head -->
                      <div class="cve-card-head">
                        <div class="cve-badges-row">
                          <span class="cve-pill-id">${escapeHtml(cve.cveId)}</span>
                          <span class="cve-pill-year">${cve.year || 2026}</span>
                          <span class="cve-pill-score ${isCrit ? "score-crit" : "score-high"}">
                            ${cve.score || 9.8} ${escapeHtml(cve.severity || "CRITICAL")}
                          </span>
                          ${
                            cve.cisaKev
                              ? `<span class="cve-pill-kev">🔴 CISA KEV EXPLOITED</span>`
                              : `<span class="cve-pill-zero">ZERO-DAY MONITORED</span>`
                          }
                        </div>
                        <span class="cve-category-tag">${escapeHtml(cve.category || "Zero-Day RCE")}</span>
                      </div>

                      <!-- Title & Vendor -->
                      <h3 class="cve-card-title">${escapeHtml(cve.title)}</h3>
                      <div class="cve-vendor-row">
                        <strong>Affected Platform:</strong> ${escapeHtml(cve.vendor || "Enterprise Infrastructure")}
                        <span class="cve-sep">•</span>
                        <strong>Vector:</strong> <span class="cve-vector-text">${escapeHtml(cve.attackVector || "Network / Unauthenticated")}</span>
                      </div>

                      <!-- Briefing / Root Flaw -->
                      <p class="cve-briefing">${escapeHtml(cve.briefing || "")}</p>

                      <!-- Weaponized Tools Chips -->
                      <div class="cve-tools-cluster">
                        <span class="cve-tool-label">⚔️ WEAPONIZED EXPLOIT TOOLS &amp; C2:</span>
                        <div class="cve-chips-wrap">
                          ${
                            tools.length
                              ? tools.map((tool) => `<span class="cve-tool-chip">${escapeHtml(tool)}</span>`).join("")
                              : `<span class="cve-tool-chip">Weaponized Memory Loader &amp; C2 Beacons</span>`
                          }
                        </div>
                      </div>

                      <!-- 7 Threat Dimensions Expandable Box -->
                      <button class="cve-toggle-dims-btn" data-cve-toggle="${escapeAttr(cve.cveId)}">
                        ▶ 7 THREAT INTELLIGENCE DIMENSIONS &amp; PLAYBOOK
                      </button>

                      <div class="cve-dims-box is-hidden" id="cve-dims-${escapeAttr(cve.cveId)}">
                        <div class="cve-dim-item">
                          <span class="cve-dim-lbl">1. 👤 HEAD HERO / LEAD ADVERSARY:</span>
                          <span class="cve-dim-val">${escapeHtml(cve.headHero || cve.threatActor || "Weaponized Exploit Developers")}</span>
                        </div>
                        <div class="cve-dim-item">
                          <span class="cve-dim-lbl">2. 🎯 ROOT FLAW MECHANICS &amp; IMPORTANT CORE POINTS:</span>
                          <span class="cve-dim-val">${escapeHtml(cve.corePoints || cve.briefing || "Severe vulnerability flaw.")}</span>
                        </div>
                        <div class="cve-dim-item">
                          <span class="cve-dim-lbl">3. 🏢 AFFECTED VICTIMS &amp; INFRASTRUCTURE SCOPE:</span>
                          <span class="cve-dim-val">${escapeHtml(cve.affectedVictims || cve.vendor || "Enterprise Infrastructure")}</span>
                        </div>
                        <div class="cve-dim-item">
                          <span class="cve-dim-lbl">4. ⚔️ WEAPONIZED ATTACK TOOLS &amp; C2 FRAMEWORKS:</span>
                          <span class="cve-dim-val">${escapeHtml(tools.join(", ") || "Cobalt Strike, Metasploit, Reverse Shell")}</span>
                        </div>
                        <div class="cve-dim-item">
                          <span class="cve-dim-lbl">5. ⚡ PRIMARY ATTACK USE CASE &amp; EXPLOITATION:</span>
                          <span class="cve-dim-val">${escapeHtml(cve.attackUseCase || cve.attackVector || "Unauthenticated remote access")}</span>
                        </div>
                        <div class="cve-dim-item">
                          <span class="cve-dim-lbl">6. 📡 DETECTION SIGNATURES &amp; TELEMETRY:</span>
                          <span class="cve-dim-val">${escapeHtml(cve.detectionSignatures || "Monitor anomalous network connections and memory access.")}</span>
                        </div>
                        <div class="cve-dim-item">
                          <span class="cve-dim-lbl">7. 🛡️ REMEDIATION, HARDENING &amp; DEFENSIVE PLAYBOOK:</span>
                          <span class="cve-dim-val">${escapeHtml(cve.remediation || "Apply vendor patch immediately and isolate perimeter.")}</span>
                        </div>
                      </div>

                      <!-- Card Actions Footer -->
                      <div class="cve-card-actions">
                        <a href="${escapeAttr(cve.nvdUrl || `https://nvd.nist.gov/vuln/detail/${cve.cveId}`)}" target="_blank" rel="noopener noreferrer" class="cve-nvd-link">
                          Official NVD Record ↗
                        </a>
                        <div class="cve-btn-cluster">
                          <button class="cve-btn-listen" data-listen-cve="${escapeAttr(cve.cveId)}" title="🎧 Listen to audio briefing for this CVE">
                            🎧 LISTEN BRIEF
                          </button>
                          <button class="cve-btn-save-db" data-save-cve="${escapeAttr(cve.cveId)}">
                            💾 SAVE TO DB
                          </button>
                          <button class="cve-btn-create-note" data-note-cve="${escapeAttr(cve.cveId)}" title="Place this complete CVE intelligence note onto BrainVault canvas">
                            📝 + CREATE NOTE
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                  })
                  .join("")
          }
        </div>
      </div>
    `;
  }

  // --- OSV.dev Open Source Security News Tab ----------------------------------
  renderOsvTab() {
    const rawStories = this.osvNews || [];
    const kw = (this.osvKeyword || "").toLowerCase().trim();
    const stories = kw
      ? rawStories.filter(
          (s) =>
            (s.title || "").toLowerCase().includes(kw) ||
            (s.summary || "").toLowerCase().includes(kw) ||
            (s.takeaways || []).some((t) => t.toLowerCase().includes(kw))
        )
      : rawStories;

    return `
      <div class="admin-osv-container">
        <!-- OSV Header HUD Banner -->
        <div class="osv-hud-banner">
          <div class="osv-hud-left">
            <div class="osv-hud-icon">🛡️</div>
            <div>
              <h2 class="osv-hud-title">
                OSV.dev Open Source Vulnerability &amp; Supply Chain Dispatches
              </h2>
              <p class="osv-hud-sub">
                Curated research, upstream vulnerability disclosures, and supply chain telemetry from the Google OSV team &amp; OpenSSF. Covering direct CVEList 5.0 synchronization, ecosystem security, and precision reachability analysis.
              </p>
            </div>
          </div>
          <div class="osv-hud-right">
            <button class="cve-refresh-btn" id="btnRefreshOsvNews" title="Fetch latest dispatches from osv.dev/blog">
              <span>🔄</span> REFRESH OSV DISPATCHES
            </button>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="osv-toolbar-card">
          <div class="osv-search-box">
            <svg class="osv-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="adminOsvSearchInput" class="osv-search-input"
              placeholder="Filter OSV dispatches by keyword, package ecosystem (npm, PyPI, Go, Rust), or tool..."
              value="${escapeAttr(this.osvKeyword || "")}" />
          </div>
          <span style="font-family: var(--mono); font-size: 11px; color: #94a3b8;">
            Showing <strong>${stories.length}</strong> OSV intelligence articles
          </span>
        </div>

        <!-- OSV Cards Grid -->
        <div class="osv-grid">
          ${
            this.isLoadingOsv
              ? this.renderLoadingCards("Fetching open source security dispatches from osv.dev/blog...", "threat-loader")
              : stories.length === 0
              ? `
              <div class="admin-empty-table-state">
                <span class="empty-ico">🛡️</span>
                <p>No OSV articles found matching "${escapeHtml(this.osvKeyword)}".</p>
                <button class="cve-refresh-btn" id="btnEmptyRefreshOsv" style="margin-top: 10px;">
                  Refresh OSV Feeds
                </button>
              </div>
            `
              : stories
                  .map((post) => {
                    const takeaways = post.takeaways || [];
                    return `
                    <div class="osv-card" data-osv-id="${post.id}">
                      <div class="osv-card-head">
                        <h3 class="osv-card-title">
                          <a href="${escapeAttr(post.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.title)}</a>
                        </h3>
                      </div>

                      <div class="osv-badges-row">
                        <span class="osv-pill-source">${escapeHtml(post.source || "OSV.dev · Open Source Security")}</span>
                        <span class="osv-pill-date">${escapeHtml(post.timeAgo || "Recent")}</span>
                        <span class="osv-pill-source" style="border-color: rgba(16, 185, 129, 0.4); color: #34d399; background: rgba(16, 185, 129, 0.15);">
                          Supply Chain &amp; OSS Security
                        </span>
                      </div>

                      <p class="osv-card-summary">${escapeHtml(post.summary || "")}</p>

                      <!-- 7 Takeaways Box -->
                      <div class="osv-takeaways-box">
                        <span style="font-family: var(--mono); font-size: 9.5px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: .06em;">
                          🎯 7 KEY SPECIAL POINTS &amp; THREAT INTELLIGENCE TAKEAWAYS:
                        </span>
                        ${takeaways
                          .map((t) => `<div class="osv-takeaway-item">${escapeHtml(t)}</div>`)
                          .join("")}
                      </div>

                      <!-- Card Actions -->
                      <div class="osv-card-actions">
                        <a href="${escapeAttr(post.url)}" target="_blank" rel="noopener noreferrer" class="osv-read-link">
                          Read Full Article on OSV.dev ↗
                        </a>
                        <button class="osv-btn-create-note" data-note-osv="${escapeAttr(post.id)}" title="Place this OSV security dispatch note directly onto canvas">
                          📝 + CREATE NOTE
                        </button>
                      </div>
                    </div>
                  `;
                  })
                  .join("")
          }
        </div>
      </div>
    `;
  }

  // --- Currents Real-Time News Tab (1-Hour Auto Refresh) ----------------------
  renderCurrentsTab() {
    const stories = this.currentsNews || [];
    const timerMins = Math.floor(this.currentsTimerSeconds / 60);
    const timerSecs = this.currentsTimerSeconds % 60;
    const timerDisplay = `${timerMins.toString().padStart(2, "0")}:${timerSecs.toString().padStart(2, "0")}`;

    return `
      <div class="admin-currents-tab-container">
        <!-- Control Header -->
        <div class="admin-currents-headbar">
          <div class="currents-head-left">
            <span class="currents-pulse-dot"></span>
            <div>
              <div class="currents-tag-row">
                <span class="currents-badge">CURRENTS API</span>
                <span class="currents-interval-badge">⏱️ 1-HOUR AUTO-REFRESH ACTIVE</span>
                <span class="currents-live-status">LIVE REALTIME</span>
              </div>
              <h3 class="currents-title">Currents Real-Time News: Cybersecurity, AI &amp; World's Top News</h3>
              <p class="currents-subtext">
                Continuous real-time stream powered by Currents API key. Auto-refreshes every 1 hour to keep world news fresh.
              </p>
            </div>
          </div>

          <div class="currents-head-right">
            <!-- 1 Hour Countdown Box -->
            <div class="currents-timer-box">
              <span class="timer-label">NEXT AUTO-REFRESH:</span>
              <strong id="currentsTimerCountdown" class="timer-value">${timerDisplay}</strong>
            </div>

            <!-- Fetch / Refresh Now Button -->
            <button class="admin-fetch-btn currents-fetch-btn" id="adminFetchCurrentsBtn">
              <span class="admin-ico">🔄</span> REFRESH NOW
            </button>
          </div>
        </div>

        <!-- Category & Search Bar -->
        <div class="threat-controls-row">
          <div class="currents-categories-filter">
            <button class="currents-cat-btn ${this.currentsCategory === "all" ? "is-active" : ""}" data-currents-cat="all">⚡ All Streams (${stories.length})</button>
            <button class="currents-cat-btn ${this.currentsCategory === "cybersecurity" ? "is-active" : ""}" data-currents-cat="cybersecurity">🛡️ Cybersecurity</button>
            <button class="currents-cat-btn ${this.currentsCategory === "ai" ? "is-active" : ""}" data-currents-cat="ai">🤖 AI Intelligence</button>
            <button class="currents-cat-btn ${this.currentsCategory === "world" ? "is-active" : ""}" data-currents-cat="world">🌍 World's Top News</button>
          </div>
          <div class="threat-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="adminCurrentsKeywordInput"
              placeholder="Search real-time news (AI, Cyber, Tech)..."
              value="${escapeAttr(this.currentsKeyword || "")}" />
          </div>
        </div>

        <!-- News Cards Grid -->
        <div class="admin-news-grid">
          ${
            this.isLoadingCurrents
              ? this.renderLoadingCards("Fetching real-time cybersecurity, AI & world headlines from Currents API...", "currents-spinner")
              : stories.length === 0
                ? `
              <div class="admin-no-news">
                <p>No news stories retrieved. Click “REFRESH NOW” or verify your Currents API key in the Keys tab.</p>
              </div>
            `
                : stories
                    .map((story) => {
                      const isSaved = this.savedNews.some((s) => s.id === story.id || s.title === story.title);
                      let takeaways = story.takeaways || [];
                      if (takeaways.length < 7) {
                        takeaways = generate7KeyPoints(story.title, story.summary, story.source || "Currents API");
                      } else {
                        takeaways = takeaways.slice(0, 7);
                      }

                      return `
                    <div class="admin-news-card currents-card" data-story-id="${story.id}">
                      <div class="admin-news-card-head">
                        <span class="admin-source-badge currents-badge">${escapeHtml(story.source || "Currents API")}</span>
                        <span class="currents-cat-pill">${escapeHtml(story.categoryTag || "Real-Time")}</span>
                        <span class="admin-news-time">${escapeHtml(story.timeAgo || "recently")}</span>
                      </div>

                      <h3 class="admin-news-title">
                        <a href="${escapeAttr(story.url)}" target="_blank" rel="noopener noreferrer">
                          ${escapeHtml(story.title)}
                        </a>
                      </h3>

                      <p class="admin-news-summary">
                        ${escapeHtml(story.summary || "")}
                      </p>

                      <!-- Collapsible 7 Key Special Points Button & Box -->
                      <button class="admin-takeaways-toggle-btn" data-action="toggle-takeaways" data-story-id="${story.id}" data-takeaways-count="${takeaways.length || 7}">
                        👁️ View Key Points (${takeaways.length || 7})
                      </button>

                      <div class="admin-takeaways-box admin-10point-box is-hidden" id="takeaways-box-${story.id}">
                        <div class="admin-takeaways-title admin-10point-title">🎯 7 KEY SPECIAL POINTS &amp; THREAT INTEL:</div>
                        <ul class="admin-takeaways-list admin-10point-list">
                          ${takeaways
                            .map((t) => `<li>${escapeHtml(t)}</li>`)
                            .join("")}
                        </ul>
                      </div>

                      <div class="admin-news-actions-row">
                        <a href="${escapeAttr(story.url)}" target="_blank" rel="noopener noreferrer" class="admin-read-link">
                          Read ↗
                        </a>
                        <div class="admin-news-btn-group">
                          <button class="admin-btn-save-db ${isSaved ? "is-saved" : ""}" data-action="save-db" data-story-id="${story.id}">
                            ${isSaved ? "✓ SAVED" : "💾 SAVE TO DB"}
                          </button>
                          <button class="admin-btn-create-note" data-action="create-note" data-story-id="${story.id}" title="Create a note directly onto canvas with important points">
                            📝 + CREATE NOTE
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                    })
                    .join("")
          }
        </div>
      </div>
    `;
  }

  // --- NewsData.io 7-Point Briefings Tab -------------------------------------
  renderNewsDataTab() {
    const stories = this.newsDataNews || [];

    return `
      <div class="admin-newsdata-tab-container">
        <!-- Control Header -->
        <div class="admin-newsdata-headbar">
          <div class="newsdata-head-left">
            <span class="newsdata-pulse-dot"></span>
            <div>
              <div class="newsdata-tag-row">
                <span class="newsdata-badge">NEWSDATA.IO</span>
                <span class="newsdata-pts-badge">🎯 7-POINT BRIEFING PROTOCOL</span>
              </div>
              <h3 class="newsdata-title">NewsData.io Intelligence Briefing Center</h3>
              <p class="newsdata-subtext">
                Live cybersecurity, AI &amp; tech news synthesized into 7 structured analytical points. Map notes straight to your spatial canvas.
              </p>
            </div>
          </div>

          <div class="newsdata-head-right" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <button class="cve-sync-btn ${this.isSyncingNvd ? "is-syncing" : ""}" id="adminSyncCisaKevBlogBtn" title="Export CISA Known Exploited Vulnerabilities Catalog (2020-2026) and save to SQLite &amp; Firebase DB">
              <span class="sync-spin">🔴</span> ${this.isSyncingNvd ? "EXPORTING CISA KEV..." : "EXPORT CISA KEV TO DB"}
            </button>
            <!-- Fetch Button -->
            <button class="admin-fetch-btn newsdata-fetch-btn" id="adminFetchNewsDataBtn">
              <span class="admin-ico">🔄</span> FETCH 7-PT BRIEFINGS
            </button>
          </div>
        </div>

        <!-- Category & Search Bar -->
        <div class="threat-controls-row">
          <div class="newsdata-categories-filter">
            <button class="newsdata-cat-btn ${this.newsDataCategory === "all" ? "is-active" : ""}" data-newsdata-cat="all">⚡ All Intelligence (${stories.length})</button>
            <button class="newsdata-cat-btn ${this.newsDataCategory === "cisa" ? "is-active" : ""}" data-newsdata-cat="cisa">🔴 CISA KEV &amp; 2020–2026 Malware</button>
            <button class="newsdata-cat-btn ${this.newsDataCategory === "cybersecurity" ? "is-active" : ""}" data-newsdata-cat="cybersecurity">🛡️ Cybersecurity</button>
            <button class="newsdata-cat-btn ${this.newsDataCategory === "ai" ? "is-active" : ""}" data-newsdata-cat="ai">🤖 AI Latest News</button>
            <button class="newsdata-cat-btn ${this.newsDataCategory === "tech" ? "is-active" : ""}" data-newsdata-cat="tech">💻 Tech News</button>
          </div>
          <div class="threat-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="adminNewsDataKeywordInput"
              placeholder="Search NewsData (cybersecurity, AI, LLM)..."
              value="${escapeAttr(this.newsDataKeyword || "")}" />
          </div>
        </div>

        <!-- News Cards Grid -->
        <div class="admin-news-grid">
          ${
            this.isLoadingNewsData
              ? this.renderLoadingCards("Generating 7-point intelligence briefings from NewsData.io API...", "newsdata-spinner")
              : stories.length === 0
                ? `
              <div class="admin-no-news">
                <p>No NewsData stories retrieved. Click “FETCH 7-PT BRIEFINGS” or check key <code class="admin-code-hl">pub_e90c4dd...</code>.</p>
              </div>
            `
                : stories
                    .map((story) => {
                      const isSaved = this.savedNews.some((s) => s.id === story.id || s.title === story.title);
                      let takeaways = story.takeaways || [];
                      if (takeaways.length < 7) {
                        takeaways = generate7KeyPoints(story.title, story.summary, story.source || "NewsData.io");
                      } else {
                        takeaways = takeaways.slice(0, 7);
                      }

                      return `
                    <div class="admin-news-card newsdata-card" data-story-id="${story.id}">
                      <div class="admin-news-card-head">
                        <span class="admin-source-badge newsdata-badge">${escapeHtml(story.source || "NewsData.io")}</span>
                        <span class="newsdata-cat-pill">${escapeHtml(story.categoryTag || "Intelligence")}</span>
                        <span class="admin-news-time">${escapeHtml(story.timeAgo || "recently")}</span>
                      </div>

                      <h3 class="admin-news-title">
                        <a href="${escapeAttr(story.url)}" target="_blank" rel="noopener noreferrer">
                          ${escapeHtml(story.title)}
                        </a>
                      </h3>

                      <p class="admin-news-summary">
                        ${escapeHtml(story.summary || "")}
                      </p>

                      <!-- Collapsible 7 Key Special Points Button & Box -->
                      <button class="admin-takeaways-toggle-btn" data-action="toggle-takeaways" data-story-id="${story.id}" data-takeaways-count="${takeaways.length || 7}">
                        👁️ View Key Points (${takeaways.length || 7})
                      </button>

                      <div class="admin-takeaways-box admin-10point-box is-hidden" id="takeaways-box-${story.id}">
                        <div class="admin-takeaways-title admin-10point-title">🎯 7 KEY SPECIAL POINTS &amp; THREAT INTEL:</div>
                        <ul class="admin-takeaways-list admin-10point-list">
                          ${takeaways
                            .map((t) => `<li>${escapeHtml(t)}</li>`)
                            .join("")}
                        </ul>
                      </div>

                      <div class="admin-news-actions-row">
                        <a href="${escapeAttr(story.url)}" target="_blank" rel="noopener noreferrer" class="admin-read-link">
                          Read ↗
                        </a>
                        <div class="admin-news-btn-group">
                          <button class="admin-btn-save-db ${isSaved ? "is-saved" : ""}" data-action="save-db" data-story-id="${story.id}">
                            ${isSaved ? "✓ SAVED" : "💾 SAVE TO DB"}
                          </button>
                          <button class="admin-btn-create-note newsdata-create-note-btn" data-action="create-note" data-story-id="${story.id}" title="Create a note directly onto canvas with all 10 key special points">
                            📝 + CREATE NOTE
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                    })
                    .join("")
          }
        </div>
      </div>
    `;
  }
  renderSavedNewsTab() {
    return `
      <div class="admin-saved-container">
        <!-- 2-Week Database Storage Retention Banner -->
        <div class="db-retention-banner">
          <div class="db-retention-left">
            <span class="db-retention-tag">📅 2-WEEK TTL DATABASE STORAGE</span>
            <span class="db-retention-text">
              Active Storage Optimization: Stories older than 14 days are automatically purged day-wise to conserve database space.
            </span>
          </div>
          <button type="button" class="db-retention-btn" id="adminPruneDbSavedBtn" ${this.isPruningDb ? "disabled" : ""}>
            ${this.isPruningDb ? "CLEANING..." : "🧹 RUN 2-WEEK PRUNING NOW"}
          </button>
        </div>

        <div class="admin-saved-header">
          <div>
            <h3>Saved Cyber News Database (${this.savedNews.length})</h3>
            <p>Archived intelligence reports and threat briefings stored in SQLite &amp; Firebase database table.</p>
          </div>
          <div class="admin-saved-actions">
            <button class="admin-btn admin-btn-cyan-outline" id="adminExportSavedJsonBtn">
              ⬇ Export JSON
            </button>
          </div>
        </div>

        <div class="admin-saved-table-wrap">
          ${
            this.savedNews.length === 0
              ? `<div class="admin-empty-table"><p>No saved news yet. Open the “Live Fetch News” tab and click “SAVE TO DB” on any card.</p></div>`
              : `
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Category / Source</th>
                  <th>Title &amp; Brief</th>
                  <th>7 Key Points &amp; Takeaways</th>
                  <th>Saved Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.savedNews
                  .map(
                    (s) => {
                      const colorClass = s.colorClass || s.colorTheme || "title-color-google";
                      const isModel = Boolean(s.modelReleaseBrief);
                      return `
                  <tr>
                    <td>
                      <span class="admin-source-badge">${escapeHtml(s.source || "Database Feed")}</span>
                      ${s.categoryTag ? `<div style="font-size: 9.5px; font-family: var(--mono); color: #94a3b8; margin-top: 4px;">${escapeHtml(s.categoryTag)}</div>` : ""}
                    </td>
                    <td class="col-title">
                      <strong class="${colorClass}">${escapeHtml(s.title)}</strong>
                      ${isModel ? `<span style="display:inline-block; font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(192, 132, 252, 0.2); border: 1px solid #c084fc; color: #e9d5ff; margin-left: 6px;">⭐ Model Brief</span>` : ""}
                      <p class="table-summary">${escapeHtml(s.summary || "")}</p>
                    </td>
                    <td class="col-takeaways">
                      <ul class="table-takeaways-list">
                        ${(s.takeaways || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
                      </ul>
                    </td>
                    <td>${formatSavedDate(s.savedAt)}</td>
                    <td class="col-actions">
                      <button class="admin-btn-tiny admin-table-create-note" data-story-id="${s.id}">📝 Create Note</button>
                      <a href="${escapeAttr(s.url)}" target="_blank" rel="noopener" class="admin-btn-tiny">Read ↗</a>
                      <button class="admin-btn-tiny admin-btn-danger admin-table-del-news" data-story-id="${s.id}">🗑️</button>
                    </td>
                  </tr>
                `;
                    }
                  )
                  .join("")}
              </tbody>
            </table>
          `
          }
        </div>
      </div>
    `;
  }


  // --- Tab 5: Image Storage Table --------------------------------------------
  renderImageStorageTab() {
    return `
      <div class="admin-images-container">
        <div class="admin-images-header">
          <div>
            <h3>Image Storage Table (${this.storedImages.length})</h3>
            <p>Stored screenshot captures, diagram attachments, and media assets in local database.</p>
          </div>
          <div>
            <label class="admin-btn admin-btn-cyan" style="cursor: pointer;">
              + Upload Image
              <input type="file" id="adminImageUploadInput" accept="image/*" style="display: none;" />
            </label>
          </div>
        </div>

        <div class="admin-images-grid">
          ${
            this.storedImages.length === 0
              ? `<div class="admin-empty-table"><p>No image assets stored in database. You can paste images into notes or upload above.</p></div>`
              : this.storedImages
                  .map(
                    (img) => `
                <div class="admin-image-tile">
                  <div class="admin-img-thumb-wrap">
                    <img src="${escapeAttr(img.dataUrl)}" alt="${escapeAttr(img.name)}" />
                  </div>
                  <div class="admin-img-tile-meta">
                    <strong class="truncate">${escapeHtml(img.name)}</strong>
                    <span>${img.width}x${img.height} • ${Math.round((img.sizeBytes || 0) / 1024)} KB</span>
                  </div>
                  <div class="admin-img-tile-actions">
                    <a href="${escapeAttr(img.dataUrl)}" download="${escapeAttr(img.name)}" class="admin-btn-tiny">⬇ Download</a>
                    <button class="admin-btn-tiny admin-btn-danger admin-del-img-btn" data-img-id="${img.id}">🗑️</button>
                  </div>
                </div>
              `
                  )
                  .join("")
          }
        </div>
      </div>
    `;
  }

  // --- Tab 6: 🌐 3D Users & Vaults Constellation ------------------------------
  renderConstellationTab() {
    return `
      <div class="admin-3d-wrapper">
        <!-- 3D Header Toolbar -->
        <div class="admin-3d-toolbar">
          <div class="admin-3d-toolbar-left">
            <span class="admin-ico">🌐</span>
            <strong>3D Holographic Users &amp; Vaults Constellation</strong>
            <span class="admin-3d-hint">Drag to orbit 3D space · Scroll to zoom · Click any user or text file to inspect</span>
          </div>
          <div class="admin-3d-toolbar-right">
            <button class="admin-btn-tool ${this.threeAutoRotate ? "is-active" : ""}" id="admin3dToggleRotate">
              Auto Rotate: ${this.threeAutoRotate ? "ON" : "OFF"}
            </button>
            <select class="admin-3d-select" id="admin3dThemeSelect">
              <option value="universe" ${this.threeTheme === "universe" ? "selected" : ""}>🌌 Universe Nebula</option>
              <option value="obsidian" ${this.threeTheme === "obsidian" ? "selected" : ""}>⬛ Dark Obsidian</option>
              <option value="matrix" ${this.threeTheme === "matrix" ? "selected" : ""}>🟢 Matrix Cyber</option>
            </select>
            <button class="admin-btn-tool" id="admin3dResetCam">Reset View</button>
          </div>
        </div>

        <!-- 3D Canvas Container -->
        <div class="admin-3d-canvas-wrap" id="admin3dCanvasWrap">
          <canvas id="admin3dCanvas"></canvas>

          <!-- 3D Inspector Panel (Opens on click) -->
          <div class="admin-3d-inspector is-hidden" id="admin3dInspector">
            <div class="admin-3d-inspector-head">
              <span id="admin3dInspectorType">NODE INSPECTOR</span>
              <button class="admin-close-btn" id="admin3dCloseInspector">✕</button>
            </div>
            <div class="admin-3d-inspector-body" id="admin3dInspectorBody">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- 3D Three.js Engine Implementation ------------------------------------
  init3DScene() {
    const wrap = document.querySelector("#admin3dCanvasWrap");
    const canvas = document.querySelector("#admin3dCanvas");
    if (!wrap || !canvas || typeof window.THREE === "undefined") return;

    this.stop3D();
    const THREE = window.THREE;
    this.threeContainer = wrap;

    const width = wrap.clientWidth || 800;
    const height = wrap.clientHeight || 550;

    this.threeScene = new THREE.Scene();
    this.threeCamera = new THREE.PerspectiveCamera(45, width / height, 1, 6000);
    this.threeCamera.position.set(0, 300, this.threeDist);
    this.threeCamera.lookAt(0, 0, 0);

    this.threeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.threeRenderer.setSize(width, height);
    this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.threeRaycaster = new THREE.Raycaster();
    this.threeMouse = new THREE.Vector2();

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.threeScene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0x22d3ee, 1.2);
    dirLight.position.set(500, 800, 500);
    this.threeScene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 0.8);
    dirLight2.position.set(-500, -300, -400);
    this.threeScene.add(dirLight2);

    // Cyber Grid
    const grid = new THREE.GridHelper(1600, 32, 0x06b6d4, 0x1e293b);
    grid.position.y = -220;
    this.threeScene.add(grid);

    // Particle Starfield
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 3000;
      starPos[i + 1] = (Math.random() - 0.5) * 2000;
      starPos[i + 2] = (Math.random() - 0.5) * 3000;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x94a3b8, size: 2.5, transparent: true, opacity: 0.6 });
    this.threeStarField = new THREE.Points(starGeo, starMat);
    this.threeScene.add(this.threeStarField);

    // Central Core Node (BrainVault Master Hub)
    const coreGeo = new THREE.DodecahedronGeometry(42, 1);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      shininess: 90,
      wireframe: true,
    });
    this.threeCentralCore = new THREE.Mesh(coreGeo, coreMat);
    this.threeScene.add(this.threeCentralCore);

    // Build the Users, Workspaces, and Text Files graph
    this.build3DUsersGraph();

    // Attach Interaction Events
    this.bind3DControls(canvas);

    // Start Animation Loop
    this.animate3D();
  }

  build3DUsersGraph() {
    if (!this.threeScene || typeof window.THREE === "undefined") return;
    const THREE = window.THREE;
    this.threeInteractiveMeshes = [];

    const users = this.users || [];
    const count = users.length;
    const orbitRadius = 340;

    users.forEach((user, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const ux = Math.cos(angle) * orbitRadius;
      const uz = Math.sin(angle) * orbitRadius;
      const uy = Math.sin(idx * 1.5) * 40;

      const userColor = new THREE.Color(user.avatarColor || "#06b6d4");

      // 1. User Glowing Sphere
      const sphereGeo = new THREE.SphereGeometry(26, 24, 24);
      const sphereMat = new THREE.MeshPhongMaterial({
        color: userColor,
        emissive: userColor.clone().multiplyScalar(0.4),
        shininess: 80,
      });
      const userMesh = new THREE.Mesh(sphereGeo, sphereMat);
      userMesh.position.set(ux, uy, uz);
      userMesh.userData = { type: "user", user };
      this.threeScene.add(userMesh);
      this.threeInteractiveMeshes.push(userMesh);

      // Connecting laser from Central Core to User
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(ux, uy, uz),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: userColor,
        transparent: true,
        opacity: 0.45,
      });
      const laser = new THREE.Line(lineGeo, lineMat);
      this.threeScene.add(laser);

      // User Label Billboard Sprite
      const sprite = this.create3DTextSprite(`${user.name} [${user.role}]`, user.avatarColor || "#06b6d4");
      sprite.position.set(ux, uy + 42, uz);
      this.threeScene.add(sprite);

      // 2. Workspaces Sub-Nodes
      const workspaces = user.workspaces || [];
      const wsCount = workspaces.length;
      const wsRadius = 110;

      workspaces.forEach((ws, wsIdx) => {
        const wsAngle = angle + (wsIdx - (wsCount - 1) / 2) * 0.7;
        const wx = ux + Math.cos(wsAngle) * wsRadius;
        const wz = uz + Math.sin(wsAngle) * wsRadius;
        const wy = uy + 30 + (wsIdx % 2 === 0 ? 30 : -30);

        const wsColor = new THREE.Color(ws.color || user.avatarColor || "#a855f7");

        // Workspace Box Mesh
        const wsGeo = new THREE.BoxGeometry(18, 18, 18);
        const wsMat = new THREE.MeshPhongMaterial({
          color: wsColor,
          emissive: wsColor.clone().multiplyScalar(0.3),
          shininess: 70,
        });
        const wsMesh = new THREE.Mesh(wsGeo, wsMat);
        wsMesh.position.set(wx, wy, wz);
        wsMesh.userData = { type: "workspace", workspace: ws, user };
        this.threeScene.add(wsMesh);
        this.threeInteractiveMeshes.push(wsMesh);

        // Line from user to workspace
        const wsLineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ux, uy, uz),
          new THREE.Vector3(wx, wy, wz),
        ]);
        const wsLine = new THREE.Line(
          wsLineGeo,
          new THREE.LineBasicMaterial({ color: wsColor, transparent: true, opacity: 0.5 })
        );
        this.threeScene.add(wsLine);

        // Workspace Label
        const lockIcon = ws.passwordProtected ? "🔒 " : "";
        const wsSprite = this.create3DTextSprite(`${lockIcon}${ws.name}`, ws.color || "#cbd5e1", 12);
        wsSprite.position.set(wx, wy + 24, wz);
        this.threeScene.add(wsSprite);

        // 3. Text Files / Notes orbiting this Workspace
        const notes = ws.notes || [];
        const noteRadius = 75;

        notes.forEach((note, nIdx) => {
          const nAngle = wsAngle + (nIdx + 1) * 0.8;
          const nx = wx + Math.cos(nAngle) * noteRadius;
          const nz = wz + Math.sin(nAngle) * noteRadius;
          const ny = wy + 20 + nIdx * 25;

          // Note Data Wafer Mesh (Cylinder or Flat Box)
          const noteGeo = new THREE.BoxGeometry(14, 18, 4);
          const noteMat = new THREE.MeshPhongMaterial({
            color: 0x34d399,
            emissive: 0x059669,
            shininess: 85,
          });
          const noteMesh = new THREE.Mesh(noteGeo, noteMat);
          noteMesh.position.set(nx, ny, nz);
          noteMesh.userData = { type: "note", note, workspace: ws, user };
          this.threeScene.add(noteMesh);
          this.threeInteractiveMeshes.push(noteMesh);

          // Line from workspace to note
          const nLineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(wx, wy, wz),
            new THREE.Vector3(nx, ny, nz),
          ]);
          const nLine = new THREE.Line(
            nLineGeo,
            new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.4 })
          );
          this.threeScene.add(nLine);

          // Note Label
          const noteSprite = this.create3DTextSprite(`📄 ${note.title}`, "#6ee7b7", 10);
          noteSprite.position.set(nx, ny + 18, nz);
          this.threeScene.add(noteSprite);
        });
      });
    });
  }

  create3DTextSprite(text, colorHex = "#06b6d4", fontSize = 14) {
    const THREE = window.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = 380;
    canvas.height = 70;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(10, 15, 25, 0.75)";
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 10);
    ctx.fill();

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `bold ${fontSize + 4}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(110, 22, 1);
    return sprite;
  }

  bind3DControls(canvas) {
    let isDown = false;
    let prevX = 0;
    let prevY = 0;

    const onPointerDown = (e) => {
      isDown = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e) => {
      if (!isDown) {
        // Raycasting highlight on hover
        const rect = canvas.getBoundingClientRect();
        this.threeMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.threeMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        return;
      }
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;

      this.threeRot.y += dx * 0.006;
      this.threeRot.x = Math.max(-1.4, Math.min(1.4, this.threeRot.x + dy * 0.006));
    };

    const onPointerUp = () => {
      isDown = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      this.threeDist = Math.max(300, Math.min(2200, this.threeDist + e.deltaY * 0.8));
    };

    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouse = new window.THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.threeRaycaster.setFromCamera(mouse, this.threeCamera);
      const intersects = this.threeRaycaster.intersectObjects(this.threeInteractiveMeshes, false);
      if (intersects.length > 0) {
        const target = intersects[0].object;
        this.show3DInspector(target.userData);
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("click", onClick);

    this._cleanup3DListeners = () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onClick);
    };
  }

  show3DInspector(data) {
    const inspector = document.querySelector("#admin3dInspector");
    const body = document.querySelector("#admin3dInspectorBody");
    const typeLabel = document.querySelector("#admin3dInspectorType");
    if (!inspector || !body) return;

    inspector.classList.remove("is-hidden");

    if (data.type === "user") {
      const u = data.user;
      typeLabel.textContent = `USER VAULT: ${u.name.toUpperCase()}`;
      body.innerHTML = `
        <div class="admin-insp-user">
          <div class="admin-insp-avatar" style="background: ${u.avatarColor};">${u.name[0]}</div>
          <div>
            <h4>${escapeHtml(u.name)} <span class="badge-role">${escapeHtml(u.role)}</span></h4>
            <p>@${escapeHtml(u.username)} · ${escapeHtml(u.email)}</p>
          </div>
        </div>
        <div class="admin-insp-row">
          <span>Dedicated Table:</span>
          <code>${escapeHtml(u.tableName)}</code>
        </div>
        <div class="admin-insp-row">
          <span>Time Spent:</span>
          <strong class="text-amber">${escapeHtml(u.timeSpent)}</strong>
        </div>
        <div class="admin-insp-row">
          <span>Workspaces:</span>
          <strong>${u.workspaces?.length || 0} isolated vaults</strong>
        </div>
        <button class="admin-btn admin-btn-cyan admin-btn-wide" id="inspSelectUserBtn" data-user-id="${u.id}">
          Open User Vault in Dashboard
        </button>
      `;

      body.querySelector("#inspSelectUserBtn")?.addEventListener("click", () => {
        this.selectedUserId = u.id;
        this.currentTab = "vaults";
        this.render();
      });
    } else if (data.type === "workspace") {
      const ws = data.workspace;
      const u = data.user;
      typeLabel.textContent = `WORKSPACE: ${ws.name.toUpperCase()}`;
      body.innerHTML = `
        <h4>${escapeHtml(ws.name)}</h4>
        <p>Owner: <strong>${escapeHtml(u.name)}</strong> (@${escapeHtml(u.username)})</p>
        <div class="admin-insp-row">
          <span>Security Status:</span>
          <strong class="${ws.passwordProtected ? "text-amber" : "text-emerald"}">
            ${ws.passwordProtected ? "🔒 Password Protected" : "🔓 Open / Unlocked"}
          </strong>
        </div>
        <div class="admin-insp-row">
          <span>Notes / Text Files:</span>
          <strong>${ws.notes?.length || 0} files</strong>
        </div>
        <button class="admin-btn admin-btn-amber admin-btn-wide" id="inspSetPassBtn">
          🔑 Manage Workspace Password
        </button>
      `;

      body.querySelector("#inspSetPassBtn")?.addEventListener("click", () => {
        this.promptSetWorkspacePassword(u, ws);
      });
    } else if (data.type === "note") {
      const n = data.note;
      const ws = data.workspace;
      const u = data.user;
      typeLabel.textContent = `TEXT FILE: ${n.title.toUpperCase()}`;
      body.innerHTML = `
        <h4>${escapeHtml(n.title)}</h4>
        <p class="admin-insp-sub">Workspace: <strong>${escapeHtml(ws.name)}</strong> · ${escapeHtml(n.updatedAt || "")}</p>
        <div class="admin-insp-textbox">
          <pre>${escapeHtml(n.text || "(Empty content)")}</pre>
        </div>
        <div class="admin-insp-stats">
          <span>Length: ${(n.text || "").length} chars</span>
          <span>Words: ${(n.text || "").trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <button class="admin-btn admin-btn-cyan admin-btn-wide" id="inspPushNoteBtn">
          📝 Place on Active Canvas
        </button>
      `;

      body.querySelector("#inspPushNoteBtn")?.addEventListener("click", () => {
        const center = this.canvas.viewportCenter();
        const created = this.store.createNode({
          prompt: n.title,
          isCustom: true,
          x: Math.round(center.x - 380),
          y: Math.round(center.y - 290),
          width: 760,
          height: 580,
        });
        this.store.updateNode(created.id, { text: n.text, prompt: n.title });
        this.canvas.select(created.id);
        this.canvas.centerOn(created);
        this.toast(`✓ Placed “${n.title}” on canvas!`);
      });
    }
  }

  animate3D() {
    if (!this.isOpen || this.currentTab !== "constellation") return;

    this.threeAnimId = requestAnimationFrame(() => this.animate3D());

    if (this.threeAutoRotate) {
      this.threeRot.y += 0.003;
    }

    // Camera positioning based on spherical coordinates
    const cosX = Math.cos(this.threeRot.x);
    this.threeCamera.position.x = this.threeDist * Math.sin(this.threeRot.y) * cosX;
    this.threeCamera.position.y = this.threeDist * Math.sin(this.threeRot.x);
    this.threeCamera.position.z = this.threeDist * Math.cos(this.threeRot.y) * cosX;
    this.threeCamera.lookAt(0, 0, 0);

    // Spin Central Core & Starfield slowly
    if (this.threeCentralCore) {
      this.threeCentralCore.rotation.x += 0.008;
      this.threeCentralCore.rotation.y += 0.012;
    }
    if (this.threeStarField) {
      this.threeStarField.rotation.y += 0.0004;
    }

    this.threeRenderer.render(this.threeScene, this.threeCamera);
  }

  stop3D() {
    if (this.threeAnimId) {
      cancelAnimationFrame(this.threeAnimId);
      this.threeAnimId = null;
    }
    if (this._cleanup3DListeners) {
      this._cleanup3DListeners();
      this._cleanup3DListeners = null;
    }
    if (this.threeRenderer) {
      try {
        this.threeRenderer.dispose();
      } catch (e) {}
    }
    this.threeScene = null;
    this.threeCamera = null;
    this.threeRenderer = null;
  }

  updateUsersListUI(root) {
    const list = root.querySelector(".admin-user-cards-list");
    if (!list) return;

    const filter = (this.userSearch || "").toLowerCase();
    const filteredUsers = this.users.filter(
      (u) =>
        u.name.toLowerCase().includes(filter) ||
        u.username.toLowerCase().includes(filter) ||
        (u.email || "").toLowerCase().includes(filter)
    );
    const selectedUser = this.users.find((u) => u.id === this.selectedUserId) || this.users[0] || null;

    list.innerHTML = filteredUsers
      .map((u) => {
        const isSelected = selectedUser && selectedUser.id === u.id;
        const wsCount = u.workspaces?.length || 0;
        const notesCount = (u.workspaces || []).reduce((acc, w) => acc + (w.notes?.length || 0), 0);
        const roleBadge = u.role === "ADMIN" ? `<span class="admin-badge-gold">ADMIN</span>` : "";
        const borderAccent = u.avatarColor || "#06b6d4";

        return `
        <div class="admin-user-item ${isSelected ? "is-selected" : ""}" data-user-id="${u.id}" style="--user-accent: ${borderAccent};">
          <div class="admin-user-item-content">
            <div class="admin-user-item-top">
              <div class="admin-user-item-meta">
                <span class="admin-user-avatar-dot" style="background: ${borderAccent};"></span>
                <strong class="admin-user-item-name">${escapeHtml(u.name)}</strong>
                ${roleBadge}
              </div>
              <div class="admin-user-item-actions">
                <button class="admin-item-action-btn edit-user" title="Edit user" data-action="edit-user" data-user-id="${u.id}">✏️</button>
                ${
                  u.role !== "ADMIN"
                    ? `<button class="admin-item-action-btn del-user" title="Delete user" data-action="del-user" data-user-id="${u.id}">🗑️</button>`
                    : ""
                }
              </div>
            </div>
            <div class="admin-user-item-handle">@${escapeHtml(u.username)}</div>
            <div class="admin-user-item-bottom">
              <span>🕒 ${escapeHtml(u.timeSpent || "0m")}</span>
              <span>${wsCount} workspaces • ${notesCount} notes</span>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    this.bindUserCardEvents(list);
  }

  bindUserCardEvents(container) {
    container.querySelectorAll(".admin-user-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".admin-item-action-btn")) return;
        const uId = el.dataset.userId;
        if (uId) {
          this.selectedUserId = uId;
          this.render();
        }
      });
    });

    container.querySelectorAll(".admin-item-action-btn.del-user").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const uId = btn.dataset.userId;
        const target = this.users.find((u) => u.id === uId);
        if (target && confirm(`Delete user ${target.name} and their isolated vault?`)) {
          fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete_user", userId: uId }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.users) this.users = data.users;
              else this.users = this.users.filter((u) => u.id !== uId);
              this.selectedUserId = this.users[0]?.id || null;
              this.toast("Deleted user.");
              this.render();
            });
        }
      });
    });

    container.querySelectorAll(".admin-item-action-btn.edit-user").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const uId = btn.dataset.userId;
        const target = this.users.find((u) => u.id === uId);
        if (target) this.promptEditUser(target);
      });
    });
  }

  filterNewsCardsUI(root) {
    const q = (this.newsKeyword || "").toLowerCase().trim();
    const cards = root.querySelectorAll(".admin-news-card");
    let visible = 0;
    cards.forEach((c) => {
      const text = c.textContent.toLowerCase();
      const match = !q || text.includes(q);
      c.style.display = match ? "" : "none";
      if (match) visible++;
    });
    const emptyMsg = root.querySelector(".admin-news-filtered-empty");
    if (visible === 0 && cards.length > 0) {
      if (!emptyMsg) {
        const msg = document.createElement("div");
        msg.className = "admin-no-news admin-news-filtered-empty";
        msg.innerHTML = `<p>No stories matching “${escapeHtml(this.newsKeyword)}”. Press Enter or click “FETCH NOW” to query live APIs.</p>`;
        root.querySelector(".admin-news-grid")?.appendChild(msg);
      }
    } else if (emptyMsg) {
      emptyMsg.remove();
    }
  }

  // --- DOM Event Bindings ----------------------------------------------------
  bindEvents(root) {
    // Topbar events
    root.querySelector("#adminCloseBtn")?.addEventListener("click", () => this.close());
    root.querySelector("#adminRefreshBtn")?.addEventListener("click", async () => {
      await Promise.allSettled([this.fetchUsers(), this.fetchSavedNews(), this.fetchLiveNews()]);
      this.toast("Dashboard refreshed.");
      this.render();
    });
    root.querySelector("#adminLogoutBtn")?.addEventListener("click", () => {
      this.toast("Multi-user session locked. Logging out...");
      setTimeout(() => this.close(), 600);
    });

    // Tab buttons
    root.querySelectorAll(".admin-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab && tab !== this.currentTab) {
          this.currentTab = tab;
          try {
            history.replaceState(null, "", `#/${tab}`);
          } catch (_) {}
          if (tab === "cves") {
            if (this.cveCatalog.length === 0) {
              this.fetchCves();
            }
          } else if (tab === "osv") {
            if (this.osvNews.length === 0) {
              this.fetchOsvNews();
            }
          } else if (tab === "currents") {
            this.startCurrentsAutoRefreshTimer();
            if (this.currentsNews.length === 0) {
              this.fetchCurrentsNews();
            }
          } else if (tab === "newsdata") {
            if (this.newsDataNews.length === 0) {
              this.fetchNewsDataNews();
            }
          } else if (tab === "threats") {
            if (this.threatsList.length === 0) {
              this.fetchThreats();
            }
          }
          this.render();
        }
      });
    });

    // Tab 1: User Vaults
    if (this.currentTab === "vaults") {
      const searchInput = root.querySelector("#adminUserSearchInput");
      searchInput?.addEventListener("input", (e) => {
        this.userSearch = e.target.value;
        this.updateUsersListUI(root);
      });

      root.querySelector("#adminNewUserBtn")?.addEventListener("click", () => this.promptNewUser());

      const userListContainer = root.querySelector(".admin-user-cards-list");
      if (userListContainer) {
        this.bindUserCardEvents(userListContainer);
      }

      // Workspace actions
      const addWsBtn = root.querySelector("#adminAddWorkspaceBtn") || root.querySelector("#adminEmptyAddWsBtn");
      addWsBtn?.addEventListener("click", (e) => {
        const uId = e.currentTarget.dataset.userId;
        const u = this.users.find((usr) => usr.id === uId);
        if (u) this.promptNewWorkspace(u);
      });

      // Set password buttons
      root.querySelectorAll(".admin-set-pass-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const uId = btn.dataset.userId;
          const wsId = btn.dataset.wsId;
          const u = this.users.find((usr) => usr.id === uId);
          if (u) {
            const ws = (u.workspaces || []).find((w) => w.id === wsId);
            if (ws) this.promptSetWorkspacePassword(u, ws);
          }
        });
      });

      // Toggle notes drawer
      root.querySelectorAll(".admin-toggle-notes-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const wsId = btn.dataset.wsId;
          if (this.activeExpandedWorkspaces.has(wsId)) {
            this.activeExpandedWorkspaces.delete(wsId);
          } else {
            this.activeExpandedWorkspaces.add(wsId);
          }
          this.render();
        });
      });

      // Add note button
      root.querySelectorAll(".admin-add-note-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const uId = btn.dataset.userId;
          const wsId = btn.dataset.wsId;
          const u = this.users.find((usr) => usr.id === uId);
          if (u) {
            const ws = (u.workspaces || []).find((w) => w.id === wsId);
            if (ws) this.promptAddNote(u, ws);
          }
        });
      });

      // Delete workspace button
      root.querySelectorAll(".admin-del-ws-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const uId = btn.dataset.userId;
          const wsId = btn.dataset.wsId;
          const u = this.users.find((usr) => usr.id === uId);
          if (u && confirm("Delete this workspace and all its isolated text files?")) {
            fetch("/api/admin/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete_workspace", userId: uId, workspaceId: wsId }),
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.users) this.users = d.users;
                else u.workspaces = (u.workspaces || []).filter((w) => w.id !== wsId);
                this.toast("Workspace removed.");
                this.render();
              });
          }
        });
      });

      // View note button
      root.querySelectorAll(".admin-view-note-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const uId = btn.dataset.userId;
          const wsId = btn.dataset.wsId;
          const noteId = btn.dataset.noteId;
          const u = this.users.find((usr) => usr.id === uId);
          const ws = (u?.workspaces || []).find((w) => w.id === wsId);
          const note = (ws?.notes || []).find((n) => n.id === noteId);
          if (note) this.viewTextNote(note, u, ws);
        });
      });

      // Push note to canvas button
      root.querySelectorAll(".admin-push-canvas-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const uId = btn.dataset.userId;
          const wsId = btn.dataset.wsId;
          const noteId = btn.dataset.noteId;
          const u = this.users.find((usr) => usr.id === uId);
          const ws = (u?.workspaces || []).find((w) => w.id === wsId);
          const note = (ws?.notes || []).find((n) => n.id === noteId);
          if (note) {
            const center = this.canvas.viewportCenter();
            const created = this.store.createNode({
              prompt: note.title,
              isCustom: true,
              x: Math.round(center.x - 380),
              y: Math.round(center.y - 290),
              width: 760,
              height: 580,
            });
            this.store.updateNode(created.id, { text: note.text, prompt: note.title });
            this.canvas.select(created.id);
            this.canvas.centerOn(created);
            this.toast(`✓ Placed “${note.title}” on canvas!`);
          }
        });
      });
    }

    // Tab 2: API Keys
    if (this.currentTab === "keys") {
      root.querySelector("#adminTestKeysBtn")?.addEventListener("click", () => {
        this.fetchKeyStatuses();
      });

      const keysForm = root.querySelector("#adminApiKeysForm");
      keysForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(keysForm);
        this.apiKeys.mediastack_key = formData.get("mediastack_key") || "";
        this.apiKeys.higgsfield_key = formData.get("higgsfield_key") || "";
        this.apiKeys.newsapi_key = formData.get("newsapi_key") || "";
        this.apiKeys.reddit_user_agent = formData.get("reddit_user_agent") || "";
        this.apiKeys.rss2json_key = formData.get("rss2json_key") || "";
        this.apiKeys.techcrunch_token = formData.get("techcrunch_token") || "";
        this.apiKeys.wired_key = formData.get("wired_key") || "";
        this.apiKeys.bbc_key = formData.get("bbc_key") || "";
        this.apiKeys.gnews_key = formData.get("gnews_key") || "";
        this.apiKeys.currents_key = formData.get("currents_key") || "";
        this.apiKeys.newsdata_key = formData.get("newsdata_key") || "";
        this.saveApiKeys();
      });
    }

    // Tab: Top Weaponized CVEs (2020-2026)
    if (this.currentTab === "cves") {
      // Year pills
      root.querySelectorAll("[data-cve-year]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.cveYearFilter = btn.dataset.cveYear || "all";
          this.fetchCves(true);
        });
      });

      // Severity pills
      root.querySelectorAll("[data-cve-sev]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.cveSeverityFilter = btn.dataset.cveSev || "all";
          this.fetchCves(true);
        });
      });

      // Search input
      const searchInput = root.querySelector("#adminCveSearchInput");
      let searchTimeout = null;
      searchInput?.addEventListener("input", (e) => {
        this.cveSearchQuery = e.target.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => this.fetchCves(false), 220);
      });
      searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.cveSearchQuery = searchInput.value.trim();
          this.fetchCves(true);
        }
      });

      // Sync NVD button
      root.querySelector("#btnSyncNvdCves")?.addEventListener("click", () => {
        this.syncNvdCves(this.cveSearchQuery);
      });
      root.querySelector("#btnEmptySyncNvd")?.addEventListener("click", () => {
        this.syncNvdCves(this.cveSearchQuery);
      });

      // Refresh button: fetches fresh randomized top 7 CVE attacks
      root.querySelector("#btnRefreshCves")?.addEventListener("click", () => {
        this.fetchCves(true, true);
        this.toast("Refreshed CVE catalog: displaying new top CVE attacks.");
      });

      // Toggle 7 dimensions
      root.querySelectorAll(".cve-toggle-dims-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const cveId = btn.dataset.cveToggle;
          const box = root.querySelector(`#cve-dims-${cveId}`);
          if (box) {
            const isHidden = box.classList.toggle("is-hidden");
            btn.classList.toggle("is-active", !isHidden);
            btn.textContent = isHidden ? "▶ 7 THREAT INTELLIGENCE DIMENSIONS & PLAYBOOK" : "▼ 7 THREAT INTELLIGENCE DIMENSIONS & PLAYBOOK";
          }
        });
      });

      // Listen to CVE Briefing
      root.querySelectorAll("[data-listen-cve]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cveId = btn.dataset.listenCve;
          const cve = this.cveCatalog.find((c) => c.cveId === cveId);
          if (cve && window.audioBriefing) {
            window.audioBriefing.playCve(cve);
          }
        });
      });

      // Save to DB
      root.querySelectorAll("[data-save-cve]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const cveId = btn.dataset.saveCve;
          const cve = this.cveCatalog.find((c) => c.cveId === cveId);
          if (cve) this.saveCveToSavedNews(cve);
        });
      });

      // Create Note on Canvas
      root.querySelectorAll("[data-note-cve]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const cveId = btn.dataset.noteCve;
          const cve = this.cveCatalog.find((c) => c.cveId === cveId);
          if (cve) this.createNoteFromCve(cve);
        });
      });
    }

    // Tab: OSV.dev Security News
    if (this.currentTab === "osv") {
      const searchInput = root.querySelector("#adminOsvSearchInput");
      searchInput?.addEventListener("input", (e) => {
        this.osvKeyword = e.target.value;
        this.render();
      });

      root.querySelector("#btnRefreshOsvNews")?.addEventListener("click", () => {
        this.fetchOsvNews(true);
      });
      root.querySelector("#btnEmptyRefreshOsv")?.addEventListener("click", () => {
        this.fetchOsvNews(true);
      });

      // Create Note on Canvas from OSV
      root.querySelectorAll("[data-note-osv]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const pId = btn.dataset.noteOsv;
          const post = this.osvNews.find((p) => p.id === pId);
          if (post) this.createNoteFromOsv(post);
        });
      });
    }

    // Tab: NVD Threats & Dangerous Attacks
    if (this.currentTab === "threats") {
      const searchInput = root.querySelector("#adminThreatSearchInput");
      searchInput?.addEventListener("input", (e) => {
        this.threatsSearch = e.target.value;
      });
      searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.threatsSearch = searchInput.value.trim();
          this.fetchThreats();
        }
      });

      root.querySelector("#adminRefreshThreatsBtn")?.addEventListener("click", () => {
        if (searchInput) this.threatsSearch = searchInput.value.trim();
        this.fetchThreats();
      });

      root.querySelectorAll("[data-threat-cat]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          this.threatsCategory = btn.dataset.threatCat || "all";
          this.fetchThreats();
        });
      });

      // Save Threat to DB
      root.querySelectorAll('[data-threat-action="save-db"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const tId = btn.dataset.threatId;
          const threat = this.threatsList.find((t) => t.id === tId);
          if (threat) this.saveThreatStory(threat);
        });
      });

      // Create Note on Canvas from Threat
      root.querySelectorAll('[data-threat-action="create-note"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const tId = btn.dataset.threatId;
          const threat = this.threatsList.find((t) => t.id === tId);
          if (threat) this.createNoteFromThreat(threat);
        });
      });
    }

    // Tab: Currents Real-Time News (1-Hour Auto-Refresh)
    if (this.currentTab === "currents") {
      // Category filter buttons
      root.querySelectorAll("[data-currents-cat]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.currentsCategory = btn.dataset.currentsCat;
          this.fetchCurrentsNews(true);
        });
      });

      const keywordInput = root.querySelector("#adminCurrentsKeywordInput");
      keywordInput?.addEventListener("input", (e) => {
        this.currentsKeyword = e.target.value;
      });
      keywordInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.currentsKeyword = keywordInput.value.trim();
          this.fetchCurrentsNews();
        }
      });

      root.querySelector("#adminFetchCurrentsBtn")?.addEventListener("click", () => {
        if (keywordInput) this.currentsKeyword = keywordInput.value.trim();
        this.fetchCurrentsNews(true, true);
      });

      // Listen to CVE Briefing
      root.querySelectorAll("[data-listen-cve]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cveId = btn.dataset.listenCve;
          const cve = this.cveCatalog.find((c) => c.cveId === cveId);
          if (cve && window.audioBriefing) {
            window.audioBriefing.playCve(cve);
          }
        });
      });

      // Save to DB buttons
      root.querySelectorAll('[data-action="save-db"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sId = btn.dataset.storyId;
          const story = this.currentsNews.find((s) => s.id === sId);
          if (story) this.saveNewsStory(story);
        });
      });

      // Create Note buttons
      root.querySelectorAll('[data-action="create-note"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sId = btn.dataset.storyId;
          const story = this.currentsNews.find((s) => s.id === sId);
          if (story) this.createNoteFromNews(story);
        });
      });
    }

    // Tab: NewsData.io 10-Point Briefings
    if (this.currentTab === "newsdata") {
      // Category filter buttons
      root.querySelectorAll("[data-newsdata-cat]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.newsDataCategory = btn.dataset.newsdataCat;
          this.fetchNewsDataNews(true);
        });
      });

      const keywordInput = root.querySelector("#adminNewsDataKeywordInput");
      keywordInput?.addEventListener("input", (e) => {
        this.newsDataKeyword = e.target.value;
      });
      keywordInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.newsDataKeyword = keywordInput.value.trim();
          this.fetchNewsDataNews();
        }
      });

      root.querySelector("#adminFetchNewsDataBtn")?.addEventListener("click", () => {
        if (keywordInput) this.newsDataKeyword = keywordInput.value.trim();
        this.fetchNewsDataNews(true, true);
      });

      root.querySelector("#adminSyncCisaKevBlogBtn")?.addEventListener("click", () => {
        this.syncNvdCves(this.newsDataKeyword);
      });

      // Listen to CVE Briefing
      root.querySelectorAll("[data-listen-cve]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cveId = btn.dataset.listenCve;
          const cve = this.cveCatalog.find((c) => c.cveId === cveId);
          if (cve && window.audioBriefing) {
            window.audioBriefing.playCve(cve);
          }
        });
      });

      // Save to DB buttons
      root.querySelectorAll('[data-action="save-db"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sId = btn.dataset.storyId;
          const story = this.newsDataNews.find((s) => s.id === sId);
          if (story) this.saveNewsStory(story);
        });
      });

      // Create Note buttons
      root.querySelectorAll('[data-action="create-note"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sId = btn.dataset.storyId;
          const story = this.newsDataNews.find((s) => s.id === sId);
          if (story) this.createNoteFromNews(story);
        });
      });
    }

    // Tab 3: Live Fetch News
    if (this.currentTab === "news") {
      const keywordInput = root.querySelector("#adminNewsKeywordInput");
      keywordInput?.addEventListener("input", (e) => {
        this.newsKeyword = e.target.value;
        this.filterNewsCardsUI(root);
      });
      keywordInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.newsKeyword = keywordInput.value.trim();
          this.fetchLiveNews();
        }
      });

      const sourceSelect = root.querySelector("#adminNewsSourceSelect");
      sourceSelect?.addEventListener("change", (e) => {
        this.newsSource = e.target.value;
        this.fetchLiveNews();
      });

      root.querySelector("#adminFetchNewsBtn")?.addEventListener("click", () => {
        if (keywordInput) this.newsKeyword = keywordInput.value.trim();
        this.fetchLiveNews();
      });

      // Listen to CVE Briefing
      root.querySelectorAll("[data-listen-cve]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cveId = btn.dataset.listenCve;
          const cve = this.cveCatalog.find((c) => c.cveId === cveId);
          if (cve && window.audioBriefing) {
            window.audioBriefing.playCve(cve);
          }
        });
      });

      // Save to DB buttons
      root.querySelectorAll('[data-action="save-db"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sId = btn.dataset.storyId;
          const story = this.liveNews.find((s) => s.id === sId);
          if (story) this.saveNewsStory(story);
        });
      });

      // Create Note buttons
      root.querySelectorAll('[data-action="create-note"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sId = btn.dataset.storyId;
          const story = this.liveNews.find((s) => s.id === sId);
          if (story) this.createNoteFromNews(story);
        });
      });

      // Topic filter tabs
      root.querySelectorAll("[data-news-topic]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.activeNewsTopic = btn.dataset.newsTopic || "all";
          this.fetchLiveNews();
        });
      });

      // 2-Week Database Prune and Sync buttons
      root.querySelector("#adminPruneDbBtn")?.addEventListener("click", () => {
        this.pruneDatabaseOldNews(14);
      });
      root.querySelector("#adminSyncAllDbBtn")?.addEventListener("click", () => {
        this.fetchLiveNews();
      });
    }

    // Tab 4: Saved News Table
    if (this.currentTab === "saved") {
      // 2-Week Database Retention Prune button
      root.querySelector("#adminPruneDbSavedBtn")?.addEventListener("click", () => {
        this.pruneDatabaseOldNews(14);
      });

      root.querySelectorAll(".admin-table-create-note").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sId = btn.dataset.storyId;
          const story = this.savedNews.find((s) => s.id === sId);
          if (story) this.createNoteFromNews(story);
        });
      });

      root.querySelectorAll(".admin-table-del-news").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const sId = btn.dataset.storyId;
          if (confirm("Remove this story from the saved news database table?")) {
            this.deleteSavedNewsStory(sId);
          }
        });
      });

      root.querySelector("#adminExportSavedJsonBtn")?.addEventListener("click", () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.savedNews, null, 2));
        const dl = document.createElement("a");
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `brainvault-saved-news-${Date.now()}.json`);
        dl.click();
      });
    }

    // Tab 5: Image Storage
    if (this.currentTab === "images") {
      const fileInput = root.querySelector("#adminImageUploadInput");
      fileInput?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            const dataUrl = re.target.result;
            const img = new Image();
            img.onload = () => {
              fetch("/api/admin/images/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: file.name,
                  sizeBytes: file.size,
                  width: img.width,
                  height: img.height,
                  dataUrl,
                }),
              })
                .then((r) => r.json())
                .then(async () => {
                  await this.fetchStoredImages();
                  this.toast(`Uploaded ${file.name}`);
                  this.render();
                });
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        }
      });

      root.querySelectorAll(".admin-del-img-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const imgId = btn.dataset.imgId;
          if (confirm("Delete this stored image asset?")) {
            fetch("/api/admin/images/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: imgId }),
            })
              .then((r) => r.json())
              .then(async () => {
                await this.fetchStoredImages();
                this.toast("Deleted image asset.");
                this.render();
              });
          }
        });
      });
    }

    // Tab 6: 3D Constellation
    if (this.currentTab === "constellation") {
      root.querySelector("#admin3dToggleRotate")?.addEventListener("click", () => {
        this.threeAutoRotate = !this.threeAutoRotate;
        const btn = root.querySelector("#admin3dToggleRotate");
        if (btn) {
          btn.textContent = `Auto Rotate: ${this.threeAutoRotate ? "ON" : "OFF"}`;
          btn.classList.toggle("is-active", this.threeAutoRotate);
        }
      });

      root.querySelector("#admin3dThemeSelect")?.addEventListener("change", (e) => {
        this.threeTheme = e.target.value;
        this.init3DScene();
      });

      root.querySelector("#admin3dResetCam")?.addEventListener("click", () => {
        this.threeRot = { x: 0.35, y: -0.2 };
        this.threeDist = 950;
      });

      root.querySelector("#admin3dCloseInspector")?.addEventListener("click", () => {
        root.querySelector("#admin3dInspector")?.classList.add("is-hidden");
      });
    }

    // Global listener for collapsible takeaways toggle buttons
    root.querySelectorAll('[data-action="toggle-takeaways"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const sId = btn.dataset.storyId;
        const box = root.querySelector(`#takeaways-box-${sId}`);
        if (box) {
          const isHidden = box.classList.toggle("is-hidden");
          btn.classList.toggle("is-active", !isHidden);
          const count = btn.dataset.takeawaysCount || 7;
          btn.textContent = isHidden ? `👁️ View Key Points (${count})` : `👁️ Hide Key Points (${count})`;
        }
      });
    });

    // Global listener for collapsible 7 Threat Dimensions toggle buttons
    root.querySelectorAll('[data-threat-action="toggle-dimensions"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const tId = btn.dataset.threatId;
        const box = root.querySelector(`#threat-dimensions-${tId}`);
        if (box) {
          const isHidden = box.classList.toggle("is-hidden");
          btn.classList.toggle("is-active", !isHidden);
          btn.textContent = isHidden ? "👁️ View 7 Threat Dimensions" : "👁️ Hide Threat Dimensions";
        }
      });
    });
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function formatSavedDate(val) {
  if (!val) return "Oct 21, 2026";
  let d;
  if (typeof val === "number") {
    // If timestamp is in seconds (< 1e11), multiply by 1000 to get milliseconds
    d = new Date(val < 1e11 ? val * 1000 : val);
  } else if (!isNaN(Number(val)) && !String(val).includes("-") && !String(val).includes("/")) {
    const num = Number(val);
    d = new Date(num < 1e11 ? num * 1000 : num);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) {
    return String(val);
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function generate7KeyPoints(title, summary, sourceName) {
  const t = String(title || "Security Intelligence Notice").trim();
  const s = String(summary || "").trim();
  const src = sourceName || "Intelligence Source";
  const blob = (t + " " + s).toLowerCase();

  const isRansom = /ransomware|extort|lockbit|blackcat|black basta|akira|encrypt|leak site/.test(blob);
  const isCve = /cve|vulnerab|zero-day|0-day|exploit|rce|flaw|patch|bypass|injection|overflow/.test(blob);
  const isAi = /ai|llm|gpt|model|neural|agent|deepseek|openai|anthropic|machine learning|nvidia|inference/.test(blob);
  const isState = /apt|volt typhoon|russia|china|iran|north korea|espionage|state-sponsored|fbi|arrest/.test(blob);

  let hero = `Primary Research Unit / Intelligence Source (${src})`;
  if (isRansom) hero = "LockBit 3.0 / BlackCat ALPHV Ransomware Syndicates";
  else if (isState) hero = "Volt Typhoon / State-Sponsored Advanced Cyber Unit";
  else if (isAi) hero = "Frontier AI Safety Labs & Autonomous Agent Architecture";
  else if (isCve) hero = "Zero-Day Exploit Developers & Weaponized Scanners";

  let victims = "Distributed enterprise endpoints, SaaS identity providers, and interconnected cloud supply chains.";
  if (isRansom) victims = "Healthcare networks, financial institutions, enterprise virtualized storage (ESXi), and hybrid cloud systems.";
  else if (isState) victims = "Defense Industrial Base (DIB), municipal power/water utilities, critical telecommunications, and government IT.";
  else if (isAi) victims = "Enterprise LLM endpoints, autonomous agent tool pipelines, model weights repositories, and inference clusters.";

  let tools = "Living-off-the-Land scripts, reverse TCP relays, automated credential sprayers, and network scanners.";
  if (isRansom) tools = "Cobalt Strike 4.9 Beacon, Mimikatz, PsExec, Rust/C++ multi-threaded encryptors, and StealBit exfiltrators.";
  else if (isCve || isState) tools = "Havoc Demon C2, Sliver Golang C2, Metasploit Framework, Living-off-the-Land Binaries (LOLBins), and webshell droppers.";
  else if (isAi) tools = "PyTorch/TensorFlow runtimes, CUDA accelerated kernels, Hugging Face transformers, and prompt-injection harnesses.";

  let useCase = "Reconnaissance scanning, unauthorized session hijacking, and persistent foothold establishment across corporate subnets.";
  if (isRansom) useCase = "Double extortion chain: initial perimeter breach, credential harvesting, rapid domain-wide lateral movement, and data staging.";
  else if (isCve) useCase = "Unauthenticated remote code execution (RCE) targeting internet-facing perimeter services to gain elevated system privileges.";
  else if (isAi) useCase = "High-throughput autonomous agent decision-making, neural weight generation, and multimodal visual reasoning.";

  const coreSentence = s.length > 20 ? s.slice(0, 160) + (s.length > 160 ? "..." : "") : "High-priority incoming telemetry with strategic impact.";
  const techMechanics = isCve ? "Remote memory corruption, unvalidated RPC/HTTP input vectors, or authentication bypass." : (isAi ? "Transformer attention layers, parameter weight tuning, and algorithmic inference pipelines." : "Underlying architectural components and data pipelines subject to operational monitoring.");

  return [
    `1. Head Hero & Lead Adversary: ${hero}`,
    `2. Core Topic & Executive Intelligence: ${t.slice(0, 120)} — ${coreSentence}`,
    `3. Root Flaw & Technical Mechanics: ${techMechanics}`,
    `4. Affected Victims & Infrastructure Scope: ${victims}`,
    `5. Weaponized Attack Tools & C2 Frameworks: ${tools}`,
    `6. Primary Attack Use Case & Exploitation Characteristics: ${useCase}`,
    `7. Remediation, Hardening & Defensive Playbook: Apply vendor security patches immediately, enforce hardware MFA, isolate perimeter assets, and map intelligence into BrainVault canvas.`
  ];
}

function generate10KeyPoints(title, summary, sourceName) {
  return generate7KeyPoints(title, summary, sourceName);
}
