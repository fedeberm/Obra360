"use client";

import { useState, useRef, useEffect } from "react";
import { GridCalibration } from "@/types";
import { cn } from "@/lib/utils";
import { Crosshair, Check, X } from "lucide-react";

interface Point { x: number; y: number; }

interface GridOverlay360Props {
  visible: boolean;
  showPanel: boolean;
  calibration: GridCalibration | null;
  onCalibrationSave: (cal: GridCalibration) => void;
  onToggleGrid: () => void;
  onClosePanel: () => void;
}

const CELL_SIZES = [0.25, 0.5, 1, 2, 5];

export function GridOverlay360({
  visible,
  showPanel,
  calibration,
  onCalibrationSave,
  onToggleGrid,
  onClosePanel,
}: GridOverlay360Props) {
  const overlayRef = useRef<SVGSVGElement>(null);
  const [calibMode, setCalibMode] = useState(false);
  const [point1, setPoint1] = useState<Point | null>(null);
  const [point2, setPoint2] = useState<Point | null>(null);
  const [realDistance, setRealDistance] = useState("1");
  const [cellSize, setCellSize] = useState(calibration?.cellSizeMeters ?? 1);
  const [opacity, setOpacity] = useState(calibration?.opacity ?? 0.4);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Sync local state when calibration changes (e.g. visit change)
  useEffect(() => {
    if (calibration) {
      setCellSize(calibration.cellSizeMeters);
      setOpacity(calibration.opacity);
    }
  }, [calibration]);

  // Track overlay dimensions
  useEffect(() => {
    const el = overlayRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  function handleOverlayClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!calibMode) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!point1) {
      setPoint1(pt);
    } else if (!point2) {
      setPoint2(pt);
    }
  }

  function confirmCalibration() {
    if (!point1 || !point2) return;
    const dist = parseFloat(realDistance);
    if (!dist || dist <= 0) return;
    const px = Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2);
    const pixelsPerMeter = px / dist;
    const cal: GridCalibration = { pixelsPerMeter, cellSizeMeters: cellSize, opacity };
    onCalibrationSave(cal);
    setCalibMode(false);
    setPoint1(null);
    setPoint2(null);
  }

  function cancelCalibration() {
    setCalibMode(false);
    setPoint1(null);
    setPoint2(null);
  }

  function updateDisplayProps(newCellSize?: number, newOpacity?: number) {
    if (!calibration) return;
    const cal: GridCalibration = {
      ...calibration,
      cellSizeMeters: newCellSize ?? cellSize,
      opacity: newOpacity ?? opacity,
    };
    onCalibrationSave(cal);
  }

  // Build grid lines
  function buildGrid() {
    if (!calibration || dims.w === 0) return null;
    const interval = calibration.cellSizeMeters * calibration.pixelsPerMeter;
    if (interval < 5) return null; // too dense

    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const lines: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];

    // Vertical lines
    let i = 0;
    for (let x = cx; x <= dims.w + interval; x += interval, i++) {
      const meters = i * calibration.cellSizeMeters;
      lines.push(<line key={`vr${i}`} x1={x} y1={0} x2={x} y2={dims.h} stroke="white" strokeWidth="0.8" />);
      if (i > 0) lines.push(<line key={`vl${i}`} x1={cx - (x - cx)} y1={0} x2={cx - (x - cx)} y2={dims.h} stroke="white" strokeWidth="0.8" />);
      if (i > 0 && i % 2 === 0) {
        labels.push(<text key={`lbr${i}`} x={x + 3} y={cy - 4} fill="white" fontSize="10" opacity="0.9">{meters}m</text>);
        labels.push(<text key={`lbl${i}`} x={cx - (x - cx) + 3} y={cy - 4} fill="white" fontSize="10" opacity="0.9">-{meters}m</text>);
      }
    }

    // Horizontal lines
    i = 0;
    for (let y = cy; y <= dims.h + interval; y += interval, i++) {
      const meters = i * calibration.cellSizeMeters;
      lines.push(<line key={`hb${i}`} x1={0} y1={y} x2={dims.w} y2={y} stroke="white" strokeWidth="0.8" />);
      if (i > 0) lines.push(<line key={`ht${i}`} x1={0} y1={cy - (y - cy)} x2={dims.w} y2={cy - (y - cy)} stroke="white" strokeWidth="0.8" />);
      if (i > 0 && i % 2 === 0) {
        labels.push(<text key={`lbb${i}`} x={cx + 4} y={y - 3} fill="white" fontSize="10" opacity="0.9">{meters}m</text>);
        labels.push(<text key={`lbt${i}`} x={cx + 4} y={cy - (y - cy) - 3} fill="white" fontSize="10" opacity="0.9">-{meters}m</text>);
      }
    }

    // Center crosshair
    lines.push(<line key="cx" x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} stroke="rgba(255,200,0,0.9)" strokeWidth="1.5" />);
    lines.push(<line key="cy" x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} stroke="rgba(255,200,0,0.9)" strokeWidth="1.5" />);

    return { lines, labels };
  }

  const grid = visible && calibration ? buildGrid() : null;
  const currentOpacity = calibration?.opacity ?? opacity;

  return (
    <>
      {/* SVG overlay */}
      {visible && (
        <svg
          ref={overlayRef}
          className="absolute inset-0 w-full h-full z-10"
          style={{
            opacity: currentOpacity,
            pointerEvents: calibMode ? "auto" : "none",
            cursor: calibMode ? "crosshair" : "default",
          }}
          onClick={calibMode ? handleOverlayClick : undefined}
        >
          {grid?.lines}
          {grid?.labels}

          {/* Calibration points */}
          {calibMode && point1 && (
            <circle cx={point1.x} cy={point1.y} r={6} fill="rgba(255,200,0,0.9)" stroke="white" strokeWidth="2" />
          )}
          {calibMode && point2 && (
            <>
              <circle cx={point2.x} cy={point2.y} r={6} fill="rgba(255,200,0,0.9)" stroke="white" strokeWidth="2" />
              <line x1={point1!.x} y1={point1!.y} x2={point2.x} y2={point2.y} stroke="rgba(255,200,0,0.9)" strokeWidth="2" strokeDasharray="6,3" />
            </>
          )}
        </svg>
      )}

      {/* Calibration mode banner */}
      {calibMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-black/80 backdrop-blur rounded-full px-4 py-2 text-yellow-400 text-sm pointer-events-none">
          {!point1 ? "Hacé clic en el punto A" : !point2 ? "Hacé clic en el punto B" : "Ingresá la distancia real abajo"}
        </div>
      )}

      {/* Panel de control */}
      {showPanel && (
        <div className="absolute top-16 right-4 z-30 bg-black/80 backdrop-blur rounded-xl border border-white/10 p-4 w-64 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold">Grilla de referencia</p>
            <button onClick={onClosePanel} className="text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle grilla */}
          <button
            onClick={onToggleGrid}
            className={cn(
              "w-full text-xs py-2 rounded-lg border transition-colors",
              visible
                ? "bg-yellow-400/20 text-yellow-400 border-yellow-400/40 hover:bg-yellow-400/30"
                : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20"
            )}
          >
            {visible ? "Ocultar grilla" : "Mostrar grilla"}
          </button>

          {/* Celda */}
          <div className="space-y-1.5">
            <p className="text-white/60 text-xs">Tamaño de celda</p>
            <div className="flex gap-1.5 flex-wrap">
              {CELL_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setCellSize(s);
                    updateDisplayProps(s, undefined);
                  }}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    cellSize === s
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "text-white/70 border-white/20 hover:border-white/50"
                  )}
                >
                  {s}m
                </button>
              ))}
            </div>
          </div>

          {/* Opacidad */}
          <div className="space-y-1.5">
            <p className="text-white/60 text-xs">Opacidad</p>
            <input
              type="range" min="0.1" max="1" step="0.05"
              value={opacity}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setOpacity(v);
                updateDisplayProps(undefined, v);
              }}
              className="w-full accent-yellow-400"
            />
          </div>

          {/* Calibración */}
          <div className="border-t border-white/10 pt-3 space-y-2">
            <p className="text-white/60 text-xs">Calibración</p>
            {!calibMode ? (
              <button
                onClick={() => { setCalibMode(true); setPoint1(null); setPoint2(null); }}
                className="w-full flex items-center justify-center gap-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 text-xs py-2 rounded-lg border border-yellow-400/30 transition-colors"
              >
                <Crosshair className="w-3.5 h-3.5" />
                {calibration ? "Recalibrar" : "Calibrar ahora"}
              </button>
            ) : (
              <div className="space-y-2">
                {point1 && point2 && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={realDistance}
                      onChange={(e) => setRealDistance(e.target.value)}
                      className="flex-1 bg-white/10 text-white text-sm px-2 py-1.5 rounded border border-white/20 focus:outline-none focus:border-yellow-400"
                      placeholder="metros"
                      min="0.01"
                      step="0.1"
                      autoFocus
                    />
                    <span className="text-white/50 text-xs">m</span>
                    <button onClick={confirmCalibration} className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded text-white">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button onClick={cancelCalibration} className="text-white/40 hover:text-white/70 text-xs">
                  Cancelar
                </button>
              </div>
            )}
            {calibration && !calibMode && (
              <p className="text-white/40 text-[10px]">
                {calibration.pixelsPerMeter.toFixed(1)} px/m · celda {calibration.cellSizeMeters}m
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
