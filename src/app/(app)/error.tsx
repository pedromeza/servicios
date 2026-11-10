"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Pantalla de error de la app: en lugar del genérico de Next, explica qué revisar y permite reintentar. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-8 max-w-lg px-6 py-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle size={26} />
      </div>
      <h1 className="text-lg font-semibold text-navy-900">No se pudo cargar esta sección</h1>
      <p className="mt-2 text-sm text-slate-600">
        Suele deberse a que la base de datos va atrasada respecto al código (una migración de <code>supabase/migrations/</code> sin aplicar) o a un
        problema momentáneo con Supabase. Revisa el aviso amarillo del panel o el log del despliegue en Vercel.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-slate-400">Referencia: {error.digest}</p>}
      <div className="mt-6 flex justify-center">
        <Button onClick={reset}>
          <RotateCcw size={16} /> Reintentar
        </Button>
      </div>
    </Card>
  );
}
