import { Link } from "react-router-dom";

export function ClienteDashboard(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-orange-900">Bienvenido a Food Store</h1>
        <p className="mt-2 text-orange-700">Descubre nuestros productos y realiza tu pedido</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/productos"
          className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-md transition hover:shadow-lg hover:border-orange-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-orange-900">🛍️ Explorar Productos</h2>
          <p className="text-orange-800">Navega nuestro catálogo completo de productos frescos y deliciosos.</p>
        </Link>

        <Link
          to="/carrito"
          className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-md transition hover:shadow-lg hover:border-green-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-green-900">🛒 Mi Carrito</h2>
          <p className="text-green-800">Revisa los productos que has seleccionado y completa tu compra.</p>
        </Link>

        <Link
          to="/mis-pedidos"
          className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-md transition hover:shadow-lg hover:border-blue-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-blue-900">📦 Mis Pedidos</h2>
          <p className="text-blue-800">Visualiza el estado de tus pedidos y su historial de cambios.</p>
        </Link>

        <Link
          to="/perfil"
          className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-6 shadow-md transition hover:shadow-lg hover:border-purple-200"
        >
          <h2 className="mb-2 text-2xl font-bold text-purple-900">👤 Mi Perfil</h2>
          <p className="text-purple-800">Administra tu información personal y direcciones de acceso.</p>
        </Link>
      </div>

      <div className="mt-8 rounded-lg border border-orange-100 bg-orange-50 p-6">
        <h3 className="mb-3 text-lg font-semibold text-orange-900">💡 Tips</h3>
        <ul className="space-y-2 text-sm text-orange-800">
          <li>✓ Explora nuestro catálogo de productos desde la sección Productos</li>
          <li>✓ Agrega productos a tu carrito para comprar luego</li>
          <li>✓ Sigue el estado de tus pedidos en tiempo real</li>
          <li>✓ Actualiza tu perfil y direcciones desde Mi Perfil</li>
        </ul>
      </div>
    </div>
  );
}
