export interface AvatarPreset {
  id: string;
  name: string;
  category: string;
  accent: string;
  svgDataUri: string;
}

// Preset characters removed per user request
export const AVATAR_PRESETS: AvatarPreset[] = [];
