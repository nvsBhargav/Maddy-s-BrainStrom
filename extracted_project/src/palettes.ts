import { WorkspaceTheme } from './types';

export interface NodePalette {
  id: string;
  name: string;
  bg: string;
  border: string;
  headerBg: string;
  accent: string;
  textColor: string;
}

export const NODE_PALETTES: NodePalette[] = [
  {
    id: 'primary-node',
    name: 'Cobalt Slate',
    bg: '#8686AC',
    border: '#5C5C85',
    headerBg: '#727299',
    accent: '#0F0E47',
    textColor: '#0B0A33',
  },
  {
    id: 'subnode-silver',
    name: 'Silver Frost',
    bg: '#CBCBCB',
    border: '#9E9E9E',
    headerBg: '#B8B8B8',
    accent: '#0F0E47',
    textColor: '#111827',
  },
  {
    id: 'white',
    name: 'Studio White',
    bg: '#FFFFFF',
    border: '#CBD5E1',
    headerBg: '#F8FAFC',
    accent: '#0F0E47',
    textColor: '#0F172A',
  },
  {
    id: 'cream',
    name: 'Warm Cream',
    bg: '#FDFBF7',
    border: '#E2D9C8',
    headerBg: '#F6F1E5',
    accent: '#854D0E',
    textColor: '#1C1917',
  },
  {
    id: 'mint',
    name: 'Soft Mint',
    bg: '#E3F2E9',
    border: '#BDDCCB',
    headerBg: '#D1EADE',
    accent: '#166534',
    textColor: '#14532D',
  },
  {
    id: 'sky',
    name: 'Sky Mist',
    bg: '#E3EDF6',
    border: '#BED5E8',
    headerBg: '#D3E3F0',
    accent: '#0369A1',
    textColor: '#0C4A6E',
  },
  {
    id: 'butter',
    name: 'Solar Honey',
    bg: '#FAF5D4',
    border: '#E8E1AF',
    headerBg: '#F4EDB8',
    accent: '#A16207',
    textColor: '#422006',
  },
  {
    id: 'rose',
    name: 'Blush Quartz',
    bg: '#FAF3F3',
    border: '#E8CFCF',
    headerBg: '#F5E4E4',
    accent: '#BE123C',
    textColor: '#4C0519',
  },
  {
    id: 'lavender',
    name: 'Lilac Mist',
    bg: '#F3E8FF',
    border: '#D8B4FE',
    headerBg: '#E9D5FF',
    accent: '#7E22CE',
    textColor: '#3B0764',
  },
  {
    id: 'coral',
    name: 'Warm Coral',
    bg: '#FFEDD5',
    border: '#FDBA74',
    headerBg: '#FED7AA',
    accent: '#C2410C',
    textColor: '#431407',
  },
  {
    id: 'cyan',
    name: 'Electric Cyan',
    bg: '#CFFAFE',
    border: '#67E8F9',
    headerBg: '#A5F3FC',
    accent: '#0E7490',
    textColor: '#164E63',
  },
  {
    id: 'emerald',
    name: 'Emerald Glow',
    bg: '#D1FAE5',
    border: '#6EE7B7',
    headerBg: '#A7F3D0',
    accent: '#047857',
    textColor: '#064E3B',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    bg: '#E0E7FF',
    border: '#A5B4FC',
    headerBg: '#C7D2FE',
    accent: '#4338CA',
    textColor: '#1E1B4B',
  },
  {
    id: 'amber',
    name: 'Amber Glow',
    bg: '#FEF3C7',
    border: '#FCD34D',
    headerBg: '#FDE68A',
    accent: '#B45309',
    textColor: '#451A03',
  },
  {
    id: 'dark-slate',
    name: 'Slate Carbon',
    bg: '#2E2E38',
    border: '#454555',
    headerBg: '#3A3A48',
    accent: '#8686AC',
    textColor: '#F8FAFC',
  },
  {
    id: 'deep-obsidian',
    name: 'Deep Obsidian',
    bg: '#18181B',
    border: '#3F3F46',
    headerBg: '#27272A',
    accent: '#38BDF8',
    textColor: '#F4F4F5',
  }
];

