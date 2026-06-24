import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getPedidosWebSocketUrl,
  listPedidos,
  getVentas,
  getProductosTop,
  getPedidosPorEstado,
  type PedidoPublic,
  type PedidosFilter,
  type VentaItem,
  type ProductoTopItem,
  type PedidosPorEstadoItem,
} from "../services/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";

function asNumber(value: number | string): number {
  return Number(value ?? 0);
}

const estadoColor: Record<string, string> = {
  PENDIENTE: "text-yellow-600",
  CONFIRMADO: "text-blue-600",
  EN_PREP: "text-purple-600",
  TERMINADO: "text-teal-600",
  ENTREGADO: "text-green-700",
  CANCELADO: "text-red-600",
};

const estadoBadgeBg: Record<string, string> = {
  PENDIENTE: "bg-yellow-500",
  CONFIRMADO: "bg-blue-500",
  EN_PREP: "bg-purple-500",
  TERMINADO: "bg-teal-500",
  ENTREGADO: "bg-green-600",
  CANCELADO: "bg-red-500",
};

const ESTADOS = ["PENDIENTE", "CONFIRMADO", "EN_PREP", "ENTREGADO", "CANCELADO"] as const;
const FILTER_ESTADOS = ["", "PENDIENTE", "CONFIRMADO", "EN_PREP", "ENTREGADO", "CANCELADO"] as const;
const FORMAS_PAGO = ["", "EFECTIVO", "MERCADOPAGO", "TRANSFERENCIA"] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatMoney(value: number | string): string {
  const n = Number(value ?? 0);
  return `$${n.toFixed(2)}`;
}

