export type UserRole = "admin" | "architect";
export type ProjectStatus = "active" | "completed" | "paused";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  client_name: string | null;
  client_email: string | null;
  status: ProjectStatus;
  cover_image_url: string | null;
  cover_position: string | null;
  share_token: string;
  share_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  floors?: Floor[];
}

export interface Floor {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  pdf_url: string | null;
  pdf_filename: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Relations
  camera_points?: CameraPoint[];
}

export interface CameraPoint {
  id: string;
  floor_id: string;
  name: string;
  description: string | null;
  x_percent: number;
  y_percent: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Relations
  photo_visits?: PhotoVisit[];
  latest_visit?: PhotoVisit | null;
}

export interface PhotoVisit {
  id: string;
  camera_point_id: string;
  photo_url: string;
  photo_filename: string | null;
  photo_size_bytes: number | null;
  taken_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// Forms
export interface CreateProjectForm {
  name: string;
  description?: string;
  address?: string;
  client_name?: string;
  client_email?: string;
  cover_image_url?: string;
}

export interface CreateFloorForm {
  name: string;
  description?: string;
  sort_order?: number;
}

export interface CreateCameraPointForm {
  name: string;
  description?: string;
  x_percent: number;
  y_percent: number;
}

export interface CreatePhotoVisitForm {
  taken_at: string;
  notes?: string;
  file: File;
}
