export interface Classification {
  framework: string;
  severity: string;
  urgency: string;
  confidence: string;
  affected_provisions: string[];
}

export interface Publication {
  publication_id: string;
  title: string;
  pub_date: string | null;
  doc_type: string;
  source: string;
  classification: Classification;
  status: string;
  ingested_at: string | null;
  summary: string;
}

export interface PolicySection {
  id: string;
  title: string;
  text: string;
  reg_refs: string[];
  tasks?: Task[];
}

export interface Policy {
  policy_id: string;
  title: string;
  doc_type: string;
  frameworks: string[];
  reg_refs: string[];
  sections: PolicySection[];
  status: string;
  open_task_count: number;
}

export interface Task {
  task_id: string;
  publication_id: string;
  policy_id: string;
  policy_section_id: string;
  section_title: string;
  change_type: string;
  action_text: string;
  severity: string;
  deadline: string | null;
  status: string;
  owner: string;
  created_at: string | null;
}

export interface PipelineStatus {
  queues: Record<string, { pending: number; processing: number; done: number; failed: number }>;
  last_ingestion: string | null;
}
