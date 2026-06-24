import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getPedidosWebSocketUrl, listPedidos, cancelarPedido, recibirPedido, type PedidoPublic } from "../services/api";
import { SkeletonPage } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { useWebSocketChannel } from "../hooks/useOrderStatusWS";
import { useAuth } from "../context/AuthContext";
import { useAuthStore } from "../stores/authStore";
import { useCart } from "../context/CartContext";
import { ALL_ESTADOS } from "../constants/ui";

export function MisPedidosPage(): JSX.Element {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<PedidoPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  const [recibiendoId, setRecibiendoId] = useState<number | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PedidoPublic | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");

  const handleCancelar = async () => {
    if (!cancelTarget) return;
    const motivo = cancelMotivo.trim()
      ? `Cancelaste el pedido: ${cancelMotivo.trim()}`
      : "Cancelaste el pedido";
    setCancelandoId(cancelTarget.id);
    setShowCancelDialog(false);
    try {
      await cancelarPedido(cancelTarget.id, motivo);
      sessionStorage.removeItem("prev_cart");
      sessionStorage.removeItem("checkout_pedido_id");
      limpiarCarrito();
      setPedidos((prev) => prev.map((p) => p.id === cancelTarget.id ? { ...p, estado_codigo: "CANCELADO", motivo } : p));
    } catch {
      toast.error("No se pudo cancelar el pedido");
    } finally {
      setCancelandoId(null);
      setCancelTarget(null);
      setCancelMotivo("");
    }
  };

  const handleRecibir = async (pedidoId: number) => {
    setRecibiendoId(pedidoId);
    try {
      await recibirPedido(pedidoId);
      sessionStorage.removeItem("prev_cart");
      sessionStorage.removeItem("checkout_pedido_id");
      limpiarCarrito();
      setPedidos((prev) => prev.map((p) => p.id === pedidoId ? { ...p, estado_codigo: "ENTREGADO" } : p));
    } catch {
      toast.error("No se pudo marcar como recibido");
    } finally {
      setRecibiendoId(null);
    }
  };

  const { token } = useAuth();
  const tabId = useAuthStore((s) => s.tabId);

  const cargarPedidos = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await listPedidos(0, 50);
      setPedidos(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const [searchParams, setSearchParams] = useSearchParams();
  const { limpiarCarrito } = useCart();

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      sessionStorage.removeItem("prev_cart");
      sessionStorage.removeItem("checkout_pedido_id");
      limpiarCarrito();
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, limpiarCarrito]);

  useWebSocketChannel({
    channel: "mis-pedidos",
    enabled: Boolean(token),
    buildUrl: () => (token ? getPedidosWebSocketUrl(token, tabId) : null),
    onEvent: cargarPedidos,
    onReconnect: cargarPedidos,
  });

  const filtrados = useMemo(() => {
    let items = pedidos;
    if (searchId.trim()) {
      const id = parseInt(searchId, 10);
      if (!Number.isNaN(id)) {
        items = items.filter((p) => p.id === id);
      }
    }
    if (filterEstado) {
      items = items.filter((p) => p.estado_codigo === filterEstado);
    }
    return items;
  }, [pedidos, searchId, filterEstado]);

  if (loading) {
    return <SkeletonPage />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-6">
        <p className="text-red-700">Error: {error}</p>
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="rounded-lg border border-orange-100 bg-white/90 p-8 text-center">
        <p className="text-2xl font-bold text-orange-900">No tienes pedidos aún</p>
        <p className="mt-2 text-orange-700">Comienza a comprar desde nuestro catálogo</p>
        <a
          href="/productos"
          className="mt-4 inline-block rounded bg-orange-500 px-6 py-2 font-medium text-white hover:bg-orange-600"
        >
          Ver Productos
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-orange-900">Mis Pedidos</h1>

      <div className="flex flex-wrap gap-3">
        <input
          type="number"
          placeholder="Buscar por # de pedido"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-400 focus:outline-none"
        />
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {ALL_ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-600">No se encontraron pedidos con esos filtros.</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((pedido) => {
            const displayState = pedido.estado_codigo === "ESPERANDO_CLIENTE" ? "EN_PREP" : pedido.estado_codigo;
            return (
            <Link
              key={pedido.id}
              to={`/cliente/pedido/${pedido.id}`}
              className="block rounded-lg border border-orange-100 bg-white/90 p-4 shadow-sm transition hover:shadow-md hover:border-orange-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900">Pedido #{pedido.id}</h3>
                  <p className="text-sm text-orange-700">
                    {pedido.created_at
                      ? new Date(pedido.created_at).toLocaleDateString("es-AR")
                      : "Sin fecha"}
                  </p>
                  {pedido.estado_codigo === "CANCELADO" && (
                    <div className="mt-1 text-xs text-red-600">
                      {pedido.motivo?.startsWith("Cancelaste") ? (
                        <p>Cancelaste el pedido</p>
                      ) : (
                        <p>
                          Pedido cancelado por Food Store
                          {pedido.motivo && `: ${pedido.motivo}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {pedido.estado_codigo === "ESPERANDO_CLIENTE" && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRecibir(pedido.id);
                      }}
                      disabled={recibiendoId === pedido.id}
                      className="rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
                    >
                      {recibiendoId === pedido.id ? "..." : "Recibir"}
                    </button>
                  )}
                  {displayState === "EN_PREP" && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setCancelTarget(pedido);
                        setCancelMotivo("");
                        setShowCancelDialog(true);
                      }}
                      disabled={cancelandoId === pedido.id}
                      className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      {cancelandoId === pedido.id ? "..." : "Cancelar"}
                    </button>
                  )}
                  <div className="text-right">
                    {pedido.estado_codigo !== "ESPERANDO_CLIENTE" && (
                      <Badge estado={displayState} />
                    )}
                    <p className="mt-2 font-bold text-orange-900">${Number(pedido.total).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </Link>
          );})}
        </div>
      )}

      {showCancelDialog && cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Cancelar pedido #{cancelTarget.id}</h3>
            <p className="mt-1 text-sm text-slate-600">Escribí el motivo de cancelación.</p>
            <div className="mt-4">
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Ej: Mucha demora, cambié de opinión..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                rows={3}
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => { setShowCancelDialog(false); setCancelTarget(null); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Volver
              </button>
              <button
                onClick={handleCancelar}
                disabled={cancelandoId === cancelTarget.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelandoId === cancelTarget.id ? "Cancelando..." : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


