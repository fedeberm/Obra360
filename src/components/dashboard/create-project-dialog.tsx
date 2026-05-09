"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { createProject } from "@/lib/actions/projects";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Upload, ImageIcon, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function CreateProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    client_name: "",
    client_email: "",
  });

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) {
      setCoverFile(files[0]);
      setCoverPreview(URL.createObjectURL(files[0]));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    disabled: loading,
  });

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function removeCover() {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
  }

  function resetDialog() {
    setForm({ name: "", description: "", address: "", client_name: "", client_email: "" });
    removeCover();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setLoading(true);
    try {
      let cover_image_url: string | undefined;

      if (coverFile) {
        const supabase = createClient();
        const ext = coverFile.name.split(".").pop();
        const path = `covers/${Date.now()}.${ext}`;
        const { error: storageError } = await supabase.storage
          .from("photos360")
          .upload(path, coverFile, { upsert: true });
        if (storageError) throw new Error(`Imagen: ${storageError.message}`);
        const { data: { publicUrl } } = supabase.storage.from("photos360").getPublicUrl(path);
        cover_image_url = publicUrl;
      }

      const project = await createProject({
        name: form.name,
        description: form.description || undefined,
        address: form.address || undefined,
        client_name: form.client_name || undefined,
        client_email: form.client_email || undefined,
        cover_image_url,
      });

      toast({ title: "Proyecto creado", description: `"${project.name}" fue creado correctamente.` });
      setOpen(false);
      resetDialog();
      router.push(`/dashboard/project/${project.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo crear el proyecto.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear nuevo proyecto</DialogTitle>
          <DialogDescription>
            Completá los datos del proyecto de obra. Podés agregar plantas y puntos después.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Imagen de portada */}
          <div className="space-y-2">
            <Label>Imagen de portada (opcional)</Label>
            {coverPreview ? (
              <div className="relative rounded-lg overflow-hidden">
                <img src={coverPreview} alt="Portada" className="w-full h-36 object-cover" />
                <button
                  type="button"
                  onClick={removeCover}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                )}
              >
                <input {...getInputProps()} />
                <ImageIcon className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Arrastrá o hacé clic para subir imagen</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre del proyecto *</Label>
            <Input
              id="name"
              placeholder="Casa García - Nordelta"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección de obra</Label>
            <Input
              id="address"
              placeholder="Av. Libertador 1234, Buenos Aires"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Cliente</Label>
              <Input
                id="client_name"
                placeholder="Nombre del cliente"
                value={form.client_name}
                onChange={(e) => handleChange("client_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_email">Email cliente</Label>
              <Input
                id="client_email"
                type="email"
                placeholder="cliente@email.com"
                value={form.client_email}
                onChange={(e) => handleChange("client_email", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Descripción general del proyecto..."
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Creando...</> : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
