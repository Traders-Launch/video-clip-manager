import {
  AISuggestedClip,
  Clip,
  IngestJob,
  IngestSourceDraft,
  RenderJob,
  VariationSet,
} from '@/types';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await safeParseError(response);
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function safeParseError(response: Response) {
  try {
    const payload = await response.json();
    if (payload?.error) return String(payload.error);
  } catch {
    /* noop */
  }
  return `Request failed with status ${response.status}`;
}

export async function listMockConnectorAssets(): Promise<{
  assets: Array<{
    externalId: string;
    name: string;
    checksum: string;
    durationSec: number;
  }>;
}> {
  const res = await fetch('/api/connectors/mock', { method: 'GET' });
  return handleResponse(res);
}

export async function createIngestJob(payload: {
  connector: 'mock';
  assets: Array<{
    externalId: string;
    name: string;
    checksum: string;
    durationSec: number;
  }>;
}): Promise<{ job: IngestJob }> {
  const res = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function getIngestJob(
  jobId: string
): Promise<{ job: IngestJob & { result?: IngestSourceDraft[] }; sourceDrafts?: IngestSourceDraft[] }> {
  const res = await fetch(`/api/ingest/${jobId}`, { method: 'GET' });
  return handleResponse(res);
}

export async function runShotMiner(input: {
  sourceId: string;
  proxyUrl: string;
  mode?: 'fast' | 'quality';
}): Promise<{ suggestions: AISuggestedClip[] }> {
  const res = await fetch('/api/ai/shot-miner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function generateVariations(input: {
  clip: Clip;
  prompt?: string;
  templateIds: string[];
  count?: number;
}): Promise<{ variationSet: VariationSet }> {
  const res = await fetch('/api/ai/variations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function createRenderJob(input: {
  variationIds: string[];
}): Promise<{ job: RenderJob }> {
  const res = await fetch('/api/render/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function getRenderJob(id: string): Promise<{ job: RenderJob }> {
  const res = await fetch(`/api/render/jobs/${id}`, { method: 'GET' });
  return handleResponse(res);
}

export async function listRenderJobs(): Promise<{ jobs: RenderJob[] }> {
  const res = await fetch('/api/render/jobs', { method: 'GET' });
  return handleResponse(res);
}

