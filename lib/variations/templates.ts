import { TextOverlay, TransitionDef } from '@/types';

export interface TemplateParams {
  prompt?: string;
  base?: TextOverlay | null;
}

export interface TemplateDef {
  id: string;
  name: string;
  overlay: (params: TemplateParams) => TextOverlay;
  defaultTransition?: TransitionDef;
}

export const VARIATION_TEMPLATES: TemplateDef[] = [
  {
    id: 'subtitle-bold',
    name: 'Subtitle Bold',
    overlay: ({ prompt }) => ({
      content: prompt ?? 'Your headline here',
      position: 'bottom',
      fontSize: 48,
      textColor: '#ffffff',
      bgColor: '#000000',
      bgOpacity: 60,
      fontWeight: '700',
    }),
    defaultTransition: { kind: 'fadeIn', durationMs: 400 },
  },
  {
    id: 'center-title',
    name: 'Center Title',
    overlay: ({ prompt }) => ({
      content: prompt ?? 'Center callout',
      position: 'center',
      fontSize: 64,
      textColor: '#111111',
      bgColor: '#ffffff',
      bgOpacity: 90,
      fontWeight: '600',
    }),
    defaultTransition: { kind: 'crossfade', durationMs: 500 },
  },
  {
    id: 'emoji-hook',
    name: 'Emoji Hook',
    overlay: ({ prompt }) => ({
      content: prompt ? `${prompt} 🔥` : 'Must-see moment 🔥',
      position: 'top',
      fontSize: 42,
      textColor: '#ff9f0a',
      bgColor: '#111111',
      bgOpacity: 70,
      fontWeight: '700',
    }),
    defaultTransition: { kind: 'fadeOut', durationMs: 300 },
  },
];

export function getTemplatesById(templateIds: string[]): TemplateDef[] {
  const set = new Set(templateIds);
  return VARIATION_TEMPLATES.filter((template) => set.has(template.id));
}

