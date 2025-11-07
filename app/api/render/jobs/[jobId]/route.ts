import { NextResponse } from 'next/server';
import { getRenderState, toPublicRenderJob } from '../shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ jobId: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const resolvedParams = await params;
  const jobId = resolvedParams?.jobId;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
  }

  const state = getRenderState();
  const job = await state.queue.get(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    job: toPublicRenderJob(job),
  });
}
