import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState<string>("admin@test.com");
  const [password, setPassword] = useState<string>("admin123");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const redirectTo = searchParams.get("redirect") || "/home";

  // Redirige si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      console.log("🔐 Iniciando login con:", email);
      await login(email, password);
      console.log("✅ Login exitoso");
      // La redirección sucede automáticamente via useEffect cuando isAuthenticated cambia
    } catch (submitError) {
      console.error("❌ Error en login:", submitError);
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("No se pudo iniciar sesión");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-orange-100 bg-white/90 p-6 shadow-lg backdrop-blur">
        <div className="mb-5">
          <p className="font-display text-lg font-bold tracking-tight text-orange-500">Food Store</p>
          <h1 className="mt-1 text-3xl font-bold text-orange-950">Ingresar</h1>
          <p className="mt-2 text-sm text-orange-800">Usá tu email y contraseña para entrar al panel.</p>
        </div>
        <label className="mb-3 block text-sm font-medium text-orange-900">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
            className="mt-1 w-full rounded border border-orange-200 px-3 py-2 focus:border-orange-400 focus:outline-none disabled:opacity-50"
            placeholder="admin@test.com"
          />
        </label>
        <label className="mb-3 block text-sm font-medium text-orange-900">
          Clave
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isLoading}
            className="mt-1 w-full rounded border border-orange-200 px-3 py-2 focus:border-orange-400 focus:outline-none disabled:opacity-50"
            placeholder="1234"
          />
        </label>
        {error ? <p className="mb-3 text-sm text-red-600">❌ {error}</p> : null}

        <div className="mb-3 rounded border border-orange-100 bg-orange-50 p-3 text-sm text-orange-800">
          <p className="mb-2 font-semibold">Credenciales de prueba</p>
          <ul className="mb-2 list-inside list-disc">
            <li>Admin — email: <strong>admin@test.com</strong> | clave: <strong>admin123</strong></li>
            <li>Stock — email: <strong>stock@test.com</strong> | clave: <strong>stock123</strong></li>
            <li>Pedidos — email: <strong>pedidos@test.com</strong> | clave: <strong>pedidos123</strong></li>
            <li>Cliente — email: <strong>cliente@test.com</strong> | clave: <strong>cliente123</strong></li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setEmail("admin@test.com"); setPassword("admin123"); }}
              disabled={isLoading}
              className="rounded bg-orange-200 px-2 py-1 text-xs disabled:opacity-50"
            >Usar Admin</button>
            <button
              type="button"
              onClick={() => { setEmail("stock@test.com"); setPassword("stock123"); }}
              disabled={isLoading}
              className="rounded bg-orange-200 px-2 py-1 text-xs disabled:opacity-50"
            >Usar Stock</button>
            <button
              type="button"
              onClick={() => { setEmail("pedidos@test.com"); setPassword("pedidos123"); }}
              disabled={isLoading}
              className="rounded bg-orange-200 px-2 py-1 text-xs disabled:opacity-50"
            >Usar Pedidos</button>
            <button
              type="button"
              onClick={() => { setEmail("cliente@test.com"); setPassword("cliente123"); }}
              disabled={isLoading}
              className="rounded bg-orange-200 px-2 py-1 text-xs disabled:opacity-50"
            >Usar Cliente</button>
          </div>
        </div>
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full rounded bg-orange-500 px-3 py-2 font-medium text-white shadow-sm disabled:opacity-50"
        >
          {isLoading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
