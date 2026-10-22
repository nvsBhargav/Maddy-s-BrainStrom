// Static seed content: topics, vocabulary, and deterministic concept composition.
// Deterministic by design: the canvas must work instantly and offline, with or without an AI key.

export const TOPIC_POOL = [
  "Quantum Computing",
  "Cyber Threat Intelligence",
  "Zero Trust Architecture",
  "Dark Matter & Energy",
  "Neural Architecture",
  "Ransomware Economics",
  "Post-Quantum Cryptography",
  "Black Hole Thermodynamics",
  "Supply Chain Attacks",
  "Renaissance Philosophy",
  "Biomimetic Engineering",
  "Edge Computing",
];

export const TRY_TOPICS = [
  "Cyber Threat Intelligence",
  "Zero Trust Architecture",
  "Post-Quantum Cryptography",
  "Ransomware Economics",
  "Edge Computing",
];

export const VOCABULARY = [
  {
    term: "Epistemology",
    ipa: "/ɪˌpɪstɪˈmɒlədʒi/",
    pos: "noun",
    definition:
      "The philosophical theory of knowledge, especially with regard to its methods, validity, and scope, and the distinction between justified belief and opinion.",
    frame: "Philosophical & Academic Discourse",
    example:
      "Threat modelling is applied epistemology: deciding which beliefs about an adversary are justified enough to act on.",
  },
  {
    term: "Heuristic",
    ipa: "/hjʊˈrɪstɪk/",
    pos: "noun",
    definition:
      "A practical method or mental shortcut not guaranteed to be optimal or perfect, but sufficient for immediate goals and rapid problem-solving.",
    frame: "Algorithmic Computer Science & Cognitive Psychology",
    example:
      "Triage is a heuristic: severity scores rank incidents long before complete evidence arrives.",
  },
  {
    term: "Emergence",
    ipa: "/ɪˈmɜːdʒəns/",
    pos: "noun",
    definition:
      "The phenomenon whereby larger entities, patterns, and regularities arise through interactions among smaller or simpler entities that themselves do not exhibit such properties.",
    frame: "Complex Systems & Nonlinear Dynamics",
    example:
      "Botnet behaviour emerges from thousands of individually simple infected hosts.",
  },
  {
    term: "Dialectic",
    ipa: "/ˌdaɪəˈlektɪk/",
    pos: "noun",
    definition:
      "A discourse between two opposing sides trying to establish the truth through reasoned dialogue and thesis-antithesis synthesis.",
    frame: "Critical Inquiry & Hegelian Philosophy",
    example:
      "Red team and blue team form a dialectic that resolves into a stronger control set.",
  },
  {
    term: "Isomorphism",
    ipa: "/ˌaɪsəʊˈmɔːfɪzəm/",
    pos: "noun",
    definition:
      "A structure-preserving mapping between two sets or mathematical entities that establishes an invertible equivalence between their operations.",
    frame: "Pure Mathematics & Abstract Algebra",
    example:
      "The spatial canvas constructs an isomorphism between associative memories and 2D coordinates.",
  },
  {
    term: "Orthogonal",
    ipa: "/ɔːˈθɒɡənəl/",
    pos: "adjective",
    definition:
      "Statistically independent or conceptually unrelated; mutually perpendicular dimensions that can vary without affecting each other.",
    frame: "Vector Geometry, System Design & Machine Learning",
    example:
      "Authentication strength and network segmentation are orthogonal controls; improving one does not improve the other.",
  },
  {
    term: "Entropy",
    ipa: "/ˈentrəpi/",
    pos: "noun",
    definition:
      "A measure of randomness, disorder, or unmapped information within a closed thermodynamic or computational system.",
    frame: "Thermodynamics & Information Theory",
    example:
      "Key rotation bounds the entropy an attacker can accumulate about a compromised credential.",
  },
  {
    term: "Recursion",
    ipa: "/rɪˈkɜːʒən/",
    pos: "noun",
    definition:
      "A method of solving problems where the solution depends on solutions to smaller instances of the same problem; self-referential definition.",
    frame: "Computer Science, Linguistics & Logic",
    example:
      "A parser that descends through nested payloads is applying recursion to untrusted input.",
  },
  {
    term: "Semiotics",
    ipa: "/ˌsiːmiˈɒtɪks/",
    pos: "noun",
    definition:
      "The study of signs and symbols and their interpretation, meaning, and function in human communication.",
    frame: "Linguistics & Visual Design Theory",
    example:
      "Phishing works through semiotics: a forged padlock icon signals safety it cannot guarantee.",
  },
  {
    term: "Paradigm",
    ipa: "/ˈpærədaɪm/",
    pos: "noun",
    definition:
      "A distinct set of concepts, thought patterns, or standards that define a legitimate contribution to a scientific or philosophical field.",
    frame: "Philosophy of Science & Organizational Strategy",
    example:
      "Zero trust replaced the perimeter paradigm with continuous verification.",
  },
];

