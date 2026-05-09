"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CreateProjectForm } from "@/types";

export async function getProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, floors(count)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      floors (
        *,
        camera_points (
          *,
          photo_visits (
            id, taken_at, photo_url, notes, created_at
          )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProjectByShareToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      floors (
        *,
        camera_points (
          *,
          photo_visits (
            id, taken_at, photo_url, notes, created_at
          )
        )
      )
    `)
    .eq("share_token", token)
    .eq("share_enabled", true)
    .single();

  if (error) return null;
  return data;
}

export async function createProject(form: CreateProjectForm) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      ...form,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return data;
}

export async function updateProject(id: string, form: Partial<CreateProjectForm> & { status?: string; share_enabled?: boolean }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(form)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/project/${id}`);
  return data;
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function regenerateShareToken(id: string) {
  const supabase = await createClient();
  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data, error } = await supabase
    .from("projects")
    .update({ share_token: newToken })
    .eq("id", id)
    .select("share_token")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${id}`);
  return data.share_token;
}
