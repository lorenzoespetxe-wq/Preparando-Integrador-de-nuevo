import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, listDireccionesUsuario, updatePedidoDireccion, type DireccionEntregaPublic } from '../services/api'
import { PaymentButton } from '../components/PaymentButton'
import { usePaymentStore } from '../stores/paymentStore'
import { SkeletonPage } from '../components/Skeleton'
import { useOrderStatusWS } from '../hooks/useOrderStatusWS'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

interface OrderData {
  id: number
  total: number
  estado_codigo: string
  direccion_entrega_id: number
}

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [direcciones, setDirecciones] = useState<DireccionEntregaPublic[]>([])
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatingDir, setUpdatingDir] = useState(false)

  const pedidoQuery = useQuery({
    queryKey: ["cliente-pago-pedido", orderId],
    queryFn: () => api.get(`/pedidos/${orderId}`).then(r => r.data as OrderData),
    enabled: !!orderId && !!user,
  })

  useOrderStatusWS(Number(orderId), [["cliente-pago-pedido", Number(orderId)]])

  // If admin cancels while client is on payment page, redirect with error
  useEffect(() => {
    if (pedidoQuery.data?.estado_codigo === "CANCELADO") {
      toast.error("Hubo un error, por favor intente nuevamente mas tarde")
      navigate("/home")
    }
  }, [pedidoQuery.data?.estado_codigo, navigate])

  // Proceso de pago centralizado en el paymentStore (consigna §12).
  const paymentStatus = usePaymentStore((s) => s.status)
  const resetPayment = usePaymentStore((s) => s.reset)
  const startCash = usePaymentStore((s) => s.startCash)
  const failPayment = usePaymentStore((s) => s.fail)
  const paymentInitiated = paymentStatus === 'initiated'
  const cashLoading = paymentStatus === 'confirming_cash'

  // Cada pedido arranca su proceso de pago desde cero.
  useEffect(() => {
    resetPayment()
    return () => resetPayment()
  }, [orderId, resetPayment])

  useEffect(() => {
    if (!user || !orderId) return
    listDireccionesUsuario(user.id, 0, 100)
      .then((direccionesRes) => {
        const dirs = (direccionesRes.data ?? [])
          .filter((d) => d.activo)
          .sort((a, b) => Number(b.es_principal) - Number(a.es_principal))
        setDirecciones(dirs)
        if (pedidoQuery.data) {
          setSelectedDirId(pedidoQuery.data.direccion_entrega_id)
        }
      })
      .catch(() => setError('No se pudo cargar la información'))
  }, [orderId, user, pedidoQuery.data])

  const handleCambiarDireccion = async (dirId: number) => {
    if (!pedidoQuery.data || dirId === pedidoQuery.data.direccion_entrega_id) return
    setUpdatingDir(true)
    try {
      const updated = await updatePedidoDireccion(pedidoQuery.data.id, dirId)
      if (pedidoQuery.data) {
        pedidoQuery.data.direccion_entrega_id = updated.direccion_entrega_id
      }
      setSelectedDirId(updated.direccion_entrega_id)
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Error al actualizar dirección'
      setError(msg)
    } finally {
      setUpdatingDir(false)
    }
  }

  const pagarEnEfectivo = async () => {
    startCash()
    try {
      await api.patch(`/pedidos/${orderId}/confirmar`, { forma_pago_codigo: "EFECTIVO" })
      resetPayment()
      window.location.href = `/api/v1/pagos/orders/${orderId}/success`
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Error al confirmar pedido"
      failPayment(msg)
      setError(msg)
    }
  }

  if (pedidoQuery.isLoading) {
    return <SkeletonPage />
  }

  if (error || pedidoQuery.isError || !pedidoQuery.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl font-bold text-orange-950 mb-2">Pedido no encontrado</h1>
        <p className="text-slate-600 mb-6">{error || "No se pudo cargar la información"}</p>
        <Link to="/" className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
          Volver al Catálogo
        </Link>
      </div>
    )
  }

  const order = pedidoQuery.data
  const selectedDir = direcciones.find(d => d.id === selectedDirId)

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100">
      <header className="bg-white/90 shadow-sm border-b border-orange-100 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/carrito" className="text-sm text-orange-600 hover:text-orange-800">&larr; Volver al carrito</Link>
          <h1 className="text-xl font-bold text-orange-950">Finalizar Pedido</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Resumen del pedido */}
        <div className="bg-white/90 p-6 rounded-xl shadow-sm border border-orange-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-orange-950">
              Resumen del Pedido #{order.id}
            </h2>
            <Link
              to="/productos"
              className="text-sm text-orange-600 hover:text-orange-800 underline"
            >
              Volver al catálogo
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Estado</span>
              <span className="font-medium text-yellow-600">Pendiente de pago</span>
            </div>
            <hr className="border-orange-100" />
            <div className="flex justify-between text-lg">
              <span className="font-bold text-orange-950">Total a pagar</span>
              <span className="font-bold text-orange-600">
                ${Number(order.total).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Dirección de entrega */}
        <div className="bg-white/90 p-6 rounded-xl shadow-sm border border-orange-100">
          <h2 className="text-lg font-semibold text-orange-950 mb-4">Dirección de entrega</h2>

          {direcciones.length === 0 ? (
            <p className="text-sm text-slate-600">
              No tenés direcciones cargadas.{' '}
              <Link to="/perfil" className="text-orange-600 underline">Agregá una desde Mi Perfil</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {direcciones.map((dir) => (
                <label
                  key={dir.id}
                  className={`block rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedDirId === dir.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-orange-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="direccion"
                      checked={selectedDirId === dir.id}
                      onChange={() => handleCambiarDireccion(dir.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-orange-950">{dir.alias}</span>
                        {dir.es_principal && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Principal
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{dir.linea1}{dir.linea2 ? `, ${dir.linea2}` : ''}</p>
                      <p className="text-sm text-slate-600">{dir.ciudad}, {dir.provincia} ({dir.codigo_postal})</p>
                    </div>
                  </div>
                </label>
              ))}
              {updatingDir && (
                <p className="text-xs text-orange-600">Actualizando dirección...</p>
              )}
            </div>
          )}
        </div>

        {/* Opciones de pago */}
        <div className="bg-white/90 p-6 rounded-xl shadow-sm border border-orange-100">
          <div className="space-y-3">
            {paymentInitiated ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700">
                  Pago iniciado. Completalo en la ventana de MercadoPago y volvé para ver el resultado.
                </div>
                <button
                  onClick={() => navigate(`/pedido/${order.id}`)}
                  className="w-full rounded-lg bg-orange-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-700"
                >
                  Ya pagué, ver mi pedido
                </button>
              </div>
            ) : (
              <>
                <PaymentButton pedidoId={order.id} monto={Number(order.total)} />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-orange-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400">O</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={pagarEnEfectivo}
                  disabled={cashLoading}
                  className="w-full rounded-lg border-2 border-green-500 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cashLoading ? "Confirmando..." : "Pagar en efectivo"}
                </button>
                <p className="text-center text-xs text-slate-400">El pedido quedará confirmado y lo abonás al retirar.</p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
