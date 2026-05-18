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

export interface GridCalibration {
  opacity: number;
  /**
   * Estimated perpendicular distance (meters) from camera to the calibrated plane.
   * Formula: D = physicalSize / (2 * tan(angularDist / 2))
   *
   * Measurement uses azimuth correction:
   *   D_eff = D / cos(yaw_meas − yaw_calib)
   *   meters = 2 * D_eff * tan(angDist / 2)
   *
   * This keeps height measurements consistent across the same wall.
   */
  distanceH?: number;  // D from horizontal calibration
  yawH?: number;       // camera yaw at time of horizontal calibration (radians)
  distanceV?: number;  // D from vertical calibration
  yawV?: number;       // camera yaw at time of vertical calibration (radians)
  // Legacy fields (kept for JSON compat only)
  metersPerRadH?: number;
  metersPerRadV?: number;
  metersPerRad?: number;
  cellSizeMeters?: number;
  anchorYaw?: number;
  anchorPitch?: number;
  pixelsPerMeter?: number;
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
  grid_calibration: GridCalibration | null;
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
