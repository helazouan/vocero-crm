/** Conserva el mensaje de la API y distingue una caída de red. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init).catch(() => {
    throw new Error("No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.");
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? "No se pudo guardar o cargar la información. Vuelve a intentarlo.");
  if (data === null) throw new Error("Respuesta inválida del servidor. Vuelve a intentarlo.");
  return data as T;
}
