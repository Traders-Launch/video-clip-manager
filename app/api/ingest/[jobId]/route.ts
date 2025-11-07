import { NextResponse } from 'next/server';
import { IngestSourceDraft } from '@/types';
import { getIngestState, toPublicIngestJob } from '../shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
  }

  const state = getIngestState();
  const job = await state.queue.get(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const sourceDrafts =
    job.status === 'completed' && Array.isArray(job.result)
      ? (job.result as IngestSourceDraft[])
      : undefined;

  return NextResponse.json({
    job: toPublicIngestJob(job),
    sourceDrafts,
  });
}
