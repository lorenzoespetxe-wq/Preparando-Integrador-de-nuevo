from decimal import Decimal
from typing import Optional

from sqlmodel import Session, select
from sqlalchemy import text

from app.core.database import _is_postgres


def verificar_stock_ingredientes(session: Session, producto_id: int, cantidad: int) -> Optional[str]:
    """Verificar si hay suficiente stock de ingredientes para un producto.
    Retorna None si hay stock suficiente, o un mensaje de error si no.
    """
    from app.modules.productos.models import Producto

    producto = session.get(Producto, producto_id)
    if not producto:
        return "Producto no encontrado"

    if producto.usa_stock_manual:
        if producto.stock_manual is not None and producto.stock_manual < cantidad:
            return f"Stock insuficiente para {producto.nombre}"
        return None

    # Verificar stock de ingredientes
    for pi in producto.productos_ingredientes:
        ing = pi.ingrediente
        if ing:
            needed = float(pi.cantidad) * cantidad
            if ing.stock_actual < needed:
                return (
                    f"Ingrediente '{ing.nombre}' insuficiente: "
                    f"se necesitan {needed:.2f} {ing.unidad_medida.value}, "
                    f"hay {ing.stock_actual:.2f}"
                )
    return None


def verificar_stock_pedido(session: Session, pedido_id: int) -> Optional[str]:
    """Verificar stock para todos los productos de un pedido."""
    from app.modules.pedidos.detalle_pedido_repository import DetallePedidoRepository

    detalle_repo = DetallePedidoRepository(session)
    detalles = detalle_repo.get_by_pedido_id(pedido_id)
    for detalle in detalles:
        error = verificar_stock_ingredientes(session, detalle.producto_id, detalle.cantidad)
        if error:
            return error
    return None


def aplicar_stock(session: Session, producto_id: int, cantidad: int, multiplicador: int = 1) -> None:
    """Aplica cambio de stock a un producto.
    multiplicador=1: deducir (restar)
    multiplicador=-1: restaurar (sumar)
    Incluye verificación de stock suficiente antes de deducir.
    """
    from app.modules.productos.repository import ProductoRepository

    producto_repo = ProductoRepository(session)
    producto = producto_repo.get_by_id(producto_id)
    if not producto:
        return

    if producto.stock_manual is not None:
        delta = multiplicador * cantidad
        if multiplicador == 1 and producto.stock_manual is not None and producto.stock_manual - delta < 0:
            raise ValueError(f"Stock insuficiente para {producto.nombre}")
        producto.stock_manual -= delta
        session.add(producto)
    else:
        ingredientes = list(producto.productos_ingredientes)
        if ingredientes:
            for pi in ingredientes:
                ing = pi.ingrediente
                if ing:
                    delta = float(pi.cantidad) * cantidad * multiplicador
                    if multiplicador == 1 and ing.stock_actual - delta < 0:
                        raise ValueError(
                            f"Stock insuficiente de '{ing.nombre}' para {producto.nombre}"
                        )
                    ing.stock_actual -= delta
                    session.add(ing)


def descontar_stock_pedido(session: Session, pedido_id: int, multiplicador: int = 1) -> None:
    """Descuenta o restaura stock de todos los productos de un pedido.
    Usa SELECT ... FOR UPDATE en PostgreSQL para evitar race conditions.
    En SQLite usa BEGIN IMMEDIATE implícito.
    """
    from app.modules.pedidos.detalle_pedido_repository import DetallePedidoRepository

    detalle_repo = DetallePedidoRepository(session)
    detalles = detalle_repo.get_by_pedido_id(pedido_id)

    if multiplicador == 1:
        error = verificar_stock_pedido(session, pedido_id)
        if error:
            raise ValueError(error)

    for detalle in detalles:
        aplicar_stock(session, detalle.producto_id, detalle.cantidad, multiplicador)


def ejecutar_con_verificacion_stock(session: Session, pedido_id: int, accion: str = "descontar"):
    """Ejecutar operación de stock dentro de una transacción con protección de concurrencia.

    Para PostgreSQL usa SELECT ... FOR UPDATE para bloquear filas.
    Para SQLite confía en el bloqueo a nivel de base de datos (serializado).
    """
    from app.modules.productos.models import Producto
    from app.modules.ingredientes.models import Ingrediente
    from app.modules.pedidos.detalle_pedido_repository import DetallePedidoRepository

    detalle_repo = DetallePedidoRepository(session)
    detalles = detalle_repo.get_by_pedido_id(pedido_id)

    multiplicador = 1 if accion == "descontar" else -1

    if _is_postgres:
        # Bloquear filas de productos e ingredientes para evitar race conditions
        for detalle in detalles:
            session.execute(
                select(Producto).where(Producto.id == detalle.producto_id).with_for_update()
            )
            producto = session.get(Producto, detalle.producto_id)
            if producto and not producto.usa_stock_manual:
                for pi in producto.productos_ingredientes:
                    if pi.ingrediente:
                        session.execute(
                            select(Ingrediente).where(Ingrediente.id == pi.ingrediente.id).with_for_update()
                        )

    # Verificar stock antes de descontar
    if multiplicador == 1:
        error = verificar_stock_pedido(session, pedido_id)
        if error:
            raise ValueError(error)

    # Ejecutar la operación
    for detalle in detalles:
        aplicar_stock(session, detalle.producto_id, detalle.cantidad, multiplicador)