const ANGLE_LENS = {
  cyber:
    "The operational question is blast radius: how far does an unverified assumption propagate before a control interrupts it?",
  tech:
    "The engineering question is leverage: which abstraction removes the most duplicated work without hiding failure modes?",
  default:
    "The useful question is structure: which forces hold this system together, and which are merely correlated?",
};

function lensFor(topic) {
  const t = topic.toLowerCase();
  if (/(cyber|threat|ransom|zero trust|attack|vulnerab|malware|phish|crypto)/.test(t)) return ANGLE_LENS.cyber;
  if (/(quantum|neural|edge|comput|architecture|engineering|protocol|data|model)/.test(t)) return ANGLE_LENS.tech;
  return ANGLE_LENS.default;
}

const GLOSSARY = [
  ["Attack Surface", "https://owasp.org/www-community/Attack_Surface"],
  ["Zero Trust", "https://csrc.nist.gov/pubs/sp/800/207/final"],
  ["Blast Radius", "https://csrc.nist.gov/glossary/term/blast_radius"],
  ["Signal", "https://en.wikipedia.org/wiki/Signal"],
  ["Feedback Loop", "https://en.wikipedia.org/wiki/Feedback"],
  ["Leverage", "https://en.wikipedia.org/wiki/Leverage_(mechanics)"],
  ["Entropy", "https://en.wikipedia.org/wiki/Entropy"],
  ["Model", "https://en.wikipedia.org/wiki/Conceptual_model"],
];

function pickLinks(topic, seed) {
  const pool = topic.toLowerCase().match(/(cyber|threat|attack|trust|ransom)/)
    ? ["Attack Surface", "Zero Trust", "Blast Radius", "Signal"]
    : ["Feedback Loop", "Leverage", "Entropy", "Model"];
  const a = pool[seed % pool.length];
  const b = pool[(seed + 2) % pool.length];
  return [a, b];
}

export function composeConcept(topic, { sub = false } = {}) {
  const safe = topic.trim() || "Untitled Concept";
  const seed = [...safe].reduce((n, c) => n + c.charCodeAt(0), 0);
  const [a, b] = pickLinks(safe, seed);
  const lens = lensFor(safe);
  const heading = sub ? `### ${safe}` : "";
  const intro = sub
    ? `**${safe}** is a working part of the larger structure, not a footnote. ${lens}`
    : `${safe} is best understood as a live system rather than a definition. ${lens}`;
  const body = [
    heading,
    intro,
    `Two forces dominate: **[${a}](${a})** shapes what can be observed, while **[${b}](${b})** shapes what can be changed. Separating them keeps the model honest — a signal that cannot alter a decision is decoration, and a control that cannot be measured is theatre.`,
    `The practical test is a small one: name the assumption, name the evidence, and name the cost of being wrong. Where those three diverge, the concept has found its real boundary.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const prompts = sub
    ? [`Principles of ${safe}`, `Failure modes of ${safe}`, `Cross-domain applications`]
    : [
        `What breaks ${safe} first?`,
        `How is ${safe} measured?`,
        `Where does ${safe} not apply?`,
      ];
  return { text: body, prompts };
}

export function relatedTopics(topic, count = 3) {
  const pool = TOPIC_POOL.filter((t) => t !== topic);
  const seed = [...topic].reduce((n, c) => n + c.charCodeAt(0), 0);
  return Array.from({ length: count }, (_, i) => pool[(seed + i * 3) % pool.length]);
}

export function glossaryDef(term) {
  const found = VOCABULARY.find((v) => v.term.toLowerCase() === term.toLowerCase());
  if (found) return found;
  return {
    term,
    ipa: "",
    pos: "term",
    definition: `${term} is an associated concept in this workspace. Add a definition to anchor it, or expand it into its own branch.`,
    frame: "Workspace vocabulary",
    example: `“${term}” appears in the connected concept matter.`,
  };
}

export const GLOSSARY_LINKS = GLOSSARY;
