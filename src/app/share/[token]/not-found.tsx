import { Building2 } from "lucide-react";
import Link from "next/link";

export default function ShareNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Proyecto no encontrado</h1>
        <p className="text-slate-500 text-sm mb-6">
          El enlace que recibiste puede haber expirado o el proyecto ya no está disponible para compartir.
          Contactá al estudio para obtener un nuevo enlace.
        </p>
        <p className="text-xs text-slate-400">Obra360 · Seguimiento de obra</p>
      </div>
    </div>
  );
}
