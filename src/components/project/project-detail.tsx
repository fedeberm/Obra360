"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Project, Floor, CameraPoint, PhotoVisit } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloorPlanViewer } from "@/components/floor-plan/floor-plan-viewer";
import { FloorManager } from "@/components/project/floor-manager";
import { SharePanel } from "@/components/project/share-panel";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Share2, Layers, Settings, ImageIcon, Upload, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ProjectDetailProps {
  project: Project & {
    floors: (Floor & {
      camera_points: (CameraPoint & { photo_visits: PhotoVisit[] })[];
    })[];
  };
}

type Tab = "planos" | "ajustes" | "compartir";

const FOCAL_POINTS = [
  { label: "↖", value: "0% 0%" },
  { label: "↑", value: "50% 0%" },
  { label: "↗", value: "100% 0%" },
  { label: "←", value: "0% 50%" },
  { label: "·", value: "50% 50%" },
  { label: "→", value: "100% 50%" },
  { label: "↙", value: "0% 100%" },
  { label: "↓", value: "50% 100%" },
  { label: "↘", value: "100% 100%" },
];

export function ProjectDetail({ project }: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("planos");
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(
    project.floors?.[0]?.id ?? null
  );
  const router = useRouter();

  // Cover state
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUrl, setCoverUrl] = useState(project.cover_image_url);
  const [coverPosition, setCoverPosition] = useState(project.cover_position ?? "50% 50%");
  const [savingPosition, setSavingPosition] = useState(false);

  // Project form state
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    address: project.address ?? "",
    client_name: project.client_name ?? "",
    client_email: project.client_email ?? "",
  });
  const [savingForm, setSavingForm] = useState(false);

  const selectedFloor = project.floors.find((f) => f.id === selectedFloorId) ?? project.floors[0] ?? null;

  // Cover upload
  const onDropCover = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    const file = files[0];
    setUploadingCover(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `covers/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage.from("photos360").upload(path, file, { upsert: true });
      if (storageError) throw new Error(storageError.message);
      const { data: { publicUrl } } = supabase.storage.from("photos360").getPublicUrl(path);
      const { error: dbError } = await supabase.from("projects").update({ cover_image_url: publicUrl }).eq("id", project.id);
      if (dbError) throw new Error(dbError.message);
      setCoverUrl(publicUrl);
      toast({ title: "Portada actualizada" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingCover(false);
    }
  }, [project.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropCover,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    disabled: uploadingCover,
  });

  // Save focal point
  async function handleSavePosition(pos: string) {
    setCoverPosition(pos);
    setSavingPosition(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("projects").update({ cover_position: pos }).eq("id", project.id);
      if (error) throw new Error(error.message);
    } catch (err: any) {
      toast({ title: "Error al guardar posición", description: err.message, variant: "destructive" });
    } finally {
      setSavingPosition(false);
    }
  }

  // Save project data
  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSavingForm(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("projects").update({
        name: form.name,
        description: form.description || null,
        address: form.address || null,
        client_name: form.client_name || null,
        client_email: form.client_email || null,
      }).eq("id", project.id);
      if (error) throw new Error(error.message);
      toast({ title: "Proyecto actualizado" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingForm(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "planos", label: "Planos", icon: Layers },
    { id: "ajustes", label: "Configuración", icon: Settings },
    { id: "compartir", label: "Compartir", icon: Share2 },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Proyectos
          </Button>
        </Link>

        <div className="flex-1">
          <h1 className="font-bold text-slate-900 text-lg">{project.name}</h1>
          {project.client_name && (
            <p className="text-sm text-slate-500">Cliente: {project.client_name}</p>
          )}
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                activeTab === id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* PLANOS */}
        {activeTab === "planos" && (
          <div className="flex h-full">
            {project.floors.length > 0 && (
              <div className="w-48 bg-white border-r p-3 flex flex-col gap-1 overflow-y-auto flex-shrink-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
                  Plantas
                </p>
                {project.floors.map((floor) => (
                  <button
                    key={floor.id}
                    onClick={() => setSelectedFloorId(floor.id)}
                    className={cn(
                      "text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                      selectedFloor?.id === floor.id
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <div className="truncate">{floor.name}</div>
                    <div className={cn("text-xs mt-0.5", selectedFloor?.id === floor.id ? "text-blue-100" : "text-slate-400")}>
                      {floor.camera_points?.length ?? 0} punto{(floor.camera_points?.length ?? 0) !== 1 ? "s" : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1">
              {selectedFloor ? (
                <FloorPlanViewer floor={selectedFloor as any} projectId={project.id} isEditable={true} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-3">
                  <Layers className="w-12 h-12 opacity-30" />
                  <p className="text-sm">No hay plantas. Creá una en "Configuración".</p>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("ajustes")}>
                    Ir a Configuración
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONFIGURACIÓN */}
        {activeTab === "ajustes" && (
          <div className="p-6 overflow-y-auto h-full max-w-2xl mx-auto space-y-10">

            {/* Datos del proyecto */}
            <section>
              <h2 className="text-base font-semibold text-slate-800 mb-4">Datos del proyecto</h2>
              <form onSubmit={handleSaveForm} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    placeholder="Av. Libertador 1234, Buenos Aires"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Descripción</Label>
                  <textarea
                    id="description"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="Descripción general del proyecto..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">Datos del cliente</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="client_name">Nombre del cliente</Label>
                      <Input
                        id="client_name"
                        placeholder="Juan García"
                        value={form.client_name}
                        onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="client_email">Email del cliente</Label>
                      <Input
                        id="client_email"
                        type="email"
                        placeholder="cliente@email.com"
                        value={form.client_email}
                        onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={savingForm || !form.name.trim()}>
                    {savingForm
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Guardando...</>
                      : <><Save className="w-4 h-4 mr-1.5" /> Guardar cambios</>
                    }
                  </Button>
                </div>
              </form>
            </section>

            {/* Imagen de portada */}
            <section>
              <h2 className="text-base font-semibold text-slate-800 mb-4">Imagen de portada</h2>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  {/* Preview con focal point picker */}
                  <div className="relative flex-shrink-0 w-52 h-36 rounded-lg overflow-hidden border bg-slate-100">
                    {coverUrl ? (
                      <>
                        <img
                          src={coverUrl}
                          alt="Portada"
                          className="w-full h-full object-cover transition-all"
                          style={{ objectPosition: coverPosition }}
                        />
                        {/* Focal point grid overlay */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                          {FOCAL_POINTS.map((fp) => (
                            <button
                              key={fp.value}
                              onClick={() => handleSavePosition(fp.value)}
                              title={`Enfocar ${fp.label}`}
                              className={cn(
                                "flex items-center justify-center text-xs transition-all",
                                coverPosition === fp.value
                                  ? "bg-white/40 text-white font-bold"
                                  : "hover:bg-white/20 text-white/0 hover:text-white/80"
                              )}
                            >
                              {savingPosition && coverPosition === fp.value
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : fp.label
                              }
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="w-10 h-10 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Upload zone */}
                  <div
                    {...getRootProps()}
                    className={cn(
                      "flex-1 border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
                      isDragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300",
                      uploadingCover && "opacity-60 pointer-events-none"
                    )}
                  >
                    <input {...getInputProps()} />
                    {uploadingCover ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        <p className="text-xs text-slate-400">Subiendo...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-5 h-5 text-slate-400" />
                        <p className="text-xs text-slate-500">
                          {coverUrl ? "Reemplazar portada" : "Subir imagen de portada"}
                        </p>
                        <p className="text-[11px] text-slate-400">JPG, PNG o WEBP</p>
                      </div>
                    )}
                  </div>
                </div>
                {coverUrl && (
                  <p className="text-xs text-slate-400">
                    Hacé clic sobre la imagen para ajustar el área visible de la portada.
                  </p>
                )}
              </div>
            </section>

            {/* Gestión de plantas */}
            <section>
              <FloorManager
                project={project as any}
                onFloorSelect={(floor) => {
                  setSelectedFloorId(floor.id);
                  setActiveTab("planos");
                }}
              />
            </section>
          </div>
        )}

        {/* COMPARTIR */}
        {activeTab === "compartir" && (
          <div className="p-6 max-w-2xl mx-auto">
            <SharePanel project={project} />
          </div>
        )}
      </div>
    </div>
  );
}
