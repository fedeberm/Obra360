"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { CameraPoint, PhotoVisit } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatFileSize } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { deletePhotoVisit } from "@/lib/actions/camera-points";
import { createClient } from "@/lib/supabase/client";
import {
  X, Upload, Camera, Calendar, Eye, Trash2,
  Loader2, ChevronDown, ChevronUp, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type FullPoint = CameraPoint & { photo_visits: PhotoVisit[] };

interface PointInfoPanelProps {
  point: FullPoint;
  projectId: string;
  isEditable: boolean;
  onClose: () => void;
  onViewPhoto: (visit: PhotoVisit) => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export function PointInfoPanel({
  point, projectId, isEditable, onClose, onViewPhoto,
  onDelete, onRefresh,
}: PointInfoPanelProps) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingVisit, setDeletingVisit] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) setSelectedFile(files[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    disabled: uploading,
  });

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const timestamp = Date.now();
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `${timestamp}.${fileExt}`;

      const { error: storageError } = await supabase.storage
        .from("photos360")
        .upload(filePath, selectedFile, { upsert: true });

      if (storageError) throw new Error(`Storage: ${storageError.message}`);


      const { data: { publicUrl } } = supabase.storage
        .from("photos360")
        .getPublicUrl(filePath);

      // 2. Guardar el registro en la DB directamente desde el cliente
      const { error: dbError } = await supabase
        .from("photo_visits")
        .insert({
          camera_point_id: point.id,
          photo_url: publicUrl,
          photo_filename: selectedFile.name,
          photo_size_bytes: selectedFile.size,
          taken_at: takenAt,
          notes: notes || null,
        });

      if (dbError) throw new Error(`DB: ${dbError.message}`);

      toast({ title: "Foto subida", description: `Visita del ${formatDate(takenAt)} guardada.` });
      setShowUpload(false);
      setSelectedFile(null);
      setNotes("");
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error al subir", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteVisit(visitId: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    setDeletingVisit(visitId);
    try {
      await deletePhotoVisit(visitId, projectId);
      toast({ title: "Foto eliminada" });
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setDeletingVisit(null);
    }
  }

  const visits = point.photo_visits ?? [];
  const latestVisit = visits[0];

  return (
    <div className="w-80 bg-white border-l flex flex-col h-full overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{point.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {visits.length} visita{visits.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {isEditable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Foto más reciente */}
      {latestVisit && (
        <div className="flex-shrink-0">
          <div
            className="relative cursor-pointer group"
            onClick={() => onViewPhoto(latestVisit)}
          >
            <img
              src={latestVisit.photo_url}
              alt="Vista 360"
              className="w-full h-44 object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                <Eye className="w-5 h-5 text-slate-800" />
              </div>
            </div>
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1.5">
              <Camera className="w-3 h-3" />
              {formatDate(latestVisit.taken_at)} · Última visita
            </div>
          </div>
        </div>
      )}

      {/* Body scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Upload nueva foto */}
        {isEditable && (
          <div className="p-4 border-b">
            {!showUpload ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowUpload(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Subir nueva foto 360°
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Nueva visita</p>
                  <button
                    onClick={() => { setShowUpload(false); setSelectedFile(null); }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300",
                    selectedFile && "border-green-300 bg-green-50"
                  )}
                >
                  <input {...getInputProps()} />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <Camera className="w-5 h-5 text-green-600 mx-auto" />
                      <p className="text-xs font-medium text-green-700 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                      <p className="text-xs text-slate-500">Arrastrá o hacé clic<br />para subir foto 360°</p>
                    </div>
                  )}
                </div>

                {/* Fecha */}
                <div className="space-y-1">
                  <Label className="text-xs">Fecha de la visita</Label>
                  <Input
                    type="date"
                    value={takenAt}
                    onChange={(e) => setTakenAt(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Notas */}
                <div className="space-y-1">
                  <Label className="text-xs">Notas (opcional)</Label>
                  <textarea
                    className="w-full border rounded-md px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={2}
                    placeholder="Observaciones de la visita..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  size="sm"
                >
                  {uploading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Subiendo...</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5 mr-1.5" /> Guardar visita</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Historial de visitas */}
        <div className="p-4">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center justify-between w-full text-sm font-medium text-slate-700 mb-3"
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Historial de visitas
            </span>
            {historyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {historyExpanded && (
            <div className="space-y-2">
              {visits.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No hay fotos aún. Subí la primera visita.
                </p>
              ) : (
                visits.map((visit, index) => (
                  <div
                    key={visit.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-slate-50 transition-colors group"
                  >
                    {/* Thumbnail */}
                    <img
                      src={visit.photo_url}
                      alt=""
                      className="w-12 h-10 object-cover rounded-md flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-slate-700">
                          {formatDate(visit.taken_at)}
                        </span>
                        {index === 0 && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full">
                            Última
                          </span>
                        )}
                      </div>
                      {visit.notes && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{visit.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewPhoto(visit)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500"
                        title="Ver 360°"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {isEditable && (
                        <button
                          onClick={() => handleDeleteVisit(visit.id)}
                          className="p-1 rounded hover:bg-red-100 text-red-400"
                          title="Eliminar"
                          disabled={deletingVisit === visit.id}
                        >
                          {deletingVisit === visit.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
