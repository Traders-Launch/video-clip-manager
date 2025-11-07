import { randomUUID } from 'crypto';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface QueueJob<TPayload, TResult = unknown> {
  id: string;
  payload: TPayload;
  status: JobStatus;
  progress: number;
  result?: TResult;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface QueueDriver<TPayload, TResult = unknown> {
  enqueue(payload: TPayload): Promise<QueueJob<TPayload, TResult>>;
  get(id: string): Promise<QueueJob<TPayload, TResult> | null>;
  list(): Promise<Array<QueueJob<TPayload, TResult>>>;
  update(
    id: string,
    updater: (job: QueueJob<TPayload, TResult>) => QueueJob<TPayload, TResult>
  ): Promise<QueueJob<TPayload, TResult> | null>;
}

export function createMemoryQueue<TPayload, TResult = unknown>(): QueueDriver<
  TPayload,
  TResult
> {
  const store = new Map<string, QueueJob<TPayload, TResult>>();

  const clone = (job: QueueJob<TPayload, TResult>): QueueJob<TPayload, TResult> => ({
    ...job,
    payload: job.payload,
    result: job.result,
  });

  const enqueue = async (payload: TPayload) => {
    const now = Date.now();
    const job: QueueJob<TPayload, TResult> = {
      id: randomUUID(),
      payload,
      status: 'queued',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.set(job.id, job);
    return clone(job);
  };

  const get = async (id: string) => {
    const job = store.get(id);
    return job ? clone(job) : null;
  };

  const list = async () => {
    return Array.from(store.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(clone);
  };

  const update = async (
    id: string,
    updater: (job: QueueJob<TPayload, TResult>) => QueueJob<TPayload, TResult>
  ) => {
    const job = store.get(id);
    if (!job) return null;

    const updated = updater({ ...job });
    updated.updatedAt = Date.now();
    store.set(id, updated);
    return clone(updated);
  };

  return {
    enqueue,
    get,
    list,
    update,
  };
}

