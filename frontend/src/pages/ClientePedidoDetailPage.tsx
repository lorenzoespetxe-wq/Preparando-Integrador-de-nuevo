import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getPedidoDetail, getHistorialPedido, getPagoByPedido, verifyPayment } from "../services/api";
import type { HistorialEstadoPedidoPublic } from "../services/api";
import { PaymentButton } from "../components/PaymentButton";
import { RealtimeBadge } from "../components/RealtimeBadge";
import { useOrderStatusWS } from "../hooks/useOrderStatusWS";
import { useEffect, useRef, useState } from "react";
import { SkeletonPage } from "../components/Skeleton";
import { toast } from "sonner";
import { estadoColors, estadoLabels } from "../constants/ui";
import { Badge } from "../components/Badge";

export function ClientePedidoDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);

  const pedidoQuery = useQuery({
    queryKey: ["cliente-pedido", pedidoId],
    queryFn: () => getPedidoDetail(pedidoId),
    enabled: !Number.isNaN(pedidoId),
  });

  const historialQuery = useQuery({
    queryKey: ["cliente-historial", pedidoId],
    queryFn: () => getHistorialPedido(pedidoId),
    enabled: !Number.isNaN(pedidoId),
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useOrderStatusWS(pedidoId, [
    ["cliente-pedido", pedidoId],
    ["cliente-historial", pedidoId],
    ["cliente-pago", pedidoId],
  ]);

  const [verifying, setVerifying] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    const pedido = pedidoQuery.data;
    if (!pedido || verifiedRef.current || verifying) return;
    const isMp = pedido.forma_pago_codigo === "MERCADOPAGO" || pedido.forma_pago_codigo === "mercadopago";
    if (pedido.estado_codigo === "PENDIENTE" && isMp) {
      verifiedRef.current = true;
      setVerifying(true);
      verifyPayment(pedido.id)
        .then((res) => {
          if (res.estado === "aprobado" || res.estado === "rechazado") {
            queryClient.invalidateQueries({ queryKey: ["cliente-pedido", pedidoId] });
            queryClient.invalidateQueries({ queryKey: ["cliente-pago", pedidoId] });
          }
        })
        .catch(() => {})
        .finally(() => setVerifying(false));
    }
  }, [pedidoQuery.data, pedidoId, queryClient, verifying]);

  const pagoQuery = useQuery({
    queryKey: ["cliente-pago", pedidoId],
    queryFn: () => getPagoByPedido(pedidoId),
    enabled: !Number.isNaN(pedidoId),
    retry: false,
  });

  if (Number.isNaN(pedidoId)) {
    return <p className="text-red-600">ID de pedido inválido.</p>;
  }

  if (pedidoQuery.isLoading) return <SkeletonPage />;
  if (pedidoQuery.isError || !pedidoQuery.data) {
    return <p className="text-red-600">Error al cargar el pedido.</p>;
  }

  if (verifying) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
          <p className="text-slate-600">Verificando estado del pago con MercadoPago...</p>
        </div>
      </div>
    );
  }

  const pedido = pedidoQuery.data;
  const historial = historialQuery.data?.data ?? [];
  const pago = pagoQuery.isSuccess ? pagoQuery.data : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/mis-pedidos" className="text-sm text-orange-600 hover:underline">&larr; Mis pedidos</Link>
          <h1 className="mt-1 text-3xl font-bold text-orange-900">Pedido #{pedido.id}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge estado={pedido.estado_codigo} className="px-4 py-2 text-sm font-semibold" />
          <RealtimeBadge channel={`pedido:${pedidoId}`} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900">Información</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Pedido</dt><dd className="font-mono text-slate-800">#{pedido.id}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Fecha</dt><dd className="text-slate-800">{new Date(pedido.created_at).toLocaleString("es-AR")}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Forma de pago</dt><dd className="text-slate-800">{pedido.forma_pago_codigo ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Notas</dt><dd className="text-slate-800">{pedido.notas ?? "—"}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900">Totales</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="font-mono text-slate-800">${Number(pedido.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Descuento</dt><dd className="font-mono text-slate-800">-${Number(pedido.descuento).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Envío</dt><dd className="font-mono text-slate-800">${Number(pedido.costo_envio).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="border-t border-orange-100 pt-2 flex justify-between"><dt className="font-semibold text-orange-900">Total</dt><dd className="font-mono font-bold text-orange-900">${Number(pedido.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
          </dl>
        </div>
      </div>

      {(pedido.estado_codigo === "PENDIENTE") && (!pago || pago.estado === "pendiente") && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-blue-900">Pago pendiente</h2>
              <p className="mt-1 text-sm text-blue-700">
                Completá el pago con MercadoPago para confirmar tu pedido.
              </p>
            </div>
            <PaymentButton pedidoId={pedido.id} monto={Number(pedido.total)} />
          </div>
        </div>
      )}

      {pago ? (
        <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900">Pago</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Estado</dt>
              <dd>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                  pago.estado === "aprobado" ? "bg-green-100 text-green-800" :
                  pago.estado === "rechazado" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>
                  {pago.estado === "aprobado" ? "Aprobado" :
                   pago.estado === "rechazado" ? "Rechazado" : "Pendiente"}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Monto</dt>
              <dd className="font-mono font-medium text-orange-900">${Number(pago.monto).toFixed(2)}</dd>
            </div>
            {pago.mp_payment_id ? (
              <div className="flex justify-between">
                <dt className="text-slate-600">ID MercadoPago</dt>
                <dd className="font-mono text-slate-800">{pago.mp_payment_id}</dd>
              </div>
            ) : null}
            {pago.mp_status ? (
              <div className="flex justify-between">
                <dt className="text-slate-600">Estado MP</dt>
                <dd>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                    pago.mp_status === "approved" ? "bg-green-100 text-green-800" :
                    pago.mp_status === "rejected" ? "bg-red-100 text-red-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {pago.mp_status}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-orange-900">Productos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orange-100">
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Producto</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Cant.</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Precio unit.</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.detalles.map((d) => (
              <tr key={d.id} className="border-b border-orange-50 hover:bg-orange-50/50">
                <td className="px-3 py-2 font-medium text-slate-800">{d.nombre_snapshot}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700">{d.cantidad}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700">${Number(d.precio_snapshot).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700">${Number(d.subtotal_snapshot).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-orange-900">Historial</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-500">Sin cambios registrados.</p>
        ) : (
          <div className="space-y-3">
            {[...historial].reverse().map((h: HistorialEstadoPedidoPublic) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-orange-50 bg-orange-50/50 p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${estadoColors[h.estado_desde_codigo]?.bg ?? "bg-slate-100"} ${estadoColors[h.estado_desde_codigo]?.text ?? "text-slate-800"}`}>
                      {estadoLabels[h.estado_desde_codigo] ?? h.estado_desde_codigo}
                    </span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${estadoColors[h.estado_hacia_codigo]?.bg ?? "bg-slate-100"} ${estadoColors[h.estado_hacia_codigo]?.text ?? "text-slate-800"}`}>
                      {estadoLabels[h.estado_hacia_codigo] ?? h.estado_hacia_codigo}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(h.fecha).toLocaleString("es-AR")}
                    {h.motivo ? ` — ${h.motivo}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
