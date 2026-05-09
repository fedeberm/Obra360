"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CreateCameraPointForm } from "@/types";

export async function createCameraPoint(
  floorId: string,
  projectId: string,
  form: CreateCameraPointForm
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("camera_points")
    .insert({
      floor_id: floorId,
      name: form.name,
      description: form.description,
      x_percent: form.x_percent,
      y_percent: form.y_percent,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
  return data;
}

export async function savePhotoVisitRecord({
  pointId,
  projectId,
  photoUrl,
  photoFilename,
  photoSizeBytes,
  takenAt,
  notes,
}: {
  pointId: string;
  projectId: string;
  photoUrl: string;
  photoFilename: string;
  photoSizeBytes: number;
  takenAt: string;
  notes?: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("photo_visits")
    .insert({
      camera_point_id: pointId,
      photo_url: photoUrl,
      photo_filename: photoFilename,
      photo_size_bytes: photoSizeBytes,
      taken_at: takenAt,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
  return data;
}

export async function deletePhotoVisit(visitId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("photo_visits")
    .delete()
    .eq("id", visitId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
}
