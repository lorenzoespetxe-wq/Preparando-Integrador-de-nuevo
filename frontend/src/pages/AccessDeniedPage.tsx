export function AccessDeniedPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 p-4">
      <div className="rounded-2xl border border-red-100 bg-white/90 p-8 text-center shadow-lg backdrop-blur max-w-md">
        <div className="mb-4 text-5xl">🚫</div>
        <h1 className="text-2xl font-bold text-red-900">Acceso Denegado</h1>
        <p className="mt-3 text-red-700">No tienes permisos para acceder a esta sección.</p>
        <p className="mt-2 text-sm text-red-600">Si crees que es un error, contacta con el administrador.</p>
        <a
          href="/home"
          className="mt-6 inline-block rounded bg-orange-500 px-6 py-2 font-medium text-white hover:bg-orange-600"
        >
          Volver al Inicio
        </a>
      </div>
    </div>
  );
}
