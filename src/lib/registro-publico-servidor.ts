import { auditar } from "@/lib/audit";
import { variableDeEntorno } from "@/lib/entorno";
import { colaDeTelefono } from "@/lib/dominio";
import { getPrisma } from "@/lib/prisma";
import { esquemaRegistroPublico } from "@/lib/registro-publico";
import { buscarDuplicados, crearRegistroEnTransaccion } from "@/lib/registro";
import type { DatosRegistroValidados } from "@/lib/validacion-registro";

export type EstadoRegistroPublico = {
  errores: Record<string, string>;
  mensaje?: string;
};

export type ResultadoRegistroPublico =
  | { tipo: "aceptado" }
  | {
      tipo: "rechazado";
      estado: EstadoRegistroPublico;
      status: 400 | 429 | 503;
    };

const MAXIMOS_INTENTOS = 5;
const VENTANA_DE_INTENTOS_MS = 15 * 60 * 1000;

function texto(formulario: FormData, campo: string) {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor : "";
}

async function huellaDelCliente(cabeceras: Headers) {
  const ip =
    cabeceras.get("cf-connecting-ip") ??
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    cabeceras.get("x-real-ip");
  if (!ip) return null;

  const secreto =
    (await variableDeEntorno("REGISTRO_PUBLICO_RATE_LIMIT_SECRET")) ??
    (await variableDeEntorno("HIGHLEVEL_WEBHOOK_SECRET")) ??
    (await variableDeEntorno("DATABASE_URL")) ??
    "registro-publico-vive";
  const bytes = new TextEncoder().encode(`${secreto}:${ip}`);
  const resumen = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(resumen))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function procesarRegistroPublico(
  formulario: FormData,
  cabeceras: Headers,
): Promise<ResultadoRegistroPublico> {
  const entrada = {
    firstName: texto(formulario, "firstName"),
    lastName: texto(formulario, "lastName"),
    gender: texto(formulario, "gender") || null,
    birthDate: texto(formulario, "birthDate"),
    callPhone: texto(formulario, "callPhone"),
    whatsappPhone: texto(formulario, "whatsappPhone"),
    email: texto(formulario, "email"),
    callSchedules: formulario
      .getAll("callSchedules")
      .filter((valor): valor is string => typeof valor === "string"),
    callScheduleNote: texto(formulario, "callScheduleNote"),
    address: texto(formulario, "address"),
    prayerRequest: texto(formulario, "prayerRequest"),
    entryPoint: texto(formulario, "entryPoint") || null,
    entryPointOther: texto(formulario, "entryPointOther"),
    churchAttendance: texto(formulario, "churchAttendance") || null,
    churchName: texto(formulario, "churchName"),
    invitationKind: texto(formulario, "invitationKind") || null,
    invitedByPersonId: null,
    invitedByName: texto(formulario, "invitedByName"),
    aceptaPrivacidad: formulario.get("aceptaPrivacidad") === "si",
    sitioWeb: texto(formulario, "sitioWeb"),
  };

  // Los robots suelen completar este campo invisible. Se les responde igual
  // que a un envío real para no enseñarles cómo eludir la protección.
  if (entrada.sitioWeb) return { tipo: "aceptado" };

  const analisis = esquemaRegistroPublico.safeParse(entrada);
  if (!analisis.success) {
    const errores: Record<string, string> = {};
    for (const problema of analisis.error.issues) {
      const campo = String(problema.path[0] ?? "general");
      errores[campo] ??= problema.message;
    }
    return {
      tipo: "rechazado",
      estado: { errores },
      status: 400,
    };
  }

  // `esquemaRegistroPublico` extiende al esquema base y ya ejecutó sus
  // transformaciones (por ejemplo, convierte los opcionales vacíos a null).
  // Volver a analizar esa salida exigiría strings donde ya hay nulls.
  const datos: DatosRegistroValidados = analisis.data;
  const huella = await huellaDelCliente(cabeceras);
  const identidad =
    colaDeTelefono(datos.callPhone) ??
    colaDeTelefono(datos.whatsappPhone) ??
    datos.email ??
    `${datos.firstName}:${datos.lastName ?? ""}`.toLocaleLowerCase("es");
  const prisma = await getPrisma();

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      if (huella) {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`registro-publico-limite:${huella}`}))
        `;
      }
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`registro-publico:${identidad}`}))
      `;

      if (huella) {
        const desde = new Date(Date.now() - VENTANA_DE_INTENTOS_MS);
        const intentos = await tx.auditLog.count({
          where: {
            action: "registro_publico.recibido",
            createdAt: { gte: desde },
            metadata: { path: ["cliente"], equals: huella },
          },
        });
        if (intentos >= MAXIMOS_INTENTOS) return "limite" as const;
      }

      const duplicados = await buscarDuplicados(tx, datos);
      await auditar(tx, {
        actorId: null,
        action: "registro_publico.recibido",
        entityType: "person",
        metadata: {
          origen: "formulario_publico",
          ...(huella ? { cliente: huella } : {}),
          resultado: duplicados.length ? "posible_duplicado" : "nuevo",
        },
      });

      // Nunca se confirma a un visitante si el teléfono o el correo ya existe.
      // Un posible duplicado queda auditado para revisión interna y no se pisa.
      if (duplicados.length) return "aceptado" as const;

      await crearRegistroEnTransaccion(tx, datos, {
        actorId: null,
        metadata: {
          origen: "formulario_publico",
          consentimientoContacto: true,
        },
      });
      return "creado" as const;
    });

    if (resultado === "limite") {
      return {
        tipo: "rechazado",
        estado: {
          errores: {},
          mensaje:
            "Recibimos varios intentos desde esta conexión. Espera 15 minutos y vuelve a intentarlo.",
        },
        status: 429,
      };
    }
  } catch (error) {
    console.error("No se pudo guardar el registro público", error);
    return {
      tipo: "rechazado",
      estado: {
        errores: {},
        mensaje:
          "No pudimos guardar tu información en este momento. Inténtalo nuevamente.",
      },
      status: 503,
    };
  }

  return { tipo: "aceptado" };
}
