import { auditar } from "@/lib/audit";
import { LARGO_MINIMO_LLAVE } from "@/lib/llave-maestra-catalogo";
import type { ClientePrisma } from "@/lib/prisma";

export { LARGO_MINIMO_LLAVE };

/// La llave maestra: un secreto propio del administrador que abre cualquier
/// perfil escribiendo el correo de esa persona y esta llave en lugar de su
/// contraseña.
///
/// **Es distinta de la contraseña del administrador a propósito.** Si fuera la
/// misma, no se podría rotar sin cambiarle el ingreso a quien administra, y la
/// contraseña del día a día pasaría a ser la llave de todo el sistema.
///
/// **El valor nunca se guarda.** Se guarda su huella PBKDF2-SHA256 con sal
/// propia, que es lo mismo que hace un almacén de contraseñas serio: de la
/// huella no se puede volver al valor, y probar a fuerza bruta cuesta caro por
/// las iteraciones.

/// Cuántas vueltas da el derivado. Sube el costo de probar llaves a ciegas sin
/// que se note al ingresar (es una sola verificación por intento).
const ITERACIONES = 210_000;

function aHex(datos: ArrayBuffer): string {
  return Array.from(new Uint8Array(datos))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function derivar(valor: string, salHex: string, iteraciones: number) {
  const sal = Uint8Array.from(
    salHex.match(/.{2}/g)?.map((par) => Number.parseInt(par, 16)) ?? [],
  );
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(valor),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: iteraciones, hash: "SHA-256" },
    material,
    256,
  );
  return aHex(bits);
}

/// Comparación que tarda lo mismo acierte o no. Comparar con `===` filtra por
/// el tiempo cuántos caracteres iniciales coinciden.
function igualesEnTiempoFijo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

export type EstadoLlaveMaestra = {
  configurada: boolean;
  cambiadaEn: Date | null;
  cambiadaPor: string | null;
  ultimoUso: Date | null;
};

export async function estadoDeLlaveMaestra(
  prisma: ClientePrisma,
): Promise<EstadoLlaveMaestra> {
  const llave = await prisma.masterKey.findFirst({
    where: { revokedAt: null },
    select: {
      createdAt: true,
      lastUsedAt: true,
      createdBy: { select: { fullName: true } },
    },
  });
  return {
    configurada: Boolean(llave),
    cambiadaEn: llave?.createdAt ?? null,
    cambiadaPor: llave?.createdBy.fullName ?? null,
    ultimoUso: llave?.lastUsedAt ?? null,
  };
}

export type ResultadoLlave = { ok: true } | { ok: false; mensaje: string };

/// Pone la llave maestra, o la cambia. Rotar revoca la anterior en la misma
/// transacción: nunca hay dos llaves vivas.
export async function guardarLlaveMaestra(
  prisma: ClientePrisma,
  datos: { valor: string; actorId: string },
): Promise<ResultadoLlave> {
  const valor = datos.valor.trim();
  if (valor.length < LARGO_MINIMO_LLAVE) {
    return {
      ok: false,
      mensaje: `La llave maestra debe tener al menos ${LARGO_MINIMO_LLAVE} caracteres.`,
    };
  }

  const sal = aHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const huella = await derivar(valor, sal, ITERACIONES);

  await prisma.$transaction(async (tx) => {
    await tx.masterKey.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.masterKey.create({
      data: {
        secretHash: huella,
        salt: sal,
        iterations: ITERACIONES,
        createdById: datos.actorId,
      },
    });
    await auditar(tx, {
      actorId: datos.actorId,
      action: "acceso.llave_maestra_cambiada",
      entityType: "app_user",
      entityId: datos.actorId,
    });
  });

  return { ok: true };
}

/// Deja el sistema sin llave maestra. Mientras no haya, nadie puede entrar a un
/// perfil ajeno por este camino.
export async function revocarLlaveMaestra(
  prisma: ClientePrisma,
  actorId: string,
): Promise<ResultadoLlave> {
  const revocadas = await prisma.masterKey.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revocadas.count === 0) {
    return { ok: false, mensaje: "No hay ninguna llave maestra configurada." };
  }
  await auditar(prisma, {
    actorId,
    action: "acceso.llave_maestra_revocada",
    entityType: "app_user",
    entityId: actorId,
  });
  return { ok: true };
}

/// ¿Lo que escribieron es la llave maestra?
///
/// Devuelve `false` sin más cuando no hay llave configurada: no existir es lo
/// mismo que no coincidir, y así el ingreso no revela si el sistema tiene o no
/// llave maestra.
export async function verificarLlaveMaestra(
  prisma: ClientePrisma,
  valor: string,
): Promise<boolean> {
  if (!valor) return false;
  const llave = await prisma.masterKey.findFirst({
    where: { revokedAt: null },
    select: { id: true, secretHash: true, salt: true, iterations: true },
  });
  if (!llave) return false;

  const huella = await derivar(valor, llave.salt, llave.iterations);
  if (!igualesEnTiempoFijo(huella, llave.secretHash)) return false;

  await prisma.masterKey
    .update({ where: { id: llave.id }, data: { lastUsedAt: new Date() } })
    .catch(() => null);
  return true;
}
