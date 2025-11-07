import { NextResponse } from 'next/server';
import { IngestSourceDraft, SourceMetadata } from '@/types';
import { getIngestState, IngestPayload, toPublicIngestJob } from './shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOCK_PROXY_SOURCES = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
];

interface IngestRequestBody {
  connector?: string;
  assets?: Array<{
    externalId?: unknown;
    name?: unknown;
    checksum?: unknown;
    durationSec?: unknown;
    metadata?: unknown;
  }>;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { error: 'Provide a connector and at least one asset' },
      { status: 400 }
    );
  }

  const parsed = body as IngestRequestBody;
  if (!Array.isArray(parsed.assets) || parsed.assets.length === 0) {
    return NextResponse.json(
      { error: 'Provide a connector and at least one asset' },
      { status: 400 }
    );
  }

  const connector = (parsed.connector ?? 'mock') as IngestPayload['connector'];
  const assets = parsed.assets.map((asset) => ({
    externalId: typeof asset.externalId === 'string' ? asset.externalId : String(asset.externalId ?? ''),
    name: typeof asset.name === 'string' ? asset.name : 'New Asset',
    checksum: typeof asset.checksum === 'string' ? asset.checksum : String(asset.checksum ?? ''),
    durationSec: typeof asset.durationSec === 'number' ? asset.durationSec : Number(asset.durationSec ?? 0),
    metadata: sanitizeMetadata(asset.metadata),
  }));

  if (assets.some((asset) => !asset.externalId || !asset.checksum)) {
    return NextResponse.json(
      { error: 'Each asset must include externalId and checksum' },
      { status: 400 }
    );
  }

  const payload: IngestPayload = {
    connector,
    assets,
  };

  const state = getIngestState();
  const job = await state.queue.enqueue(payload);
  simulateIngestJob(job.id, payload, state);

  return NextResponse.json({ job: toPublicIngestJob(job) });
}

function sanitizeMetadata(input?: unknown): SourceMetadata | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = input as SourceMetadata;
  return {
    width: typeof value.width === 'number' ? value.width : undefined,
    height: typeof value.height === 'number' ? value.height : undefined,
    fps: typeof value.fps === 'number' ? value.fps : undefined,
    codecVideo: typeof value.codecVideo === 'string' ? value.codecVideo : undefined,
    codecAudio: typeof value.codecAudio === 'string' ? value.codecAudio : undefined,
    durationMs:
      typeof value.durationMs === 'number' ? value.durationMs : undefined,
  };
}

function simulateIngestJob(
  jobId: string,
  payload: IngestPayload,
  state: ReturnType<typeof getIngestState>
) {
  if (state.timers.has(jobId)) {
    clearInterval(state.timers.get(jobId));
  }

  let progress = 0;
  const drafts = createSourceDrafts(payload, state);

  const timer = setInterval(async () => {
    progress = Math.min(100, progress + 20 + Math.random() * 25);
    const updated = await state.queue.update(jobId, (job) => ({
      ...job,
      status: progress >= 100 ? 'completed' : 'processing',
      progress,
      result: progress >= 100 ? drafts : job.result,
    }));

    if (progress >= 100 && updated) {
      drafts
        .filter((draft) => !draft.isDuplicate && draft.checksum)
        .forEach((draft) => state.knownChecksums.add(draft.checksum));
      clearInterval(timer);
      state.timers.delete(jobId);
    }

  }, 900);

  state.timers.set(jobId, timer);
}

function createSourceDrafts(
  payload: IngestPayload,
  state: ReturnType<typeof getIngestState>
): IngestSourceDraft[] {
  return payload.assets.map((asset, index) => {
    const proxyUrl =
      MOCK_PROXY_SOURCES[index % MOCK_PROXY_SOURCES.length] +
      `?connector=${payload.connector}&asset=${asset.externalId}`;
    const checksum = asset.checksum;
    const isDuplicate = checksum ? state.knownChecksums.has(checksum) : false;

    return {
      externalId: asset.externalId,
      checksum,
      proxyUrl,
      fileName: `${asset.name.replace(/\\s+/g, '-').toLowerCase()}-${asset.externalId}.mp4`,
      name: asset.name,
      durationSec: asset.durationSec,
      metadata: asset.metadata ?? {
        durationMs: asset.durationSec * 1000,
      },
      isDuplicate,
    };
  });
}
