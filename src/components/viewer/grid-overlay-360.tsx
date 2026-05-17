"use client";

import { useState, useRef, useEffect } from "react";
import { GridCalibration } from "@/types";
import { cn } from "@/lib/utils";
import { Crosshair, Check, X } from "lucide-react";

interface ScreenPt { x: number; y: number; }
interface SphPt { yaw: number; pitch: number; }

interface GridOverlay360Props {
  visible: boolean;
  showPanel: boolean;
  calibration: GridCalibration | null;
  viewer: any; // PSV Viewer instance
  onCalibrationSave: (cal: GridCalibration) => void;
  onToggleGrid: () => void;
  onClosePanel: () => void;
}

const CELL_SIZES = [0.25, 0.5, 1, 2, 5];
const GRID_EXTENT = 10; // lines each side from center
const STEPS = 80;       // sample points per line

/** Angular distance between two spherical points (radians) */
function angularDist(a: SphPt, b: SphPt) {
  const d =
    Math.sin(a.pitch) * Math.sin(b.pitch) +
    Math.cos(a.pitch) * Math.cos(b.pitch) * Math.cos(a.yaw - b.yaw);
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

/** True if the spherical point is in front of the camera (dot product > threshold) */
function inFront(pt: SphPt, cam: SphPt) {
  return (
    Math.sin(pt.pitch) * Math.sin(cam.pitch) +
    Math.cos(pt.pitch) * Math.cos(cam.pitch) * Math.cos(pt.yaw - cam.yaw)
  ) > 0.02;
}

export function GridOverlay360({
  visible, showPanel, calibration, viewer,
  onCalibrationSave, onToggleGrid, onClosePanel,
}: GridOverlay360Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const [calibMode, setCalibMode] = useState(false);
  const [sphPt1, setSphPt1] = useState<SphPt | null>(null);
  const [sphPt2, setSphPt2] = useState<SphPt | null>(null);
  const [screenPt1, setScreenPt1] = useState<ScreenPt | null>(null);
  const [screenPt2, setScreenPt2] = useState<ScreenPt | null>(null);
  const [realDistance, setRealDistance] = useState("1");
  const [cellSize, setCellSize] = useState(calibration?.cellSizeMeters ?? 1);
  const [opacity, setOpacity] = useState(calibration?.opacity ?? 0.4);

  // Sync sliders when visit changes
  useEffect(() => {
    if (calibration) {
      setCellSize(calibration.cellSizeMeters);
      setOpacity(calibration.opacity);
    }
  }, [calibration]);

  // Keep canvas buffer size in sync with container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const sync = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    const obs = new ResizeObserver(sync);
    obs.observe(parent);
    sync();
    return () => obs.disconnect();
  }, []);

  // ── Draw loop ────────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!visible || !calibration || !viewer || calibration.anchorYaw === undefined) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const { anchorYaw, anchorPitch, metersPerRad, cellSizeMeters } = calibration as Required<GridCalibration>;

    function draw() {
      if (!canvas || !viewer) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const radPerCell = cellSizeMeters / metersPerRad;
      const cam: SphPt = viewer.getPosition(); // { yaw, pitch }

      // ── Helper: draw one sampled line ───────────────────
      function drawPolyline(
        yawAt: (t: number) => number,
        pitchAt: (t: number) => number,
        style: string,
        width: number,
      ) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        let seg: ScreenPt[] = [];
        let prevSc: ScreenPt | null = null;

        function flush() {
          if (seg.length < 2) { seg = []; return; }
          ctx.beginPath();
          ctx.moveTo(seg[0].x, seg[0].y);
          for (let k = 1; k < seg.length; k++) ctx.lineTo(seg[k].x, seg[k].y);
          ctx.stroke();
          seg = [];
        }

        for (let j = 0; j <= STEPS; j++) {
          const t = j / STEPS;
          const pt: SphPt = { yaw: yawAt(t), pitch: pitchAt(t) };

          if (!inFront(pt, cam)) { flush(); prevSc = null; continue; }

          const sc: ScreenPt = viewer.dataHelper.sphericalCoordsToViewerCoords(pt);
          if (!sc) { flush(); prevSc = null; continue; }

          // Detect wrap-around jump (behind-camera artifact)
          if (prevSc && (Math.abs(sc.x - prevSc.x) > W * 0.45 || Math.abs(sc.y - prevSc.y) > H * 0.45)) {
            flush();
          }

          seg.push(sc);
          prevSc = sc;
        }
        flush();
      }

      // ── Vertical lines (constant yaw) ───────────────────
      for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i++) {
        const yaw = anchorYaw + i * radPerCell;
        drawPolyline(
          () => yaw,
          (t) => -Math.PI / 2 + Math.PI * t,
          "rgba(255,255,255,0.85)", 0.9,
        );
      }

      // ── Horizontal lines (constant pitch) ───────────────
      for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i++) {
        const pitch = anchorPitch + i * radPerCell;
        if (Math.abs(pitch) > Math.PI / 2 - 0.05) continue;
        drawPolyline(
          (t) => anchorYaw - Math.PI + t * 2 * Math.PI,
          () => pitch,
          "rgba(255,255,255,0.85)", 0.9,
        );
      }

      // ── Distance labels every 2 cells ───────────────────
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "11px sans-serif";
      for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i += 2) {
        if (i === 0) continue;
        const meters = Math.abs(i) * cellSizeMeters;
        const labelPt = { yaw: anchorYaw + i * radPerCell, pitch: anchorPitch };
        if (!inFront(labelPt, cam)) continue;
        const sc = viewer.dataHelper.sphericalCoordsToViewerCoords(labelPt);
        if (sc && sc.x > 0 && sc.x < W && sc.y > 0 && sc.y < H) {
          ctx.fillText(`${meters}m`, sc.x + 4, sc.y - 4);
        }
      }

      // ── Anchor crosshair ─────────────────────────────────
      const anchor: SphPt = { yaw: anchorYaw, pitch: anchorPitch };
      if (inFront(anchor, cam)) {
        const sc = viewer.dataHelper.sphericalCoordsToViewerCoords(anchor);
        if (sc) {
          ctx.strokeStyle = "rgba(255,200,0,0.95)";
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sc.x - 12, sc.y); ctx.lineTo(sc.x + 12, sc.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sc.x, sc.y - 12); ctx.lineTo(sc.x, sc.y + 12); ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [visible, calibration, viewer]);

  // ── Calibration tap handler ──────────────────────────────
  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    if (!calibMode || !viewer) return;
    e.stopPropagation();
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) {
      const t = e.changedTouches[0];
      cx = t.clientX - rect.left;
      cy = t.clientY - rect.top;
    } else {
      cx = (e as React.MouseEvent).clientX - rect.left;
      cy = (e as React.MouseEvent).clientY - rect.top;
    }

    const sph: SphPt = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: cx, y: cy });
    if (!sph) return;

    if (!sphPt1) {
      setSphPt1(sph);
      setScreenPt1({ x: cx, y: cy });
    } else if (!sphPt2) {
      setSphPt2(sph);
      setScreenPt2({ x: cx, y: cy });
    }
  }

  function confirmCalibration() {
    if (!sphPt1 || !sphPt2) return;
    const dist = parseFloat(realDistance);
    if (!dist || dist <= 0) return;

    const angDist = angularDist(sphPt1, sphPt2);
    if (angDist < 0.001) return;

    const metersPerRad = dist / angDist;
    const cal: GridCalibration = {
      metersPerRad,
      cellSizeMeters: cellSize,
      opacity,
      anchorYaw: (sphPt1.yaw + sphPt2.yaw) / 2,
      anchorPitch: (sphPt1.pitch + sphPt2.pitch) / 2,
    };
    onCalibrationSave(cal);
    setCalibMode(false);
    setSphPt1(null); setSphPt2(null);
    setScreenPt1(null); setScreenPt2(null);
  }

  function cancelCalibration() {
    setCalibMode(false);
    setSphPt1(null); setSphPt2(null);
    setScreenPt1(null); setScreenPt2(null);
  }

  function updateDisplayProps(newCell?: number, newOpacity?: number) {
    if (!calibration) return;
    onCalibrationSave({ ...calibration, cellSizeMeters: newCell ?? cellSize, opacity: newOpacity ?? opacity });
  }

  const hasCalib = calibration?.anchorYaw !== undefined;

  return (
    <>
      {/* Canvas — redrawn every frame by the draw loop */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        style={{
          opacity: calibration?.opacity ?? opacity,
          pointerEvents: calibMode ? "auto" : "none",
          cursor: calibMode ? "crosshair" : "default",
        }}
        onClick={calibMode ? handleTap : undefined}
        onTouchEnd={calibMode ? handleTap : undefined}
      />

      {/* Calibration dots — SVG overlay so they don't get cleared by canvas */}
      {calibMode && (screenPt1 || screenPt2) && (
        <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
          {screenPt1 && (
            <circle cx={screenPt1.x} cy={screenPt1.y} r={8}
              fill="rgba(255,200,0,0.9)" stroke="white" strokeWidth="2" />
          )}
          {screenPt1 && screenPt2 && (
            <>
              <circle cx={screenPt2.x} cy={screenPt2.y} r={8}
                fill="rgba(255,200,0,0.9)" stroke="white" strokeWidth="2" />
              <line x1={screenPt1.x} y1={screenPt1.y} x2={screenPt2.x} y2={screenPt2.y}
                stroke="rgba(255,200,0,0.9)" strokeWidth="2" strokeDasharray="6,3" />
            </>
          )}
        </svg>
      )}

      {/* Instruction banner during calibration */}
      {calibMode && (
        <div className="absolute left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur
                        rounded-full px-5 py-2.5 text-yellow-400 text-sm font-medium
                        pointer-events-none shadow-lg"
          style={{ top: "80px" }}>
          {!sphPt1
            ? "Tocá el punto A en la imagen"
            : !sphPt2
            ? "Tocá el punto B en la imagen"
            : "Ingresá la distancia real en el panel →"}
        </div>
      )}

      {/* Control panel — fixed so it's never hidden under the header */}
      {showPanel && (
        <div className="fixed z-[60] bg-black/85 backdrop-blur rounded-xl
                        border border-white/10 p-4 w-64 space-y-4 shadow-2xl"
          style={{ top: "72px", right: "16px" }}>

          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold">Grilla de referencia</p>
            <button onClick={onClosePanel} className="text-white/50 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle */}
          <button
            onClick={onToggleGrid}
            className={cn(
              "w-full text-xs py-2 rounded-lg border transition-colors",
              visible
                ? "bg-yellow-400/20 text-yellow-400 border-yellow-400/40 hover:bg-yellow-400/30"
                : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20",
            )}
          >
            {visible ? "Ocultar grilla" : "Mostrar grilla"}
          </button>

          {!hasCalib && (
            <p className="text-white/50 text-xs text-center">
              Calibrá primero para ver la grilla
            </p>
          )}

          {/* Cell size */}
          {hasCalib && (
            <div className="space-y-1.5">
              <p className="text-white/60 text-xs">Tamaño de celda</p>
              <div className="flex gap-1.5 flex-wrap">
                {CELL_SIZES.map((s) => (
                  <button key={s}
                    onClick={() => { setCellSize(s); updateDisplayProps(s, undefined); }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors",
                      cellSize === s
                        ? "bg-yellow-400 text-black border-yellow-400"
                        : "text-white/70 border-white/20 hover:border-white/50",
                    )}>
                    {s}m
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opacity */}
          {hasCalib && (
            <div className="space-y-1.5">
              <p className="text-white/60 text-xs">Opacidad</p>
              <input type="range" min="0.1" max="1" step="0.05" value={opacity}
                onChange={(e) => { const v = parseFloat(e.target.value); setOpacity(v); updateDisplayProps(undefined, v); }}
                className="w-full accent-yellow-400" />
            </div>
          )}

          {/* Calibration */}
          <div className="border-t border-white/10 pt-3 space-y-2">
            <p className="text-white/60 text-xs">Calibración</p>

            {!calibMode ? (
              <button
                onClick={() => { setCalibMode(true); setSphPt1(null); setSphPt2(null); setScreenPt1(null); setScreenPt2(null); }}
                className="w-full flex items-center justify-center gap-2
                           bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400
                           text-xs py-2.5 rounded-lg border border-yellow-400/30 transition-colors">
                <Crosshair className="w-3.5 h-3.5" />
                {hasCalib ? "Recalibrar" : "Calibrar ahora"}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-yellow-400 text-xs">
                  {!sphPt1 ? "→ Tocá punto A en la foto"
                   : !sphPt2 ? "→ Tocá punto B en la foto"
                   : "→ Ingresá la distancia real"}
                </p>
                {sphPt1 && sphPt2 && (
                  <div className="flex gap-2 items-center">
                    <input type="number" value={realDistance}
                      onChange={(e) => setRealDistance(e.target.value)}
                      className="flex-1 bg-white/10 text-white text-sm px-2 py-1.5 rounded
                                 border border-white/20 focus:outline-none focus:border-yellow-400"
                      placeholder="metros" min="0.01" step="0.1" autoFocus />
                    <span className="text-white/50 text-xs">m</span>
                    <button onClick={confirmCalibration}
                      className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded text-white">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button onClick={cancelCalibration} className="text-white/40 hover:text-white/70 text-xs">
                  Cancelar
                </button>
              </div>
            )}

            {hasCalib && !calibMode && (
              <p className="text-white/40 text-[10px]">
                {calibration!.metersPerRad!.toFixed(1)} m/rad · celda {calibration!.cellSizeMeters}m
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
