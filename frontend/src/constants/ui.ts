export const estadoColors: Record<string, { bg: string; text: string; solid: string }> = {
  PENDIENTE: { bg: "bg-yellow-100", text: "text-yellow-800", solid: "bg-yellow-500" },
  CONFIRMADO: { bg: "bg-blue-100", text: "text-blue-800", solid: "bg-blue-500" },
  EN_PREP: { bg: "bg-purple-100", text: "text-purple-800", solid: "bg-purple-500" },
  A_ENTREGAR: { bg: "bg-orange-100", text: "text-orange-800", solid: "bg-orange-500" },
  ESPERANDO_CLIENTE: { bg: "bg-amber-100", text: "text-amber-800", solid: "bg-amber-500" },
  ENTREGADO: { bg: "bg-green-100", text: "text-green-800", solid: "bg-green-600" },
  CANCELADO: { bg: "bg-red-100", text: "text-red-800", solid: "bg-red-500" },
};

export const estadoLabels: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Pagado",
  EN_PREP: "Preparando",
  A_ENTREGAR: "A Entregar",
  ESPERANDO_CLIENTE: "Esperando Cliente",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export const actionLabels: Record<string, string> = {
  ESPERANDO_CLIENTE: "Entregar",
};

export const ALL_ESTADOS = ["PENDIENTE", "CONFIRMADO", "EN_PREP", "A_ENTREGAR", "ESPERANDO_CLIENTE", "ENTREGADO", "CANCELADO"] as const;
