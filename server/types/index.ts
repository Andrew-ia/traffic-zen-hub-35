/**
 * Type definitions for the server API
 */

export interface MetaCredentials {
  appId: string;
  appSecret: string;
  accessToken: string;
  adAccountId: string;
}

export interface SyncJobParameters {
  days: number;
  type: 'all' | 'campaigns' | 'metrics';
}

export interface SyncJobData {
  jobId: string;
  workspaceId: string;
  platformKey: string;
  parameters: SyncJobParameters;
  credentials: MetaCredentials;
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface SyncJob {
  id: string;
  workspace_id: string;
  platform_key: string;
  job_type: string;
  status: JobStatus;
  progress: number;
  parameters: SyncJobParameters;
  result?: any;
  error_message?: string;
  error_details?: any;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationCredential {
  id: string;
  workspace_id: string;
  platform_key: string;
  encrypted_credentials: string;
  encryption_iv: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SyncJobResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  message: string;
}

export interface SyncJobStatusResponse extends SyncJobResponse {
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}
