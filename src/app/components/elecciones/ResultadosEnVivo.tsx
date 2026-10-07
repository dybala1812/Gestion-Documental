/**
 * ResultadosEnVivo.tsx
 * Escrutinio en tiempo real. Se suscribe al WebSocket del período y, si este
 * falla, cae a un sondeo (polling) periódico sobre el endpoint REST.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { BarChart3, Loader2, Wifi, WifiOff } from "lucide-react";
import {
  openResultsSocket,
  apiGetResults,
  type CollegiateTally,
} from "../../lib/eleccionesApi";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface Props {
  periodId: string;
  /** true para usar el endpoint de admin (resultados completos aunque no estén publicados). */
  isAdmin?: boolean;
}

export function ResultadosEnVivo({ periodId }: Props) {
  const [tallies, setTallies] = useState<CollegiateTally[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mergeTally = useCallback((incoming: CollegiateTally) => {
    setTallies((prev) => {
      const idx = prev.findIndex((t) => t.collegiate_id === incoming.collegiate_id);
      if (idx === -1) return [...prev, incoming];
      const next = [...prev];
      next[idx] = incoming;
      return next;
    });
  }, []);

  const loadOnce = useCallback(async () => {
    try {
      const res = await apiGetResults(periodId);
      setTallies(res.collegiates);
    } catch {
      /* silencioso: el WS o el siguiente poll reintentará */
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    let closedByUser = false;
    loadOnce();

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(loadOnce, 8000);
    };

    try {
      const ws = openResultsSocket(periodId);
      wsRef.current = ws;
      ws.onopen = () => setLive(true);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "results.snapshot") {
            setTallies(msg.data as CollegiateTally[]);
            setLoading(false);
          } else if (msg.type === "results.update") {
            mergeTally(msg.data as CollegiateTally);
          }
        } catch {
          /* ignora frames malformados */
        }
      };
      ws.onclose = () => {
        setLive(false);
        if (!closedByUser) startPolling();
      };
      ws.onerror = () => {
        setLive(false);
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      closedByUser = true;
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [periodId, loadOnce, mergeTally]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando resultados…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {live ? (
          <span className="inline-flex items-center gap-1 text-green-600">
            <Wifi className="h-4 w-4" /> En vivo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <WifiOff className="h-4 w-4" /> Actualización periódica
          </span>
        )}
      </div>

      {tallies.length === 0 && (
        <p className="text-gray-500">Aún no hay resultados para mostrar.</p>
      )}

      {tallies.map((t) => {
        const maxVotes = Math.max(1, ...t.results.map((r) => r.votes), t.blank_votes);
        return (
          <Card key={t.collegiate_id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                {t.collegiate}
                <span className="ml-auto text-xs font-normal text-gray-500">
                  {t.total_votes} voto{t.total_votes !== 1 ? "s" : ""} · {t.role}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {t.results.map((r) => (
                <div key={r.ballot_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs">
                        {r.number}
                      </span>
                      {r.candidate}
                      {r.elected && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Electo
                        </span>
                      )}
                    </span>
                    <span className="font-semibold">{r.votes}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(r.votes / maxVotes) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-sm text-gray-500">
                <span>Votos en blanco</span>
                <span className="font-semibold">{t.blank_votes}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
