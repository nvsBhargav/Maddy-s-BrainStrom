import { DictionaryEntry } from './types';

export const DICTIONARY_ENTRIES: DictionaryEntry[] = [
  {
    word: 'Epistemology',
    phonetic: '/ɪˌpɪstɪˈmɒlədʒi/',
    partOfSpeech: 'noun',
    definition: 'The philosophical theory of knowledge, especially with regard to its methods, validity, and scope, and the distinction between justified belief and opinion.',
    frameOfUse: 'Philosophical & Academic Discourse',
    exampleSentence: 'In neural cognitive modeling, epistemology determines how synthetic agents construct justified beliefs from sensory inputs.',
    synonyms: ['Theory of Knowledge', 'Cognitive Philosophy', 'Epistemics']
  },
  {
    word: 'Heuristic',
    phonetic: '/hjʊəˈrɪstɪk/',
    partOfSpeech: 'noun / adjective',
    definition: 'A practical method or mental shortcut not guaranteed to be optimal or perfect, but sufficient for immediate goals and rapid problem-solving.',
    frameOfUse: 'Algorithmic Computer Science & Cognitive Psychology',
    exampleSentence: 'A* search relies on an admissible heuristic function to estimate the shortest path through spatial graph vertices.',
    synonyms: ['Rule of Thumb', 'Approximation', 'Empirical Method']
  },
  {
    word: 'Emergence',
    phonetic: '/ɪˈmɜːdʒəns/',
    partOfSpeech: 'noun',
    definition: 'The phenomenon whereby larger entities, patterns, and regularities arise through interactions among smaller or simpler entities that themselves do not exhibit such properties.',
    frameOfUse: 'Complex Systems & Nonlinear Dynamics',
    exampleSentence: 'Consciousness in complex networks is often characterized as an emergence resulting from interconnected feedback loops.',
    synonyms: ['Spontaneous Order', 'Self-Organization', 'Synergy']
  },
  {
    word: 'Dialectic',
    phonetic: '/ˌdaɪəˈlɛktɪk/',
    partOfSpeech: 'noun',
    definition: 'A discourse between two opposing sides trying to establish the truth through reasoned dialogue and thesis-antithesis synthesis.',
    frameOfUse: 'Critical Inquiry & Hegelian Philosophy',
    exampleSentence: 'The dialectic between empirical observation and mathematical abstraction propelled the 20th-century quantum revolution.',
    synonyms: ['Synthesis', 'Ratiocination', 'Structured Debate']
  },
  {
    word: 'Isomorphism',
    phonetic: '/ˌaɪsəʊˈmɔːfɪzəm/',
    partOfSpeech: 'noun',
    definition: 'A structure-preserving mapping between two sets or mathematical entities that establishes an invertible equivalence between their operations.',
    frameOfUse: 'Pure Mathematics & Abstract Algebra',
    exampleSentence: 'The spatial canvas constructs an isomorphism between high-dimensional associative memories and 2D spatial coordinates.',
    synonyms: ['Equivalence', 'Bijection', 'Structural Congruence']
  },
  {
    word: 'Orthogonal',
    phonetic: '/ɔːˈθɒɡənəl/',
    partOfSpeech: 'adjective',
    definition: 'Statistically independent or conceptually unrelated; mutually perpendicular dimensions that can vary without affecting each other.',
    frameOfUse: 'Vector Geometry, System Design & Machine Learning',
    exampleSentence: 'In software architecture, persistence and presentation logic should remain orthogonal concerns.',
    synonyms: ['Perpendicular', 'Independent', 'Decoupled']
  },
  {
    word: 'Entropy',
    phonetic: '/ˈɛntrəpi/',
    partOfSpeech: 'noun',
    definition: 'A measure of randomness, disorder, or unmapped information within a closed thermodynamic or computational system.',
    frameOfUse: 'Thermodynamics & Information Theory',
    exampleSentence: 'Cross-entropy loss quantifies the divergence between predicted probability distributions and the observed ground truth.',
    synonyms: ['Disorder', 'Information Uncertainty', 'Randomness']
  },
  {
    word: 'Recursion',
    phonetic: '/rɪˈkɜːʃən/',
    partOfSpeech: 'noun',
    definition: 'A method of solving problems where the solution depends on solutions to smaller instances of the same problem; self-referential definition.',
    frameOfUse: 'Computer Science, Linguistics & Logic',
    exampleSentence: 'The knowledge tree spawns sub-nodes through structural recursion until base axioms are reached.',
    synonyms: ['Self-Reference', 'Iterative Nesting', 'Induction']
  },
  {
    word: 'Semiotics',
    phonetic: '/ˌsɛmiˈɒtɪks/',
    partOfSpeech: 'noun',
    definition: 'The study of signs and symbols and their interpretation, meaning, and function in human communication.',
    frameOfUse: 'Linguistics & Visual Design Theory',
    exampleSentence: 'The semiotics of graph node connectors conveys causal dependence and relational hierarchy at a single glance.',
    synonyms: ['Sign Theory', 'Symbology', 'Semantics']
  },
  {
    word: 'Paradigm',
    phonetic: '/ˈpærədaɪm/',
    partOfSpeech: 'noun',
    definition: 'A distinct set of concepts, thought patterns, or standards that define a legitimate contribution to a scientific or philosophical field.',
    frameOfUse: 'Philosophy of Science & Organizational Strategy',
    exampleSentence: 'Spatial infinite canvases represent a paradigm shift away from rigid linear document filing toward relational mind-mapping.',
    synonyms: ['Framework', 'Archetype', 'Conceptual Model']
  }
];

export function searchDictionary(query: string): DictionaryEntry[] {
  if (!query.trim()) return DICTIONARY_ENTRIES;
  const q = query.toLowerCase().trim();
  return DICTIONARY_ENTRIES.filter(e => 
    e.word.toLowerCase().includes(q) ||
    e.definition.toLowerCase().includes(q) ||
    e.frameOfUse.toLowerCase().includes(q)
  );
}

export function getRandomWord(): DictionaryEntry {
  const index = Math.floor(Math.random() * DICTIONARY_ENTRIES.length);
  return DICTIONARY_ENTRIES[index];
}
