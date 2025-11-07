import { NextResponse } from 'next/server';
import { AISuggestedClip } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LABELS = ['Highlight', 'Quote', 'Reaction', 'Hook'] as const;

interface ShotMinerRequest {
  sourceId?: string;
  proxyUrl?: string;
  mode?: 'fast' | 'quality';
}

export async function POST(request: Request) {
  let payload: ShotMinerRequest | null = null;
  try {
    payload = (await request.json()) as ShotMinerRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const sourceId = payload?.sourceId;
  const proxyUrl = payload?.proxyUrl;

  if (!sourceId || !proxyUrl) {
    return NextResponse.json(
      { error: 'sourceId and proxyUrl are required' },
      { status: 400 }
    );
  }

  const suggestions = buildSuggestions(sourceId, payload?.mode);
  return NextResponse.json({ suggestions });
}

function buildSuggestions(sourceId: string, mode: 'fast' | 'quality' = 'fast') {
  const baseCount = mode === 'quality' ? 5 : 3;
  const suggestions: AISuggestedClip[] = [];
  let cursor = 5;

  for (let i = 0; i < baseCount; i += 1) {
    const duration = 8 + Math.round(Math.random() * 6);
    const start = cursor;
    const end = start + duration;
    cursor = end + 4;
    const label = LABELS[i % LABELS.length];
    const id = `suggest-${sourceId}-${Date.now()}-${i}`;

    suggestions.push({
      id,
      sourceId,
      confidence: Number((0.6 + Math.random() * 0.35).toFixed(2)),
      label,
      summary: `${label} between ${formatSeconds(start)} and ${formatSeconds(end)}`,
      tags: [label.toLowerCase()],
      segments: [
        {
          start,
          end,
          sourceId,
          ai: {
            confidence: Number((0.6 + Math.random() * 0.35).toFixed(2)),
            tags: [label.toLowerCase()],
            summary: `Detected ${label.toLowerCase()} moment`,
          },
        },
      ],
    });
  }

  return suggestions;
}

function formatSeconds(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
