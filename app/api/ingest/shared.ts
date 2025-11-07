import {
  createMemoryQueue,
  QueueDriver,
  QueueJob,
} from '@/lib/server/queue';
import {
  ConnectorType,
  IngestJob,
  IngestSourceDraft,
  SourceId,
  SourceMetadata,
} from '@/types';

export interface IngestAssetInput {
  externalId: string;
  name: string;
  checksum: string;
  durationSec: number;
  metadata?: SourceMetadata;
}

export interface IngestPayload {
  connector: ConnectorType;
  assets: IngestAssetInput[];
}

type IngestState = {
  queue: QueueDriver<IngestPayload, IngestSourceDraft[]>;
  knownChecksums: Set<string>;
  timers: Map<string, NodeJS.Timeout>;
};

const globalRef =
  globalThis as typeof globalThis & { __ingestState?: IngestState };

export function getIngestState(): IngestState {
  if (!globalRef.__ingestState) {
    globalRef.__ingestState = {
      queue: createMemoryQueue<IngestPayload, IngestSourceDraft[]>(),
      knownChecksums: new Set(),
      timers: new Map(),
    };
  }
  return globalRef.__ingestState;
}

export function toPublicIngestJob(
  job: QueueJob<IngestPayload, IngestSourceDraft[]>
): IngestJob {
  const sourceIds: SourceId[] =
    job.result?.map((draft) => draft.externalId as SourceId) ?? [];

  return {
    id: job.id,
    connector: job.payload.connector,
    sourceIds,
    status: job.status,
    progress: Math.round(job.progress),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    details: `${job.payload.assets.length} asset(s)`,
    error: job.error,
  };
}
