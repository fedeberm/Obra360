"use client";

import Link from "next/link";
import { Project } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2, ChevronRight, MapPin, User, Layers } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-green-100 text-green-700" },
  completed: { label: "Completado", color: "bg-blue-100 text-blue-700" },
  paused: { label: "Pausado", color: "bg-yellow-100 text-yellow-700" },
};

interface ProjectCardProps {
  project: Project & { floors?: { count: number }[] };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const status = statusLabels[project.status] ?? statusLabels.active;
  const floorCount = (project.floors as any)?.[0]?.count ?? 0;

  return (
    <Link href={`/dashboard/project/${project.id}`}>
      <Card className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full">
        {/* Cover */}
        <div className="h-36 bg-gradient-to-br from-slate-700 to-slate-900 rounded-t-lg flex items-center justify-center relative overflow-hidden">
          {project.cover_image_url ? (
            <img
              src={project.cover_image_url}
              alt={project.name}
              className="w-full h-full object-cover"
              style={{ objectPosition: project.cover_position ?? "50% 50%" }}
            />
          ) : (
            <Building2 className="w-12 h-12 text-slate-500" />
          )}
          <div className="absolute top-3 right-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 text-lg leading-tight group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            <ChevronRight className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0 group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {project.client_name && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{project.client_name}</span>
            </div>
          )}
          {project.address && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{project.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Layers className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{floorCount} planta{floorCount !== 1 ? "s" : ""}</span>
          </div>

          <div className="pt-2 text-xs text-slate-400 border-t mt-3">
            Actualizado {formatDate(project.updated_at)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
