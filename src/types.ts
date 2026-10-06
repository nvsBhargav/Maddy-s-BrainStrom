export interface GridNodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  color?: string;
  isCustom?: boolean;
  prompt: string;
  asciiArt?: string;
  imageUrl?: string;
  imageLoading?: boolean;
  text: string;
  codeSnippet?: {
    code: string;
    language: string;
  };
  prompts: string[];
  status: 'generating' | 'ready' | 'error';
  versionIndex: number;
  versions: NodeVersion[];
  parentId?: string;
  isMinimized?: boolean;
  isLabelHidden?: boolean;
}

export interface NodeVersion {
  prompt: string;
  asciiArt?: string;
  imageUrl?: string;
  imageLoading?: boolean;
  text: string;
  codeSnippet?: {
    code: string;
    language: string;
  };
  prompts: string[];
}

export interface StickyNoteData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  title?: string;
  createdAt: number;
}

export interface WorkspaceTheme {
  id: string;
  name: string;
  bgDarkColor: string;
  accentColor: string;
  borderColor: string;
  badgeBg: string;
}

export interface RelationshipLink {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface WorkspaceData {
  id: string;
  name: string;
  themeId: string;
  bgDarkColor: string;
  nodes: GridNodeData[];
  stickyNotes?: StickyNoteData[];
  links?: RelationshipLink[];
  createdAt: number;
  updatedAt: number;
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  partOfSpeech: string;
  definition: string;
  frameOfUse: string;
  exampleSentence: string;
  synonyms?: string[];
}
