"use client";

import { useState, useRef, useEffect } from "react";
import { GridCalibration } from "@/types";
import { cn } from "@/lib/utils";
import { Crosshair, Check, X, Ruler, Trash2, ArrowLeftRight, ArrowUpDown } from "lucide-react";

interface ScreenPt { x: number; y: number; }
interface SphPt { yaw: number; pitch: number; }
interface Measurement {
  a: SphPt; b: SphPt;
  meters: number;
  direction: "H" | "V" | "D";
}

interface GridOverlay360Props {
  visible: boolean;
  showPanel: boolean;
  calibration: GridCalibration | null;
  viewer: any;
  onCalibrationSave: (cal: GridCalibration) => void;
  onToggleGrid: () => void;
  onClosePanel: () => void;
}

// ── Geometry ──────────────────────────────────────────────────
function angularDist(a: SphPt, b: SphPt): number {
  const d = Math.sin(a.pitch) * Math.sin(b.pitch)
    + Math.cos(a.pitch) * Math.cos(b.pitch) * Math.cos(a.yaw - b.yaw);
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

function inFront(pt: SphPt, cam: SphPt): boolean {
  return (Math.sin(pt.pitch) * Math.sin(cam.pitch)
    + Math.cos(pt.pitch) * Math.cos(cam.pitch) * Math.cos(pt.yaw - cam.yaw)) > 0.02;
}

/**
 * Core measurement with azimuth correction.
 *
 * In a 360° photo, the distance to a flat wall at angle α from the
 * calibration point is: D_eff = D_calib / cos(α_meas − α_calib)
 *
 * This keeps heights consistent across the same wall surface.
 * Capped at 3× D to avoid blowup beyond ~70°.
 */
function measureCorrected(angDist: number, D_calib: number, yawCalib: number, yawMeas: number): number {
  const cosCorr = Math.cos(yawMeas - yawCalib);
  const D_eff = D_calib / Math.max(cosCorr, 1 / 3); // cap at 3× D
  return 2 * D_eff * Math.tan(angDist / 2);
}

function calibrateD(physicalSize: number, angDist: number): number {
  return physicalSize / (2 * Math.tan(angDist / 2));
}

function measureDir(a: SphPt, b: SphPt): "H" | "V" | "D" {
  const dH = Math.abs(b.yaw - a.yaw) * Math.cos((a.pitch + b.pitch) / 2);
  const dV = Math.abs(b.pitch - a.pitch);
  const r = dH === 0 ? Infinity : dV / dH;
  if (r > 2) return "V";
  if (r < 0.5) return "H";
  return "D";
}

/** Average yaw of two points (midpoint on the circle). */
function midYaw(a: SphPt, b: SphPt): number {
  return (a.yaw + b.yaw) / 2;
}

// ── Component ─────────────────────────────────────────────────
type CalibAxis = "H" | "V";
type Mode = "idle" | "calibH1" | "calibH2" | "calibV1" | "calibV2" | "meas1" | "meas2";

export function GridOverlay360({
  visible, showPanel, calibration, viewer,
  onCalibrationSave, onToggleGrid, onClosePanel,
}: GridOverlay360Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const [mode, setMode] = useState<Mode>("idle");
  const [calibSph1, setCalibSph1] = useState<SphPt | null>(null);
  const [calibSph2, setCalibSph2] = useState<SphPt | null>(null);
  const [calibScr1, setCalibScr1] = useState<ScreenPt | null>(null);
  const [calibScr2, setCalibScr2] = useState<ScreenPt | null>(null);
  const [realDist, setRealDist] = useState("1");

  const [measSph1, setMeasSph1] = useState<SphPt | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);

  const dH = calibration?.distanceH;
  const dV = calibration?.distanceV;
  const yawH = calibration?.yawH ?? 0;
  const yawV = calibration?.yawV ?? 0;
  // Legacy fallback
  const legacyD = calibration?.metersPerRadH ?? calibration?.metersPerRadV ?? calibration?.metersPerRad;
  const hasH = !!(dH ?? legacyD);
  const hasV = !!(dV ?? legacyD);
  const hasAny = !!(calibration && (dH || dV || legacyD));

  // Canvas size sync
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const sync = () => { canvas.width = parent.clientWidth; canvas.height = parent.clientHeight; };
    const obs = new ResizeObserver(sync);
    obs.observe(parent);
    sync();
    return () => obs.disconnect();
  }, []);

  // ── Draw loop ─────────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!visible || !measurement || !viewer) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    function draw() {
      if (!canvas || !viewer || !measurement) return;
      const ctx = canvas.getContext("2d")!;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const cam: SphPt = viewer.getPosition();
      const aVis = inFront(measurement.a, cam);
      const bVis = inFront(measurement.b, cam);
      if (!aVis && !bVis) { animRef.current = requestAnimationFrame(draw); return; }
      const scrA = aVis ? viewer.dataHelper.sphericalCoordsToViewerCoords(measurement.a) as ScreenPt : null;
      const scrB = bVis ? viewer.dataHelper.sphericalCoordsToViewerCoords(measurement.b) as ScreenPt : null;
      if (scrA && scrB) {
        ctx.strokeStyle = "rgba(255,220,0,0.95)"; ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(scrA.x, scrA.y); ctx.lineTo(scrB.x, scrB.y); ctx.stroke();
        ctx.setLineDash([]);
        const mx = (scrA.x + scrB.x) / 2, my = (scrA.y + scrB.y) / 2;
        const dirIcon = measurement.direction === "V" ? "↕" : measurement.direction === "H" ? "↔" : "↗";
        const label = `${dirIcon} ${measurement.meters.toFixed(2)} m`;
        ctx.font = "bold 14px sans-serif";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.beginPath();
        (ctx as any).roundRect?.(mx - tw / 2 - 9, my - 13, tw + 18, 26, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(255,220,0,1)";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      }
      if (scrA) drawDot(ctx, scrA, "A");
      if (scrB) drawDot(ctx, scrB, "B");
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [visible, measurement, viewer]);

  function drawDot(ctx: CanvasRenderingContext2D, p: ScreenPt, label: string) {
    ctx.fillStyle = "rgba(255,220,0,0.95)"; ctx.strokeStyle = "white"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "black"; ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, p.x, p.y);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  // ── Tap ───────────────────────────────────────────────────
  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation(); e.preventDefault();
    if (!viewer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) { const t = e.changedTouches[0]; cx = t.clientX - rect.left; cy = t.clientY - rect.top; }
    else { cx = (e as React.MouseEvent).clientX - rect.left; cy = (e as React.MouseEvent).clientY - rect.top; }
    const sph: SphPt = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: cx, y: cy });
    if (!sph) return;
    const scr: ScreenPt = { x: cx, y: cy };

    if (mode === "calibH1" || mode === "calibV1") {
      setCalibSph1(sph); setCalibScr1(scr);
      setMode(mode === "calibH1" ? "calibH2" : "calibV2");
    } else if (mode === "calibH2" || mode === "calibV2") {
      setCalibSph2(sph); setCalibScr2(scr);
    } else if (mode === "meas1") {
      setMeasSph1(sph); setMode("meas2");
    } else if (mode === "meas2" && measSph1) {
      if (!calibration) return;
      const dir = measureDir(measSph1, sph);
      const ang = angularDist(measSph1, sph);
      const yawMeas = midYaw(measSph1, sph);

      // Pick D and its calibration yaw based on direction
      let D: number | undefined;
      let yawCalib: number = 0;
      if (dir === "V") {
        D = dV ?? dH ?? legacyD ?? undefined;
        yawCalib = dV ? yawV : dH ? yawH : 0;
      } else if (dir === "H") {
        D = dH ?? dV ?? legacyD ?? undefined;
        yawCalib = dH ? yawH : dV ? yawV : 0;
      } else {
        // Diagonal: use whichever is available, prefer H
        D = dH ?? dV ?? legacyD ?? undefined;
        yawCalib = dH ? yawH : dV ? yawV : 0;
      }
      if (!D) return;

      const meters = measureCorrected(ang, D, yawCalib, yawMeas);
      setMeasurement({ a: measSph1, b: sph, meters, direction: dir });
      setMode("idle"); setMeasSph1(null);
    }
  }

  // ── Calibration confirm ──────────────────────────────────
  function confirmCalib() {
    if (!calibSph1 || !calibSph2 || !viewer) return;
    const physical = parseFloat(realDist);
    if (!physical || physical <= 0) return;
    const ang = angularDist(calibSph1, calibSph2);
    if (ang < 0.001) return;
    const D = calibrateD(physical, ang);
    const yawCalib = midYaw(calibSph1, calibSph2);
    const axis: CalibAxis = mode === "calibH2" ? "H" : "V";
    onCalibrationSave({
      ...(calibration ?? { opacity: 0.7 }),
      ...(axis === "H" ? { distanceH: D, yawH: yawCalib } : { distanceV: D, yawV: yawCalib }),
    });
    resetCalib();
  }

  function resetCalib() {
    setMode("idle");
    setCalibSph1(null); setCalibSph2(null); setCalibScr1(null); setCalibScr2(null);
  }

  function startCalib(axis: CalibAxis) {
    setMeasSph1(null); setMeasurement(null);
    setCalibSph1(null); setCalibSph2(null); setCalibScr1(null); setCalibScr2(null);
    setMode(axis === "H" ? "calibH1" : "calibV1");
  }

  function startMeasure() { resetCalib(); setMeasSph1(null); setMeasurement(null); setMode("meas1"); }
  function clearMeasurement() { setMeasurement(null); setMeasSph1(null); setMode("idle"); }

  const isCalibMode = mode.startsWith("calib");
  const isMeasMode = mode.startsWith("meas");
  const isInteractive = isCalibMode || isMeasMode;
  const calibAxis: CalibAxis | null = mode.startsWith("calibH") ? "H" : mode.startsWith("calibV") ? "V" : null;
  const awaitingInput = (mode === "calibH2" || mode === "calibV2") && !!calibSph2;

  const instruction =
    mode === "calibH1" ? "A → extremo izquierdo de la medida conocida" :
    mode === "calibH2" && !calibSph2 ? "B → extremo derecho" :
    mode === "calibH2" ? "Ingresá la distancia en el panel →" :
    mode === "calibV1" ? "A → parte superior de la medida conocida" :
    mode === "calibV2" && !calibSph2 ? "B → parte inferior" :
    mode === "calibV2" ? "Ingresá la distancia en el panel →" :
    mode === "meas1" ? "Tocá el punto A" :
    mode === "meas2" ? "Tocá el punto B" : null;

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10"
        style={{ pointerEvents: isInteractive ? "auto" : "none", cursor: isInteractive ? "crosshair" : "default" }}
        onClick={isInteractive ? handleTap : undefined}
        onTouchEnd={isInteractive ? handleTap : undefined} />

      {/* Calibration dots */}
      {isCalibMode && (calibScr1 || calibScr2) && (
        <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
          {calibScr1 && <>
            <circle cx={calibScr1.x} cy={calibScr1.y} r={9} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
            <text x={calibScr1.x} y={calibScr1.y + 1} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="11" fontWeight="bold">A</text>
          </>}
          {calibScr1 && calibScr2 && <>
            <line x1={calibScr1.x} y1={calibScr1.y} x2={calibScr2.x} y2={calibScr2.y}
              stroke="rgba(255,220,0,0.9)" strokeWidth="2" strokeDasharray="6,3" />
            <circle cx={calibScr2.x} cy={calibScr2.y} r={9} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
            <text x={calibScr2.x} y={calibScr2.y + 1} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="11" fontWeight="bold">B</text>
          </>}
        </svg>
      )}

      {/* Measure dot A waiting for B */}
      {mode === "meas2" && measSph1 && viewer && (() => {
        const cam: SphPt = viewer.getPosition();
        if (!inFront(measSph1, cam)) return null;
        const scr = viewer.dataHelper.sphericalCoordsToViewerCoords(measSph1) as ScreenPt;
        if (!scr) return null;
        return (
          <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
            <circle cx={scr.x} cy={scr.y} r={9} fill="rgba(255,220,0,0.9)" stroke="white" strokeWidth="2" />
            <text x={scr.x} y={scr.y + 1} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="11" fontWeight="bold">A</text>
          </svg>
        );
      })()}

      {/* Banner */}
      {instruction && (
        <div className="absolute left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur
                        rounded-full px-5 py-2.5 text-yellow-400 text-sm font-medium
                        pointer-events-none shadow-lg" style={{ top: "80px" }}>
          {instruction}
        </div>
      )}

      {/* Panel */}
      {showPanel && (
        <div className="fixed z-[60] bg-black/85 backdrop-blur rounded-xl border border-white/10
                        p-4 space-y-4 shadow-2xl" style={{ top: "72px", right: "16px", width: "272px" }}>

          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold flex items-center gap-2">
              <Ruler className="w-4 h-4 text-yellow-400" />
              Herramienta de medición
            </p>
            <button onClick={onClosePanel} className="text-white/50 hover:text-white p-1"><X className="w-4 h-4" /></button>
          </div>

          {/* Calibración */}
          <div className="space-y-2">
            <p className="text-white/50 text-[10px] uppercase tracking-wider">Escala</p>

            {/* Horizontal */}
            <CalibRow
              label="Ancho" icon={<ArrowLeftRight className="w-3 h-3 flex-shrink-0" />}
              value={dH ? `D=${dH.toFixed(1)}m` : undefined}
              isActive={calibAxis === "H"}
              onStart={() => startCalib("H")}
              onCancel={resetCalib}
            />
            {calibAxis === "H" && awaitingInput && (
              <CalibInput value={realDist} onChange={setRealDist} placeholder="ancho real (m)" onConfirm={confirmCalib} />
            )}

            {/* Vertical */}
            <CalibRow
              label="Alto" icon={<ArrowUpDown className="w-3 h-3 flex-shrink-0" />}
              value={dV ? `D=${dV.toFixed(1)}m` : undefined}
              isActive={calibAxis === "V"}
              onStart={() => startCalib("V")}
              onCancel={resetCalib}
            />
            {calibAxis === "V" && awaitingInput && (
              <CalibInput value={realDist} onChange={setRealDist} placeholder="alto real (m)" onConfirm={confirmCalib} />
            )}

            <p className="text-white/30 text-[10px] leading-snug">
              Calibrá mirando de frente a la pared. Funciona en toda la pared, no solo donde calibraste.
            </p>
          </div>

          {/* Medición */}
          {hasAny && (
            <div className="border-t border-white/10 pt-3 space-y-2">
              <p className="text-white/50 text-[10px] uppercase tracking-wider">Medir</p>

              {measurement ? (
                <div className="space-y-2">
                  <div className="bg-yellow-400/15 border border-yellow-400/30 rounded-lg px-3 py-3 text-center">
                    <p className="text-yellow-400 text-2xl font-bold tracking-tight">{measurement.meters.toFixed(2)} m</p>
                    <p className="text-yellow-400/60 text-[10px] mt-0.5">
                      {measurement.direction === "V" ? "↕ vertical" : measurement.direction === "H" ? "↔ horizontal" : "↗ diagonal"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={startMeasure}
                      className="flex-1 text-xs py-2 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30
                                 text-yellow-400 border border-yellow-400/30 transition-colors">
                      Nueva medición
                    </button>
                    <button onClick={clearMeasurement}
                      className="p-2 text-white/40 hover:text-white/70 hover:bg-white/10 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : isMeasMode ? (
                <div className="space-y-2">
                  <p className="text-yellow-400 text-xs">
                    {mode === "meas1" ? "→ Tocá el punto A" : "→ Tocá el punto B"}
                  </p>
                  <button onClick={clearMeasurement} className="text-white/40 hover:text-white/70 text-xs">Cancelar</button>
                </div>
              ) : (
                <button onClick={startMeasure}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-400/20
                             hover:bg-yellow-400/30 text-yellow-400 text-xs py-2.5 rounded-lg
                             border border-yellow-400/30 transition-colors">
                  <Ruler className="w-3.5 h-3.5" />
                  Medir distancia
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────
function CalibRow({ label, icon, value, isActive, onStart, onCancel }: {
  label: string; icon: React.ReactNode; value?: string;
  isActive: boolean; onStart: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs",
        value ? "border-white/20 bg-white/5 text-white/70" : "border-white/10 text-white/30"
      )}>
        {icon}
        <span>{value ?? `${label} sin calibrar`}</span>
      </div>
      {!isActive ? (
        <button onClick={onStart}
          className="px-2 py-1.5 bg-white/10 hover:bg-white/15 text-white/70 text-xs
                     rounded-lg border border-white/15 transition-colors whitespace-nowrap">
          {value ? "Recal." : "Calibrar"}
        </button>
      ) : (
        <button onClick={onCancel} className="px-2 py-1.5 text-white/40 hover:text-white/70 text-xs">
          Cancelar
        </button>
      )}
    </div>
  );
}

function CalibInput({ value, onChange, placeholder, onConfirm }: {
  value: string; onChange: (v: string) => void; placeholder: string; onConfirm: () => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-white/10 text-white text-sm px-2 py-1.5 rounded border
                   border-white/20 focus:outline-none focus:border-yellow-400"
        placeholder={placeholder} min="0.01" step="0.01" autoFocus />
      <span className="text-white/50 text-xs">m</span>
      <button onClick={onConfirm} className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded text-white">
        <Check className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
