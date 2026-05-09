import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/dashboard/project-card";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { Building2 } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, floors(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proyectos</h1>
          <p className="text-slate-500 mt-1">
            {projects?.length ?? 0} proyecto{projects?.length !== 1 ? "s" : ""} activo{projects?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {/* Grid de proyectos */}
      {!projects || projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Sin proyectos aún</h3>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Creá tu primer proyecto para empezar a gestionar el seguimiento de obra con fotos 360°.
          </p>
          <CreateProjectDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
