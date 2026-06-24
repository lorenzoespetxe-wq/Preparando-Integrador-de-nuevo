import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCategoriaDetail } from "../services/api";
import { SkeletonPage } from "../components/Skeleton";

export function CategoryDetailPage(): JSX.Element {
  const params = useParams();
  const categoriaId = Number(params.categoriaId);

  const detailQuery = useQuery({
    queryKey: ["categorias", "detail", categoriaId],
    queryFn: () => getCategoriaDetail(categoriaId),
    enabled: Number.isFinite(categoriaId),
  });

  const categoria = detailQuery.data;

  return (
    <section className="rounded-3xl border border-orange-100 bg-white/90 p-5 shadow-sm backdrop-blur">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-700">Detalle de categoría</p>
          <h1 className="text-3xl font-semibold text-orange-950">{categoria?.nombre ?? "Categoría"}</h1>
        </div>
        <Link to="/categorias" className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900">
          Volver a categorías
        </Link>
      </div>

      {detailQuery.isLoading ? <SkeletonPage /> : null}
      {detailQuery.isError ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">No se pudo cargar la categoría.</p> : null}

      {categoria ? (
        <div className="grid gap-5 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
              <p className="text-sm text-slate-700">{categoria.descripcion || "Sin descripción"}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-white px-3 py-1 font-medium text-orange-900">{categoria.activo ? "Activa" : "Inactiva"}</span>
                <span className="rounded-full bg-white px-3 py-1 font-medium text-orange-900">Padre: {categoria.parent?.nombre ?? "Ninguno"}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-white p-4">
              <h2 className="text-lg font-semibold text-orange-950">Subcategorías</h2>
              {categoria.subcategorias.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {categoria.subcategorias.map((sub) => (
                    <li key={sub.id} className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm">
                      <span className="font-medium text-orange-950">{sub.nombre}</span>
                      <span className="ml-2 text-slate-600">{sub.activo ? "Activa" : "Inactiva"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-600">No tiene subcategorías.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="text-lg font-semibold text-orange-950">Productos asociados</h2>
            {categoria.productos_asociados.length > 0 ? (
              <div className="mt-3 max-h-[22rem] overflow-y-auto rounded border border-orange-100">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-orange-100 text-left text-orange-900">
                    <tr>
                      <th className="border px-3 py-2">Producto</th>
                      <th className="border px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoria.productos_asociados.map((producto) => (
                      <tr key={producto.producto_id}>
                        <td className="border px-3 py-2">{producto.producto_nombre}</td>
                        <td className="border px-3 py-2">{producto.activo ? "Activo" : "Inactivo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No tiene productos asociados.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
