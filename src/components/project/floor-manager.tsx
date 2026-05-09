"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Project, Floor, CameraPoint, PhotoVisit } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createFloor, deleteFloor, uploadFloorPdf } from "@/lib/actions/floors";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, FileText, Loader2, Eye, Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type FullFloor = Floor & { camera_points: (CameraPoint & { photo_visits: PhotoVisit[] })[] };

interface FloorManagerProps {
  project: Project & { floors: FullFloor[] };
  onFloorSelect: (floor: FullFloor) => void;
}

export function FloorManager({ project, onFloorSelect }: FloorManagerProps) {
  const router = useRouter();
  const [creatingFloor, setCreatingFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");
  const [uploadingPdfFor, setUploadingPdfFor] = useState<string | null>(null);
  const [deletingFloor, setDeletingFloor] = useState<string | null>(null);

  async function handleCreateFloor() {
    if (!newFloorName.trim()) return;
    setCreatingFloor(true);
    try {
      await createFloor(project.id, { name: newFloorName });
      toast({ title: "Planta creada", description: `"${newFloorName}" agregada al proyecto.` });
      setNewFloorName("");
      router.refresh();
    } catch {
      toast({ title: "Error", description: "No se pudo crear la planta.", variant: "destructive" });
    } finally {
      setCreatingFloor(false);
    }
  }

  async function handleDeleteFloor(floorId: string, floorName: string) {
    if (!confirm(`¿Eliminar la planta "${floorName}" y todos sus puntos?`)) return;
    setDeletingFloor(floorId);
    try {
      await deleteFloor(floorId, project.id);
      toast({ title: "Planta eliminada" });
      router.refresh();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar la planta.", variant: "destructive" });
    } finally {
      setDeletingFloor(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Gestionar plantas</h2>
        <p className="text-slate-500 text-sm">
          Cada planta tiene su propio plano PDF y puntos de cámara 360°.
        </p>
      </div>

      {/* Crear nueva planta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva planta / sector</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Ej: Planta Baja, Nivel 01, Terraza..."
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFloor()}
              className="flex-1"
            />
            <Button
              onClick={handleCreateFloor}
              disabled={creatingFloor || !newFloorName.trim()}
            >
              {creatingFloor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de plantas */}
      {project.floors.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay plantas. Creá una arriba.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {project.floors.map((floor) => (
            <FloorRow
              key={floor.id}
              floor={floor as FullFloor}
              projectId={project.id}
              onView={() => onFloorSelect(floor as FullFloor)}
              onDelete={() => handleDeleteFloor(floor.id, floor.name)}
              isDeleting={deletingFloor === floor.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FloorRow({
  floor, projectId, onView, onDelete, isDeleting
}: {
  floor: FullFloor;
  projectId: string;
  onView: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(floor.name);
  const [savingName, setSavingName] = useState(false);

  async function handleSaveName() {
    if (!editName.trim() || editName === floor.name) { setEditing(false); return; }
    setSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("floors").update({ name: editName }).eq("id", floor.id);
      if (error) throw new Error(error.message);
      toast({ title: "Nombre actualizado" });
      router.refresh();
      setEditing(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadFloorPdf(floor.id, projectId, file);
      toast({ title: "PDF subido", description: `Plano "${file.name}" cargado correctamente.` });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo subir el PDF.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [floor.id, projectId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {editing ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setEditing(false); setEditName(floor.name); } }}
                    className="h-7 text-sm font-semibold w-48"
                    autoFocus
                  />
                  <button onClick={handleSaveName} disabled={savingName} className="text-green-600 hover:text-green-700 p-0.5">
                    {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { setEditing(false); setEditName(floor.name); }} className="text-slate-400 hover:text-slate-600 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 group"
                >
                  <h3 className="font-semibold text-slate-900">{floor.name}</h3>
                  <Pencil className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </button>
              )}
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {floor.camera_points?.length ?? 0} punto{(floor.camera_points?.length ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
            {floor.pdf_filename && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {floor.pdf_filename}
              </p>
            )}
          </div>

          {/* Upload PDF */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg px-4 py-2.5 text-center cursor-pointer transition-colors min-w-[160px]",
              isDragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary hover:bg-slate-50",
              uploading && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Subiendo...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Upload className="w-4 h-4" />
                {floor.pdf_url ? "Reemplazar PDF" : "Subir plano PDF"}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onView} disabled={!floor.pdf_url}>
              <Eye className="w-3.5 h-3.5 mr-1" />
              Ver plano
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
