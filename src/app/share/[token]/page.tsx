import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ShareView } from "@/components/share/share-view";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("projects")
    .select("name, client_name")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .single();

  if (!data) return { title: "Proyecto no encontrado - Obra360" };

  return {
    title: `${data.name} - Obra360`,
    description: data.client_name
      ? `Seguimiento de obra para ${data.client_name}`
      : "Seguimiento de avance de obra con fotos 360°",
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
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
    .order("sort_order", { foreignTable: "floors" })
    .single();

  if (error || !project) notFound();

  const projectWithOrder = {
    ...project,
    floors: project.floors?.map((floor: any) => ({
      ...floor,
      camera_points: floor.camera_points?.map((point: any) => ({
        ...point,
        photo_visits: point.photo_visits?.sort(
          (a: any, b: any) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
        ),
      })),
    })),
  };

  return <ShareView project={projectWithOrder as any} />;
}
