import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/project/project-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
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
    .eq("id", id)
    .order("sort_order", { foreignTable: "floors" })
    .single();

  if (error || !project) notFound();

  // Ordenar puntos y visitas
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

  return <ProjectDetail project={projectWithOrder as any} />;
}
