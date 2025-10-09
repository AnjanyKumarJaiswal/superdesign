export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobRecord = {
  id: string;
  status: JobStatus;
  result?: unknown;
  error?: string;
};

type Listener = (event: { type: JobStatus; job: JobRecord }) => void;

class JobManager {
  private jobs = new Map<string, JobRecord>();
  private listeners = new Map<string, Set<Listener>>();

  create(jobId: string) {
    const job: JobRecord = { id: jobId, status: "queued" };
    this.jobs.set(jobId, job);
    this.emit(jobId, { type: "queued", job });
    return job;
  }

  get(jobId: string) {
    return this.jobs.get(jobId);
  }

  on(jobId: string, listener: Listener) {
    if (!this.listeners.has(jobId)) this.listeners.set(jobId, new Set());
    this.listeners.get(jobId)!.add(listener);
    return () => this.listeners.get(jobId)!.delete(listener);
  }

  setStatus(jobId: string, status: JobStatus, data?: { result?: unknown; error?: string }) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = status;
    if (data?.result !== undefined) job.result = data.result;
    if (data?.error) job.error = data.error;
    this.emit(jobId, { type: status, job });
  }

  private emit(jobId: string, event: { type: JobStatus; job: JobRecord }) {
    const set = this.listeners.get(jobId);
    if (!set) return;
    for (const listener of set) listener(event);
  }
}

export const jobManager = new JobManager();


