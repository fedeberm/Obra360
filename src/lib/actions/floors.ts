"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CreateFloorForm } from "@/types";

export async function createFloor(projectId: string, form: CreateFloorForm) {
  const supabase = await createClient();

  // Calcular sort_order
  const { count } = await supabase
    .from("floors")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { data, error } = await supabase
    .from("floors")
    .insert({
      project_id: projectId,
      name: form.name,
      description: form.description,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
  return data;
}

export async function updateFloor(floorId: string, projectId: string, form: Partial<CreateFloorForm>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("floors")
    .update(form)
    .eq("id", floorId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
  return data;
}

export async function uploadFloorPdf(
  floorId: string,
  projectId: string,
  file: File
) {
  const supabase = await createClient();

  const fileExt = file.name.split(".").pop();
  const filePath = `${projectId}/${floorId}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("pdfs")
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data: { publicUrl } } = supabase.storage
    .from("pdfs")
    .getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("floors")
    .update({
      pdf_url: publicUrl,
      pdf_filename: file.name,
    })
    .eq("id", floorId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/dashboard/project/${projectId}`);
  return publicUrl;
}

export async function deleteFloor(floorId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("floors").delete().eq("id", floorId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
}

export async function reorderFloors(projectId: string, floorIds: string[]) {
  const supabase = await createClient();

  const updates = floorIds.map((id, index) =>
    supabase.from("floors").update({ sort_order: index }).eq("id", id)
  );

  await Promise.all(updates);
  revalidatePath(`/dashboard/project/${projectId}`);
}
