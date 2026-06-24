import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { getPedidoDetail, getHistorialPedido, getPagoByPedido, confirmPayment, manualAprobarPago, verifyPayment } from "../services/api";
import type { HistorialEstadoPedidoPublic } from "../services/api";

const stateLabels: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Pagado",
  EN_PREP: "Preparando",
  TERMINADO: "Terminado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const stateColors: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  CONFIRMADO: "bg-blue-100 text-blue-800",
  EN_PREP: "bg-purple-100 text-purple-800",
  TERMINADO: "bg-teal-100 text-teal-800",
  ENTREGADO: "bg-green-100 text-green-800",
  CANCELADO: "bg-red-100 text-red-800",
};

const pagoEstadoLabel: Record<string, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const pagoEstadoColor: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  aprobado: "bg-green-100 text-green-800",
  rechazado: "bg-red-100 text-red-800",
};

const mpStatusColor: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  in_process: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-800",
  refunded: "bg-orange-100 text-orange-800",
  charged_back: "bg-red-100 text-red-800",
};

export function VentaDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const ventaId = Number(id);

  const ventaQuery = useQuery({
    queryKey: ["venta", ventaId],
    queryFn: () => getPedidoDetail(ventaId),
    enabled: !Number.isNaN(ventaId),
  });

  const historialQuery = useQuery({
    queryKey: ["venta-historial", ventaId],
    queryFn: () => getHistorialPedido(ventaId),
    enabled: !Number.isNaN(ventaId),
  });

  const pagoQuery = useQuery({
    queryKey: ["venta-pago", ventaId],
    queryFn: () => getPagoByPedido(ventaId),
    enabled: !Number.isNaN(ventaId),
    retry: false,
    refetchInterval: 10_000,
  });

  const confirmPago = useMutation({
    mutationFn: () => confirmPayment(ventaId),
    onSuccess: () => {
      pagoQuery.refetch();
      ventaQuery.refetch();
    },
  });

  const [manualPaymentId, setManualPaymentId] = useState("");

  const verifyConId = useMutation({
    mutationFn: (paymentId: number) => confirmPayment(ventaId, paymentId),
    onSuccess: () => {
      setManualPaymentId("");
      pagoQuery.refetch();
      ventaQuery.refetch();
    },
  });

  const aprobarManual = useMutation({
    mutationFn: () => manualAprobarPago({ pedido_id: ventaId }),
    onSuccess: () => {
      pagoQuery.refetch();
      ventaQuery.refetch();
    },
  });

  const [verifying, setVerifying] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    const venta = ventaQuery.data;
    if (!venta || verifiedRef.current || verifying) return;
    const isMp = venta.forma_pago_codigo === "MERCADOPAGO" || venta.forma_pago_codigo === "mercadopago";
    if (venta.estado_codigo === "PENDIENTE" && isMp) {
      verifiedRef.current = true;
      setVerifying(true);
      verifyPayment(venta.id)
        .then((res) => {
          if (res.estado === "aprobado" || res.estado === "rechazado") {
            ventaQuery.refetch();
            pagoQuery.refetch();
          }
        })
        .catch(() => {})
        .finally(() => setVerifying(false));
    }
  }, [ventaQuery.data, ventaId, ventaQuery, pagoQuery, verifying]);

  if (Number.isNaN(ventaId)) {
    return <p className="text-red-600">ID de venta inválido.</p>;
  }

  if (ventaQuery.isLoading) return <p className="text-slate-600">Cargando venta...</p>;
  if (ventaQuery.isError || !ventaQuery.data) {
    return <p className="text-red-600">Error al cargar la venta.</p>;
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

  const venta = ventaQuery.data;
  const historial = historialQuery.data?.data ?? [];
  const pago = pagoQuery.isSuccess ? pagoQuery.data : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/ventas" className="text-sm text-orange-600 hover:underline">&larr; Volver a ventas</Link>
          <h1 className="mt-1 text-3xl font-bold text-orange-900">Venta #{venta.id}</h1>
        </div>
        <span className={`rounded-full px-4 py-2 text-sm font-semibold ${stateColors[venta.estado_codigo] ?? "bg-slate-100 text-slate-800"}`}>
          {stateLabels[venta.estado_codigo] ?? venta.estado_codigo}
        </span>
      </div>

      {/* Info + Totales */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900">Información</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Cliente ID</dt><dd className="font-mono text-slate-800">{venta.usuario_id}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Fecha</dt><dd className="text-slate-800">{new Date(venta.created_at).toLocaleString("es-AR")}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Forma de pago</dt><dd className="text-slate-800">{venta.forma_pago_codigo ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Notas</dt><dd className="text-slate-800">{venta.notas ?? "—"}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900">Totales</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="font-mono text-slate-800">${Number(venta.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Descuento</dt><dd className="font-mono text-slate-800">-${Number(venta.descuento).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Envío</dt><dd className="font-mono text-slate-800">${Number(venta.costo_envio).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
            <div className="border-t border-orange-100 pt-2 flex justify-between"><dt className="font-semibold text-orange-900">Total</dt><dd className="font-mono font-bold text-orange-900">${Number(venta.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</dd></div>
          </dl>
        </div>
      </div>

      {/* Info de pago MP */}
      {pagoQuery.isLoading ? (
        <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900">Pago (MercadoPago)</h2>
          <p className="text-sm text-slate-500">Consultando estado del pago...</p>
        </div>
      ) : pago ? (
        <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-orange-900">Pago (MercadoPago)</h2>
            {pago.estado === "pendiente" ? (
              <span className="text-xs text-slate-400">Se actualiza automáticamente cada 10s</span>
            ) : null}
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Estado del pago</dt>
              <dd>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${pagoEstadoColor[pago.estado] ?? "bg-slate-100"}`}>
                  {pagoEstadoLabel[pago.estado] ?? pago.estado}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Estado MP</dt>
              <dd>
                {pago.mp_status ? (
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${mpStatusColor[pago.mp_status] ?? "bg-slate-100"}`}>
                    {pago.mp_status}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Detalle MP</dt>
              <dd className="font-mono text-slate-800">{pago.mp_status_detail ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Payment ID</dt>
              <dd className="font-mono text-slate-800">{pago.mp_payment_id ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Preference ID</dt>
              <dd className="font-mono text-slate-800 text-xs">{pago.mp_preference_id ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Monto</dt>
              <dd className="font-mono font-medium text-orange-900">${Number(pago.monto).toFixed(2)}</dd>
            </div>
          </dl>

          {pago.estado === "pendiente" ? (
            <div className="mt-4 space-y-3 border-t border-orange-100 pt-4">
              {confirmPago.isError ? (
                <p className="text-sm text-red-600">Error: {confirmPago.error.message}</p>
              ) : null}
              {verifyConId.isError ? (
                <p className="text-sm text-red-600">Error: {verifyConId.error.message}</p>
              ) : null}
              {aprobarManual.isError ? (
                <p className="text-sm text-red-600">Error: {aprobarManual.error.message}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => confirmPago.mutate()}
                  disabled={confirmPago.isPending}
                  className="rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {confirmPago.isPending ? "Verificando..." : "Re-verificar en MP"}
                </button>

                <button
                  type="button"
                  onClick={() => aprobarManual.mutate()}
                  disabled={aprobarManual.isPending}
                  className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {aprobarManual.isPending ? "Aprobando..." : "Aprobar manualmente (efectivo)"}
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Payment ID de MP"
                  value={manualPaymentId}
                  onChange={(e) => setManualPaymentId(e.target.value)}
                  className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const id = Number(manualPaymentId);
                    if (id > 0) verifyConId.mutate(id);
                  }}
                  disabled={verifyConId.isPending || !manualPaymentId}
                  className="rounded bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {verifyConId.isPending ? "Verificando..." : "Verificar con ID"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-orange-900">Pago (MercadoPago)</h2>
          <p className="text-sm text-slate-500">No se encontró pago registrado con MercadoPago.</p>
        </div>
      )}

      {/* Productos vendidos */}
      <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-orange-900">Productos vendidos</h2>
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
            {venta.detalles.map((d) => (
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

      {/* Historial */}
      <div className="rounded-xl border border-orange-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-orange-900">Historial de estados</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-500">Sin cambios registrados.</p>
        ) : (
          <div className="space-y-3">
            {[...historial].reverse().map((h: HistorialEstadoPedidoPublic) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-orange-50 bg-orange-50/50 p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${stateColors[h.estado_desde_codigo] ?? "bg-slate-100"}`}>
                      {stateLabels[h.estado_desde_codigo] ?? h.estado_desde_codigo}
                    </span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${stateColors[h.estado_hacia_codigo] ?? "bg-slate-100"}`}>
                      {stateLabels[h.estado_hacia_codigo] ?? h.estado_hacia_codigo}
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
