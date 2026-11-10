// Shapes of the Supabase tables the dashboard reads and writes (see supabase/schema.sql).

export const JOB_STATUSES = ['new', 'saved', 'applied', 'interview', 'offer', 'rejected', 'skipped'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const NOT_APPLIED: JobStatus[] = ['new', 'saved'];
export const APPLIED: JobStatus[] = ['applied', 'interview', 'offer', 'rejected'];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  new: 'New',
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  skipped: 'Skipped',
};

export const MANUAL_STATUSES = ['applied', 'viewed', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn'] as const;
export type ManualStatus = (typeof MANUAL_STATUSES)[number];
// Nothing more to follow up once an application is in one of these.
export const MANUAL_CLOSED: ManualStatus[] = ['offer', 'rejected', 'ghosted', 'withdrawn'];

export const PLATFORMS = ['LinkedIn', 'Upwork', 'Indeed', 'company site', 'referral', 'other'] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface ScoreBreakdown {
  total?: number;
  points?: { title?: number; skills?: number; location?: number; job_type?: number; industry?: number };
  matched?: { title?: string[]; skills?: string[]; industry?: string[]; job_type?: string[] };
  excluded?: string[];
  location_reason?: string;
  job_type?: string | null;
}

export interface Job {
  id: string;
  search_profile_id: string | null;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  location_scope: 'worldwide' | 'region' | 'restricted' | 'unknown';
  description: string | null;
  source: string;
  posted_at: string | null;
  found_at: string;
  match_score: number;
  score_breakdown: ScoreBreakdown;
  status: JobStatus;
  applied_at: string | null;
  notes: string | null;
}

export interface ManualApplication {
  id: string;
  company: string;
  role_title: string;
  platform: Platform;
  job_url: string | null;
  date_applied: string;
  status: ManualStatus;
  pay_or_rate: string | null;
  contact_name: string | null;
  contact_email: string | null;
  cv_version: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchProfile {
  id: string;
  name: string;
  alert_score: number;
  save_score: number;
  is_active: boolean;
}
