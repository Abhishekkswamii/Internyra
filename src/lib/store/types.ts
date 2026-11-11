import type { VerificationCase } from "@/types/verification";
import type { ResearchReport } from "@/lib/research/types";

export type InspectionStatus = "pending_auth" | "queued" | "running" | "completed" | "failed";
export type InputKind = "link" | "message" | "document";

export interface InspectionSubmission {
  kind: InputKind;
  url?: string;
  normalizedUrl?: string;
  /** Raw pasted text. Removed once the inspection completes; only length and hash remain. */
  text?: string;
  textLength?: number;
  textHash?: string;
  claimedCompany?: string;
  claimedRole?: string;
  recruiterName?: string;
  recruiterEmail?: string;
}

export interface SafeError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface InspectionVersions {
  parser: string;
  prompt: string;
  schema: string;
}

export interface InspectionRecord {
  id: string;
  ownerUid: string;
  inputType: InputKind;
  status: InspectionStatus;
  submission: InspectionSubmission;
  /** Deterministic local-check report from the verification engine. */
  case?: VerificationCase;
  /** Validated AI research report. Present only after a real provider run or a cache reuse. */
  research?: ResearchReport;
  provider?: string;
  model?: string;
  providerStrategy?: string;
  fallbackOccurred?: boolean;
  fallbackReason?: string;
  webSearchUsed?: boolean;
  fromCache?: boolean;
  researchMs?: number;
  attempts: number;
  error?: SafeError;
  versions: InspectionVersions;
  createdAt: string;
  updatedAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  /** Run lease: a "running" record whose lease expired can be taken over. */
  leaseExpiresAt?: string;
}

export type BeginRunResult =
  | { ok: true; record: InspectionRecord }
  | { ok: false; reason: "not_found" | "not_runnable" | "already_running" };

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface UsageEvent {
  uid: string;
  type: "research" | "cache" | "rate_limit" | "provider_error" | "fetch";
  provider?: string;
  model?: string;
  cacheEvent?: "hit" | "miss" | "refresh" | "error";
  fallback?: boolean;
  webSearchUsed?: boolean;
  success?: boolean;
  code?: string;
  durationMs?: number;
  inspectionId?: string;
}

export interface AuditEvent {
  adminUid: string;
  action: string;
  targetUid?: string;
  detail?: string;
}

export interface UserSummary {
  uid: string;
  email?: string;
  provider?: string;
  createdAt: string;
  lastSeenAt?: string;
}

export interface AdminCounts {
  users: number;
  inspections: number;
  byStatus: Record<string, number>;
}

export class StorageUnavailableError extends Error {
  constructor() {
    super("Storage is not available");
    this.name = "StorageUnavailableError";
  }
}

export interface InspectionStore {
  createInspection(record: InspectionRecord): Promise<void>;
  getInspection(uid: string, id: string): Promise<InspectionRecord | null>;
  listInspections(uid: string, limit: number, cursor?: string | null): Promise<Page<InspectionRecord>>;
  deleteInspection(uid: string, id: string): Promise<boolean>;
  /** pending_auth -> queued. Idempotent for an already queued record. Null when not found / not eligible. */
  queueInspection(uid: string, id: string, now: string): Promise<InspectionRecord | null>;
  /** Moves a pending_auth record between owners atomically. Null when it does not exist or is not pending. */
  transferPending(fromUid: string, toUid: string, id: string, now: string): Promise<InspectionRecord | null>;
  /** Atomic queued|failed|stale-running -> running with a lease. */
  beginRun(uid: string, id: string, now: string, leaseMs: number): Promise<BeginRunResult>;
  finishRun(uid: string, id: string, patch: Partial<InspectionRecord>): Promise<void>;
  upsertUser(uid: string, data: { email?: string; provider?: string }, now: string): Promise<void>;
  /** Deletes the user's profile, inspections and jobs. Returns the number of inspections removed. */
  deleteUserData(uid: string): Promise<number>;
  /** Removes pending_auth records created before `cutoffIso`. Returns the owner UIDs affected. */
  deleteAbandoned(cutoffIso: string, limit: number): Promise<string[]>;
  recordUsage(event: UsageEvent, now: string): Promise<void>;
  recordAudit(event: AuditEvent, now: string): Promise<void>;

  adminCounts(): Promise<AdminCounts>;
  adminListUsers(limit: number, cursor?: string | null): Promise<Page<UserSummary>>;
  adminListInspections(limit: number, cursor?: string | null): Promise<Page<InspectionRecord>>;
  adminListUsage(limit: number, cursor?: string | null): Promise<Page<UsageEvent & { id: string; timestamp: string }>>;
  adminUsageTotals(): Promise<{ cache: Record<string, number>; providers: Record<string, number>; fallbacks: number; rateLimited: number }>;
}