export function VentasPage(): JSX.Element {
  const [pedidos, setPedidos] = useState<PedidoPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarVentas = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await listPedidos(0, 100);
      setPedidos(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando ventas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarVentas();
    const ws = new WebSocket(getPedidosWebSocketUrl());
    ws.onmessage = () => cargarVentas();
    const interval = setInterval(cargarVentas, 10_000);
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [cargarVentas]);

  const stats = useMemo(() => {
    const porEstado: Record<string, { count: number; total: number }> = {};
    for (const e of ESTADOS) {
      porEstado[e] = { count: 0, total: 0 };
    }
    let pagadosTotal = 0;
    let pagadosCount = 0;
    for (const p of pedidos) {
      const t = asNumber(p.total);
      if (porEstado[p.estado_codigo]) {
        porEstado[p.estado_codigo].count += 1;
        porEstado[p.estado_codigo].total += t;
      }
      const esPagado = p.pago_estado === "aprobado" || ["CONFIRMADO", "EN_PREP", "ENTREGADO"].includes(p.estado_codigo);
      if (esPagado) {
        pagadosTotal += t;
        pagadosCount += 1;
      }
    }
    const totalPedidos = pedidos.length;
    const maxCount = Math.max(...ESTADOS.map((e) => porEstado[e].count), 1);
    return { porEstado, pagadosTotal, pagadosCount, totalPedidos, maxCount };
  }, [pedidos]);

  const promedioTicket = (() => {
    return stats.pagadosCount > 0 ? stats.pagadosTotal / stats.pagadosCount : 0;
  })();

  // ---- Tabla de todos los pedidos ----
  const [tablaPedidos, setTablaPedidos] = useState<PedidoPublic[]>([]);
  const [tablaTotal, setTablaTotal] = useState(0);
  const [tablaLoading, setTablaLoading] = useState(false);
  const [tablaError, setTablaError] = useState<string | null>(null);

  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroFormaPago, setFiltroFormaPago] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const cargarTabla = useCallback(async () => {
    setTablaLoading(true);
    setTablaError(null);
    try {
      const filter: PedidosFilter = {};
      if (filtroEstado) filter.estado = filtroEstado;
      if (filtroFormaPago) filter.forma_pago = filtroFormaPago;
      if (filtroFechaDesde) filter.fecha_desde = new Date(filtroFechaDesde).toISOString();
      if (filtroFechaHasta) {
        const end = new Date(filtroFechaHasta);
        end.setHours(23, 59, 59, 999);
        filter.fecha_hasta = end.toISOString();
      }
      const data = await listPedidos(page * pageSize, pageSize, filter);
      setTablaPedidos(data.data);
      setTablaTotal(data.total);
    } catch (err) {
      setTablaError(err instanceof Error ? err.message : "Error al cargar pedidos");
    } finally {
      setTablaLoading(false);
    }
  }, [filtroEstado, filtroFormaPago, filtroFechaDesde, filtroFechaHasta, page]);

  useEffect(() => {
    cargarTabla();
  }, [cargarTabla]);

  const totalPages = Math.ceil(tablaTotal / pageSize);

  // ---- Charts data ----
  const [ventasDiarias, setVentasDiarias] = useState<VentaItem[]>([]);
  const [productosTop, setProductosTop] = useState<ProductoTopItem[]>([]);
  const [pedidosPorEstado, setPedidosPorEstado] = useState<PedidosPorEstadoItem[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    async function loadCharts() {
      try {
        const [v, pt, pe] = await Promise.all([
          getVentas(),
          getProductosTop(8),
          getPedidosPorEstado(),
        ]);
        setVentasDiarias(v.data.slice().reverse());
        setProductosTop(pt.data);
        setPedidosPorEstado(pe.data);
      } catch {
        // charts are optional, silently fail
      } finally {
        setChartsLoading(false);
      }
    }
    loadCharts();
  }, []);

  const ESTADO_CHART_COLORS: Record<string, string> = {
    PENDIENTE: "#EAB308",
    CONFIRMADO: "#3B82F6",
    EN_PREP: "#A855F7",
    TERMINADO: "#14B8A6",
    ENTREGADO: "#16A34A",
    CANCELADO: "#EF4444",
  };

  if (loading && pedidos.length === 0) {
    return <p className="text-slate-700">Cargando ventas...</p>;
  }

  if (error) {
    return <p className="text-red-600">No se pudieron cargar las ventas: {error}</p>;
  }

  return (
    <div className="space-y-5">
      {/* DASHBOARD */}
      <section className="rounded-3xl border border-orange-100 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="mb-5">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-700">Dashboard</p>
          <h1 className="text-3xl font-semibold text-orange-950">Ventas</h1>
          <p className="mt-2 text-sm text-slate-600">
            {pedidos.length} pedidos &middot; {stats.pagadosCount} pagados &middot; se actualiza cada 10s
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-green-700">Ingresos cobrados</p>
            <p className="mt-2 text-2xl font-semibold text-green-950">${stats.pagadosTotal.toFixed(2)}</p>
            <p className="mt-1 text-sm text-green-600">{stats.pagadosCount} pedidos pagados</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Ticket promedio</p>
            <p className="mt-2 text-2xl font-semibold text-blue-950">${promedioTicket.toFixed(2)}</p>
            <p className="mt-1 text-sm text-blue-600">Por pedido pagado</p>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-purple-700">En preparación</p>
            <p className="mt-2 text-2xl font-semibold text-purple-950">
              {stats.porEstado["EN_PREP"].count}
            </p>
            <p className="mt-1 text-sm text-purple-600">{stats.porEstado["EN_PREP"].count} pedidos en preparación</p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-red-700">Cancelados</p>
            <p className="mt-2 text-2xl font-semibold text-red-950">{stats.porEstado["CANCELADO"].count}</p>
            <p className="mt-1 text-sm text-red-600">${stats.porEstado["CANCELADO"].total.toFixed(2)} en cancelados</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-orange-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-orange-950">Distribución de pedidos por estado</h2>
          <div className="flex h-6 overflow-hidden rounded-full bg-slate-100">
            {ESTADOS.filter((e) => stats.porEstado[e].count > 0).map((e) => {
              const pct = (stats.porEstado[e].count / Math.max(stats.totalPedidos, 1)) * 100;
              return (
                <div
                  key={e}
                  style={{ width: `${pct}%` }}
                  className={`${estadoBadgeBg[e] ?? "bg-slate-400"} flex items-center justify-center text-[10px] font-bold text-white transition-all first:rounded-l-full last:rounded-r-full`}
                  title={`${e}: ${stats.porEstado[e].count} pedidos`}
                >
                  {pct > 8 ? `${Math.round(pct)}%` : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {ESTADOS.filter((e) => stats.porEstado[e].count > 0).map((e) => (
              <span key={e} className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${estadoBadgeBg[e] ?? "bg-slate-400"}`} />
                {e}: {stats.porEstado[e].count}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-orange-950">Ingresos por estado</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-100 text-left text-xs text-slate-500 uppercase">
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 text-right font-medium">Pedidos</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {ESTADOS.filter((e) => stats.porEstado[e].count > 0).map((e) => (
                  <tr key={e} className="border-b border-orange-50">
                    <td className={`py-1.5 font-medium ${estadoColor[e] ?? "text-slate-700"}`}>{e}</td>
                    <td className="py-1.5 text-right text-slate-700">{stats.porEstado[e].count}</td>
                    <td className="py-1.5 text-right font-mono text-slate-800">${stats.porEstado[e].total.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-orange-900">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right">{stats.totalPedidos}</td>
                  <td className="pt-2 text-right">${pedidos.reduce((a, p) => a + asNumber(p.total), 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-orange-950">Resumen rápido</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between rounded bg-orange-50/50 px-3 py-2">
                <dt className="text-slate-600">Tasa de conversión</dt>
                <dd className="font-semibold text-orange-900">
                  {stats.totalPedidos > 0
                    ? `${((stats.pagadosCount / stats.totalPedidos) * 100).toFixed(1)}%`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between rounded bg-orange-50/50 px-3 py-2">
                <dt className="text-slate-600">Tasa de cancelación</dt>
                <dd className="font-semibold text-red-600">
                  {stats.totalPedidos > 0
                    ? `${((stats.porEstado["CANCELADO"].count / stats.totalPedidos) * 100).toFixed(1)}%`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between rounded bg-orange-50/50 px-3 py-2">
                <dt className="text-slate-600">Ingreso neto estimado</dt>
                <dd className="font-mono font-semibold text-green-700">
                  ${(stats.pagadosTotal - stats.porEstado["CANCELADO"].total).toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between rounded bg-orange-50/50 px-3 py-2">
                <dt className="text-slate-600">Pedido más caro (pagado)</dt>
                <dd className="font-mono font-semibold text-orange-900">
                  ${Math.max(...pedidos.filter((p) => p.pago_estado === "aprobado").map((p) => asNumber(p.total)), 0).toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* CHARTS */}
      <section className="rounded-3xl border border-orange-100 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="mb-5">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-700">Gráficos</p>
          <h2 className="text-2xl font-semibold text-orange-950">Estadísticas</h2>
        </div>

        {chartsLoading ? (
          <p className="text-sm text-slate-500">Cargando gráficos...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Ventas diarias (líneas) */}
            <div className="rounded-2xl border border-orange-100 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-orange-950">Ventas diarias (últimos 30 días)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={ventasDiarias}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5, 10)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => typeof v === "string" ? new Date(v).toLocaleDateString("es-AR") : v}
                  />
                  <Line type="monotone" dataKey="total" stroke="#EA580C" strokeWidth={2} name="Total $" dot={false} />
                  <Line type="monotone" dataKey="pedidos" stroke="#F97316" strokeWidth={2} name="Pedidos" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Productos top (barras) */}
            <div className="rounded-2xl border border-orange-100 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-orange-950">Top productos vendidos</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productosTop} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [value, name === "cantidad_vendida" ? "Cantidad" : "Total $"]}
                  />
                  <Bar dataKey="cantidad_vendida" fill="#EA580C" radius={[0, 4, 4, 0]} name="cantidad_vendida" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pedidos por estado (torta) */}
            <div className="rounded-2xl border border-orange-100 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-orange-950">Pedidos por estado</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pedidosPorEstado}
                    dataKey="cantidad"
                    nameKey="estado"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, payload }: any) =>
                      payload ? `${name} ${payload.porcentaje.toFixed(1)}%` : name
                    }
                    labelLine
                  >
                    {pedidosPorEstado.map((entry) => (
                      <Cell key={entry.estado} fill={ESTADO_CHART_COLORS[entry.estado] ?? "#94A3B8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Ingresos mensuales */}
            <div className="rounded-2xl border border-orange-100 bg-white p-4 flex flex-col justify-center">
              <h3 className="mb-1 text-sm font-semibold text-orange-950">Comparativa mensual</h3>
              <div className="mt-2 space-y-3 text-sm">
                {(() => {
                  const ingresosData = (() => {
                    const total = pedidos
                      .filter((p) => p.pago_estado === "aprobado")
                      .reduce((s, p) => s + Number(p.total), 0);
                    return total;
                  })();
                  return (
                    <>
                      <div className="flex justify-between rounded bg-orange-50/50 px-3 py-2">
                        <span className="text-slate-600">Total ingresado</span>
                        <span className="font-mono font-semibold text-green-700">${ingresosData.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between rounded bg-orange-50/50 px-3 py-2">
                        <span className="text-slate-600">Ticket promedio</span>
                        <span className="font-mono font-semibold text-orange-900">
                          ${(stats.pagadosCount > 0 ? ingresosData / stats.pagadosCount : 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between rounded bg-orange-50/50 px-3 py-2">
                        <span className="text-slate-600">Tasa de conversión</span>
                        <span className="font-semibold text-orange-900">
                          {stats.totalPedidos > 0
                            ? `${((stats.pagadosCount / stats.totalPedidos) * 100).toFixed(1)}%`
                            : "—"}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* TODOS LOS PEDIDOS */}
      <section className="rounded-3xl border border-orange-100 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-orange-950">Todos los Pedidos</h1>
          <p className="mt-1 text-sm text-slate-600">{tablaTotal} pedidos encontrados</p>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); setPage(0); }}
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm"
            >
              {FILTER_ESTADOS.map((e) => (
                <option key={e} value={e}>{e || "Todos los estados"}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Forma de pago</label>
            <select
              value={filtroFormaPago}
              onChange={(e) => { setFiltroFormaPago(e.target.value); setPage(0); }}
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm"
            >
              {FORMAS_PAGO.map((f) => (
                <option key={f} value={f}>{f || "Todas"}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Desde</label>
            <input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => { setFiltroFechaDesde(e.target.value); setPage(0); }}
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Hasta</label>
            <input
              type="date"
              value={filtroFechaHasta}
              onChange={(e) => { setFiltroFechaHasta(e.target.value); setPage(0); }}
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        {tablaError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{tablaError}</div>
        )}

        <div className="overflow-x-auto rounded-xl border border-orange-100">
          <table className="w-full text-sm">
            <thead className="bg-orange-50 text-left text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100">
              {tablaPedidos.length === 0 && !tablaLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No se encontraron pedidos
                  </td>
                </tr>
              )}
              {tablaPedidos.map((p) => (
                <tr key={p.id} className="hover:bg-orange-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{p.id}</td>
                  <td className="px-4 py-3 text-slate-700">{p.usuario_id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${estadoBadgeBg[p.estado_codigo] ?? "bg-slate-400"}`}>
                      {p.estado_codigo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.forma_pago_codigo || "-"}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{formatMoney(p.total)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/ventas/${p.id}`}
                      className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
              {tablaLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Cargando...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded bg-orange-100 px-3 py-1.5 font-medium text-orange-800 hover:bg-orange-200 disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span>Página {page + 1} de {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="rounded bg-orange-100 px-3 py-1.5 font-medium text-orange-800 hover:bg-orange-200 disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
