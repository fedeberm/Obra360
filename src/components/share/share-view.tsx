"use client";

import { useState } from "react";
import { Project, Floor, CameraPoint, PhotoVisit } from "@/types";
import { FloorPlanViewer } from "@/components/floor-plan/floor-plan-viewer";
import { Building2, MapPin, User, Layers, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

type FullFloor = Floor & { camera_points: (CameraPoint & { photo_visits: PhotoVisit[] })[] };

interface ShareViewProps {
  project: Project & { floors: FullFloor[] };
}

export function ShareView({ project }: ShareViewProps) {
  const [selectedFloor, setSelectedFloor] = useState<FullFloor | null>(
    project.floors?.[0] ?? null
  );

  const totalPoints = project.floors.reduce(
    (acc, f) => acc + (f.camera_points?.length ?? 0),
    0
  );
  const totalPhotos = project.floors.reduce(
    (acc, f) =>
      acc + f.camera_points?.reduce((a, p) => a + (p.photo_visits?.length ?? 0), 0),
    0
  );

  // Última actualización
  const lastUpdate = project.floors
    .flatMap((f) => f.camera_points?.flatMap((p) => p.photo_visits) ?? [])
    .sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime())[0];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header público */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            {/* Info del proyecto */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-xl">{project.name}</h1>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {project.client_name && (
                    <span className="text-sm text-slate-500 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {project.client_name}
                    </span>
                  )}
                  {project.address && (
                    <span className="text-sm text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {project.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-6 text-center flex-shrink-0">
              <div>
                <p className="text-2xl font-bold text-slate-900">{project.floors.length}</p>
                <p className="text-xs text-slate-500">Plantas</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalPoints}</p>
                <p className="text-xs text-slate-500">Puntos</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalPhotos}</p>
                <p className="text-xs text-slate-500">Fotos 360°</p>
              </div>
              {lastUpdate && (
                <>
                  <div className="w-px h-8 bg-slate-200" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{formatDate(lastUpdate.taken_at)}</p>
                    <p className="text-xs text-slate-500">Última visita</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 89px)" }}>
        {/* Selector de plantas */}
        {project.floors.length > 1 && (
          <div className="w-44 bg-white border-r p-3 flex flex-col gap-1 overflow-y-auto flex-shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
              Plantas
            </p>
            {project.floors.map((floor) => {
              const photosInFloor = floor.camera_points?.reduce(
                (acc, p) => acc + (p.photo_visits?.length ?? 0),
                0
              );
              return (
                <button
                  key={floor.id}
                  onClick={() => setSelectedFloor(floor)}
                  className={cn(
                    "text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                    selectedFloor?.id === floor.id
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <div className="truncate">{floor.name}</div>
                  <div className={cn(
                    "text-xs mt-0.5",
                    selectedFloor?.id === floor.id ? "text-blue-100" : "text-slate-400"
                  )}>
                    {floor.camera_points?.length ?? 0} puntos · {photosInFloor} fotos
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Visor del plano — solo lectura */}
        <div className="flex-1 overflow-hidden">
          {selectedFloor ? (
            <FloorPlanViewer
              floor={selectedFloor}
              projectId={project.id}
              isEditable={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <p className="text-sm">Sin plantas disponibles.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer de marca */}
      <div className="bg-white border-t py-3 text-center">
        <p className="text-xs text-slate-400">
          Seguimiento de obra con{" "}
          <span className="font-semibold text-primary">Obra360</span>
        </p>
      </div>
    </div>
  );
}