export const WORKSPACE_THEMES: WorkspaceTheme[] = [
  {
    id: 'deep-cobalt',
    name: 'Deep Obsidian Glass',
    bgDarkColor: '#030307',
    accentColor: '#8686AC',
    borderColor: '#262473',
    badgeBg: '#1B195C'
  },
  {
    id: 'midnight-obsidian',
    name: 'Midnight Obsidian',
    bgDarkColor: '#0B0F19',
    accentColor: '#38BDF8',
    borderColor: '#1E293B',
    badgeBg: '#131B2E'
  },
  {
    id: 'galactic-nebula',
    name: 'Galactic Nebula',
    bgDarkColor: '#1A0B2E',
    accentColor: '#C084FC',
    borderColor: '#3B185F',
    badgeBg: '#281345'
  },
  {
    id: 'cyber-emerald',
    name: 'Cyber Emerald',
    bgDarkColor: '#0A1F1C',
    accentColor: '#34D399',
    borderColor: '#134E4A',
    badgeBg: '#10332E'
  },
  {
    id: 'crimson-abyss',
    name: 'Crimson Abyss',
    bgDarkColor: '#1F0A12',
    accentColor: '#FB7185',
    borderColor: '#4C1D2B',
    badgeBg: '#33121F'
  },
  {
    id: 'charcoal-titanium',
    name: 'Charcoal Titanium',
    bgDarkColor: '#12151E',
    accentColor: '#94A3B8',
    borderColor: '#272F40',
    badgeBg: '#1A202D'
  },
  {
    id: 'royal-navy',
    name: 'Royal Navy',
    bgDarkColor: '#0A192F',
    accentColor: '#64FFDA',
    borderColor: '#172A45',
    badgeBg: '#112240'
  },
  {
    id: 'deep-forest',
    name: 'Deep Forest',
    bgDarkColor: '#061C14',
    accentColor: '#10B981',
    borderColor: '#0F3929',
    badgeBg: '#0B291D'
  },
  {
    id: 'cosmic-plum',
    name: 'Cosmic Plum',
    bgDarkColor: '#1E0E24',
    accentColor: '#E879F9',
    borderColor: '#3A1847',
    badgeBg: '#2C1236'
  }
];

// Helper to calculate perceived brightness
function getBrightness(hex: string): number {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return 180;
  const fullHex = cleanHex.length === 3 
    ? cleanHex.split('').map(c => c + c).join('') 
    : cleanHex;
  const r = parseInt(fullHex.substring(0, 2), 16) || 0;
  const g = parseInt(fullHex.substring(2, 4), 16) || 0;
  const b = parseInt(fullHex.substring(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export const getPalette = (colorId?: string): NodePalette => {
  if (!colorId) return NODE_PALETTES[0]; // defaults to #8686AC

  // Direct predefined match
  const found = NODE_PALETTES.find(p => p.id === colorId || p.bg.toLowerCase() === colorId.toLowerCase());
  if (found) return found;

  // Custom manual color adjustment (arbitrary hex from user color picker)
  if (colorId.startsWith('#')) {
    const isLight = getBrightness(colorId) > 130;
    return {
      id: `custom-${colorId}`,
      name: `Custom (${colorId})`,
      bg: colorId,
      border: isLight ? 'rgba(15, 14, 71, 0.35)' : 'rgba(255, 255, 255, 0.35)',
      headerBg: colorId,
      accent: isLight ? '#0F0E47' : '#FFFFFF',
      textColor: isLight ? '#0B0A33' : '#F8FAFC'
    };
  }

  return NODE_PALETTES[0];
};

export const PRIMARY_NODE_COLOR = '#8686AC';
export const SUBNODE_COLOR = '#CBCBCB';

/**
 * Returns the primary theme color for nodes created in the specified workspace.
 * Uses the workspace's accentColor (or mapped theme), and if not available or custom bg,
 * derives an attractive matching node tone.
 */
export function getWorkspacePrimaryNodeColor(workspace?: { themeId?: string; bgDarkColor?: string; accentColor?: string } | null): string {
  if (!workspace) return PRIMARY_NODE_COLOR;
  
  if (workspace.accentColor) {
    return workspace.accentColor;
  }
  
  if (workspace.themeId) {
    const foundTheme = WORKSPACE_THEMES.find(t => t.id === workspace.themeId);
    if (foundTheme?.accentColor) return foundTheme.accentColor;
  }

  if (workspace.bgDarkColor) {
    const foundByBg = WORKSPACE_THEMES.find(t => t.bgDarkColor.toLowerCase() === workspace.bgDarkColor?.toLowerCase());
    if (foundByBg?.accentColor) return foundByBg.accentColor;
  }

  return PRIMARY_NODE_COLOR;
}
