import { NextResponse } from 'next/server';
import {
  getRenderState,
  RenderPayload,
  RenderResult,
  toPublicRenderJob,
} from './shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RenderJobRequest {
  variationIds?: unknown;
}

export async function POST(request: Request) {
  let body: RenderJobRequest | null = null;
  try {
    body = (await request.json()) as RenderJobRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const variationIds = Array.isArray(body?.variationIds)
    ? (body.variationIds as unknown[]).filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    : [];

  if (!variationIds.length) {
    return NextResponse.json(
      { error: 'Provide at least one variation id' },
      { status: 400 }
    );
  }

  const payload: RenderPayload = { variationIds };
  const state = getRenderState();
  const job = await state.queue.enqueue(payload);
  simulate(job.id, payload, state);

  return NextResponse.json({ job: toPublicRenderJob(job) });
}

export async function GET() {
  const state = getRenderState();
  const jobs = await state.queue.list();
  return NextResponse.json({ jobs: jobs.map(toPublicRenderJob) });
}

function simulate(
  jobId: string,
  payload: RenderPayload,
  state: ReturnType<typeof getRenderState>
) {
  if (state.timers.has(jobId)) {
    clearInterval(state.timers.get(jobId));
  }

  let progress = 0;
  const output = buildOutput(payload.variationIds);

  const timer = setInterval(async () => {
    progress = Math.min(100, progress + 15 + Math.random() * 20);
    await state.queue.update(jobId, (job) => ({
      ...job,
      status: progress >= 100 ? 'completed' : 'processing',
      progress,
      result: progress >= 100 ? output : job.result,
    }));
    if (progress >= 100) {
      clearInterval(timer);
      state.timers.delete(jobId);
    }
  }, 1000);

  state.timers.set(jobId, timer);
}

function buildOutput(variationIds: string[]): RenderResult {
  return {
    outputUrls: variationIds.map(
      (id, index) =>
        `https://placehold.co/640x360?text=${encodeURIComponent(
          `Variation ${index + 1}`
        )}-${encodeURIComponent(id.slice(0, 6))}`
    ),
  };
}
