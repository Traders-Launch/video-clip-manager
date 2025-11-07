import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { Clip, TextOverlay, Variation, VariationSet } from '@/types';
import {
  getTemplatesById,
  TemplateDef,
  VARIATION_TEMPLATES,
} from '@/lib/variations/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface VariationRequestBody {
  clip?: Clip;
  prompt?: string;
  templateIds?: string[];
  count?: number;
}

export async function POST(request: Request) {
  let payload: VariationRequestBody;
  try {
    payload = (await request.json()) as VariationRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!payload?.clip || typeof payload.clip !== 'object') {
    return NextResponse.json({ error: 'Clip payload is required' }, { status: 400 });
  }

  const templateCandidates =
    payload.templateIds && payload.templateIds.length
      ? getTemplatesById(payload.templateIds)
      : VARIATION_TEMPLATES;

  if (!templateCandidates.length) {
    return NextResponse.json(
      { error: 'No matching templates found for the supplied ids' },
      { status: 400 }
    );
  }

  const count = Math.max(1, Math.min(payload.count ?? 1, 4));
  const variations = buildVariations(payload.clip, payload.prompt, templateCandidates, count);

  const variationSet: VariationSet = {
    clipId: payload.clip.id,
    items: variations,
    createdAt: Date.now(),
    prompt: payload.prompt,
  };

  return NextResponse.json({ variationSet });
}

function buildVariations(
  clip: Clip,
  prompt: string | undefined,
  templates: TemplateDef[],
  count: number
): Variation[] {
  const variations: Variation[] = [];

  templates.forEach((template) => {
    for (let i = 0; i < count; i += 1) {
      const overlay = template.overlay({ prompt, base: clip.textOverlay });
      const nudgedOverlay = nudgeOverlay(overlay, i);
      variations.push({
        id: `${template.id}-${randomUUID()}`,
        clipId: clip.id,
        templateId: template.id,
        prompt,
        overlay: nudgedOverlay,
        transition: template.defaultTransition,
        status: 'draft',
      });
    }
  });

  return variations;
}

function nudgeOverlay(overlay: TextOverlay, iteration: number): TextOverlay {
  const delta = (iteration % 2 === 0 ? 1 : -1) * 4;
  const opacityDelta = iteration % 3 === 0 ? 5 : -5;

  return {
    ...overlay,
    fontSize: Math.max(28, overlay.fontSize + delta),
    bgOpacity: Math.min(100, Math.max(overlay.bgOpacity + opacityDelta, 20)),
  };
}
