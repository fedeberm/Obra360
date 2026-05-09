"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Floor, CameraPoint, PhotoVisit } from "@/types";
import { createCameraPoint } from "@/lib/actions/camera-points";
import { createClient } from "@/lib/supabase/client";
import { Viewer360Modal } from "@/components/viewer/viewer-360-modal";
import { PointInfoPanel } from "@/components/floor-plan/point-info-panel";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PlusCircle, MousePointer, ZoomIn, ZoomOut, RotateCcw, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type FullPoint = CameraPoint & { photo_visits: PhotoVisit[] };
type FullFloor = Floor & { camera_points: FullPoint[] };

interface FloorPlanViewerProps {
  floor: FullFloor;
  projectId: string;
  isEditable: boolean;
}

type Mode = "view" | "add";

export function FloorPlanViewer({ floor, projectId, isEditable }: FloorPlanViewerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>("view");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const selectedPoint = floor.camera_points?.find((p) => p.id === selectedPointId) ?? null;
  const [viewerPhoto, setViewerPhoto] = useState<PhotoVisit | null>(null);
  const [addingPoint, setAddingPoint] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [newPointName, setNewPointName] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [pdfSize, setPdfSize] = useState({ width: 900, height: 636 });

  // Calcular zoom inicial para ajustar el PDF al contenedor
  function fitToContainer(pdfW: number, pdfH: number) {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const scaleX = (width - 80) / pdfW;
    const scaleY = (height - 80) / pdfH;
    const scale = Math.min(scaleX, scaleY, 1);
    setZoom(scale);
    setPan({ x: 0, y: 0 });
  }

  // Resetear cuando cambia de planta
  useEffect(() => {
    setSelectedPointId(null);
    setMode("view");
    setPendingPos(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImageLoaded(false);
  }, [floor.id]);

  // Centrar y ajustar el PDF una vez que cargó y el contenedor tiene dimensiones
  useEffect(() => {
    if (!imageLoaded) return;
    const timer = setTimeout(() => {
      fitToContainer(pdfSize.width, pdfSize.height);
    }, 50);
    return () => clearTimeout(timer);
  }, [imageLoaded, pdfSize]);

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "add" || !imageRef.current) return;

    const imgRect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
    const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    setPendingPos({ x, y });
    setNewPointName("");
  }

  async function handleConfirmPoint() {
    if (!pendingPos || !newPointName.trim()) return;
    setAddingPoint(true);
    try {
      await createCameraPoint(floor.id, projectId, {
        name: newPointName,
        x_percent: pendingPos.x,
        y_percent: pendingPos.y,
      });
      toast({ title: "Punto creado", description: `"${newPointName}" agregado al plano.` });
      setPendingPos(null);
      setNewPointName("");
      setMode("view");
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setAddingPoint(false);
    }
  }

  async function handleDeletePoint(pointId: string) {
    if (!confirm("¿Eliminar este punto y todas sus fotos?")) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("camera_points").delete().eq("id", pointId);
      if (error) throw new Error(error.message);
      setSelectedPointId(null);
      toast({ title: "Punto eliminado" });
      router.refresh();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  }

  // Pan con mouse
  function handleMouseDown(e: React.MouseEvent) {
    if (mode === "add") return;
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }

  function handleMouseUp() {
    setIsPanning(false);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.1, Math.min(4, z + delta)));
  }

  function resetView() {
    fitToContainer(pdfSize.width, pdfSize.height);
  }

  if (!floor.pdf_url) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-3 p-8">
        <Info className="w-10 h-10 opacity-40" />
        <p className="text-sm text-center">
          Esta planta no tiene un plano PDF cargado.<br />
          Subí uno desde &quot;Gestionar plantas&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Canvas del plano */}
      <div className="flex-1 relative overflow-hidden bg-slate-200">
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          {isEditable && (
            <div className="bg-white rounded-xl shadow-md border overflow-hidden">
              <button
                onClick={() => { setMode("view"); setPendingPos(null); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 w-full text-sm font-medium transition-colors border-b",
                  mode === "view"
                    ? "bg-primary text-white"
                    : "hover:bg-slate-50 text-slate-600"
                )}
                title="Ver / seleccionar puntos"
              >
                <MousePointer className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">Ver puntos</span>
              </button>
              <button
                onClick={() => { setMode("add"); setSelectedPointId(null); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 w-full text-sm font-medium transition-colors",
                  mode === "add"
                    ? "bg-red-500 text-white"
                    : "hover:bg-slate-50 text-slate-600"
                )}
                title="Agregar nuevo punto"
              >
                <PlusCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">Agregar punto</span>
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="bg-white rounded-xl shadow-md border p-1 flex flex-col gap-1">
            <button
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Reset vista"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modo banner */}
        {mode === "add" && isEditable && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-primary text-white text-sm px-4 py-2 rounded-full shadow-lg">
            Hacé clic en el plano para colocar un punto
          </div>
        )}

        {/* Zoom level */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/90 text-xs text-slate-500 px-2 py-1 rounded-md shadow">
          {Math.round(zoom * 100)}%
        </div>

        {/* Loading del PDF */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-200">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-slate-300 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Cargando plano...</p>
            </div>
          </div>
        )}

        {/* Contenedor del plano */}
        <div
          ref={containerRef}
          className={cn(
            "w-full h-full select-none relative overflow-hidden",
            !imageLoaded && "invisible",
            mode === "add" ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* PDF centrado con posición absoluta — más confiable que transform en 100%x100% */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.15s ease",
            }}
          >
            <div className="relative inline-block">
              <PdfRenderer
                pdfUrl={floor.pdf_url}
                imageRef={imageRef}
                onLoad={(w, h) => {
                  setPdfSize({ width: w, height: h });
                  setImageLoaded(true);
                }}
              />

              {/* Puntos sobre el plano */}
              {imageLoaded && floor.camera_points?.map((point) => (
                <FloorPoint
                  key={point.id}
                  point={point}
                  isSelected={selectedPoint?.id === point.id}
                  isEditing={mode === "add"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === "view") {
                      setSelectedPointId(selectedPoint?.id === point.id ? null : point.id);
                    }
                  }}
                  onViewPhoto={(visit) => {
                    setViewerPhoto(visit);
                  }}
                />
              ))}

              {/* Punto pendiente (aún sin nombre) */}
              {pendingPos && imageLoaded && (
                <div
                  className="floor-plan-point"
                  style={{ left: `${pendingPos.x}%`, top: `${pendingPos.y}%` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="floor-plan-point-inner editing bg-amber-500">
                    <PlusCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                  {/* Mini form inline */}
                  <div className="absolute left-8 top-0 bg-white shadow-xl rounded-lg p-3 min-w-[200px] z-30 border">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Nombre del punto</p>
                    <input
                      autoFocus
                      className="w-full border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Ej: Dormitorio 1"
                      value={newPointName}
                      onChange={(e) => setNewPointName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmPoint();
                        if (e.key === "Escape") setPendingPos(null);
                      }}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={handleConfirmPoint}
                        disabled={!newPointName.trim() || addingPoint}
                      >
                        Agregar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setPendingPos(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Panel del punto seleccionado — posición fija a la derecha */}
      {selectedPoint && (
        <div className="fixed top-0 right-0 h-full w-80 z-40 shadow-2xl">
          <PointInfoPanel
            point={selectedPoint}
            projectId={projectId}
            isEditable={isEditable}
            onClose={() => setSelectedPointId(null)}
            onViewPhoto={(visit) => setViewerPhoto(visit)}
            onDelete={() => handleDeletePoint(selectedPoint.id)}
            onRefresh={() => router.refresh()}
          />
        </div>
      )}

      {/* Visor 360 */}
      {viewerPhoto && (
        <Viewer360Modal
          visit={viewerPhoto}
          pointName={
            floor.camera_points?.find(
              (p) => p.photo_visits?.some((v) => v.id === viewerPhoto.id)
            )?.name ?? ""
          }
          allVisits={
            floor.camera_points
              ?.find((p) => p.photo_visits?.some((v) => v.id === viewerPhoto.id))
              ?.photo_visits ?? []
          }
          onClose={() => setViewerPhoto(null)}
          onChangeVisit={(visit) => setViewerPhoto(visit)}
        />
      )}
    </div>
  );
}

// Renderiza el PDF como canvas usando pdfjs-dist
function PdfRenderer({
  pdfUrl,
  imageRef,
  onLoad,
}: {
  pdfUrl: string;
  imageRef: React.RefObject<HTMLDivElement | null>;
  onLoad: (width: number, height: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 900, height: 636 });

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setSize({ width: viewport.width, height: viewport.height });

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) onLoad(viewport.width, viewport.height);
      } catch (err) {
        console.error("Error renderizando PDF:", err);
        if (!cancelled) onLoad(900, 636);
      }
    }

    renderPdf();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  return (
    <div
      ref={imageRef}
      className="relative rounded shadow-lg overflow-hidden bg-white"
      style={{ width: size.width, height: size.height }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

// Punto individual sobre el plano
function FloorPoint({
  point,
  isSelected,
  isEditing,
  onClick,
  onViewPhoto,
}: {
  point: FullPoint;
  isSelected: boolean;
  isEditing: boolean;
  onClick: (e: React.MouseEvent) => void;
  onViewPhoto: (visit: PhotoVisit) => void;
}) {
  const hasPhoto = (point.photo_visits?.length ?? 0) > 0;
  const latestVisit = point.photo_visits?.[0];

  return (
    <div
      className="floor-plan-point group"
      style={{ left: `${point.x_percent}%`, top: `${point.y_percent}%` }}
      onClick={onClick}
    >
      <div
        className={cn(
          "floor-plan-point-inner",
          hasPhoto ? "has-photo" : "no-photo",
          isSelected && "active",
          isEditing && "opacity-40 pointer-events-none"
        )}
      >
        <span className="text-white text-[10px] font-bold drop-shadow">
          {point.name.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Etiqueta debajo del punto */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 pointer-events-none">
        <span className={cn(
          "bg-slate-900/90 text-white text-[10px] font-medium px-2 py-0.5 rounded whitespace-nowrap transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {point.name}
          {hasPhoto && <span className="ml-1 text-orange-300">📷</span>}
        </span>
      </div>
    </div>
  );
}
