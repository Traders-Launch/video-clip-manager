import {
  createMemoryQueue,
  QueueDriver,
  QueueJob,
} from '@/lib/server/queue';
import { RenderJob } from '@/types';

interface RenderPayload {
  variationIds: string[];
}

interface RenderResult {
  outputUrls: string[];
}

type RenderState = {
  queue: QueueDriver<RenderPayload, RenderResult>;
  timers: Map<string, NodeJS.Timeout>;
};

const globalRef =
  globalThis as typeof globalThis & { __renderState?: RenderState };

export function getRenderState(): RenderState {
  if (!globalRef.__renderState) {
    globalRef.__renderState = {
      queue: createMemoryQueue<RenderPayload, RenderResult>(),
      timers: new Map(),
    };
  }
  return globalRef.__renderState;
}

export type { RenderPayload, RenderResult };

export function toPublicRenderJob(
  job: QueueJob<RenderPayload, RenderResult>
): RenderJob {
  return {
    id: job.id,
    variationIds: job.payload.variationIds,
    status: job.status,
    progress: Math.round(job.progress),
    submittedAt: job.createdAt,
    updatedAt: job.updatedAt,
    outputUrls: job.result?.outputUrls,
    error: job.error,
  };
}

