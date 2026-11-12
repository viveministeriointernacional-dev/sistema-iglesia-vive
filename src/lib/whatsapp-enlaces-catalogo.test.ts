import assert from "node:assert/strict";
import test from "node:test";
import {
  ENLACES,
  enlaceDeWhatsApp,
  WHATSAPP_IGLESIA,
} from "./whatsapp-enlaces-catalogo";

test("el número es el del WhatsApp de la iglesia, no el de la cuenta", () => {
  assert.equal(WHATSAPP_IGLESIA, "573228042438");
  // ⚠️ El de la ubicación en HighLevel es otro y mandaría a la gente a un
  // número que nadie atiende. Esta prueba existe para que no vuelva a colarse.
  assert.notEqual(WHATSAPP_IGLESIA, "573132096584");
});

// ⚠️ LA PRUEBA QUE IMPORTA. Un espacio sin codificar rompe la dirección y hay
// teléfonos que entregan media frase.
test("los espacios y las tildes van codificados", () => {
  const url = enlaceDeWhatsApp("Hola, quiero más información");
  assert.equal(url, "https://wa.me/573228042438?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n");
  assert.ok(!url.includes(" "), "ni un espacio suelto");
  assert.ok(!/[áéíóúñ¿¡]/.test(url), "ni una tilde sin codificar");
});

test("los signos de apertura del español también", () => {
  const url = enlaceDeWhatsApp("¿Cuándo es la reunión?");
  assert.ok(!url.includes("¿") && !url.includes("á"));
  assert.ok(url.includes("%C2%BF"), url);
});

test("sin mensaje, el enlace abre el chat en blanco y sin «?text=»", () => {
  assert.equal(enlaceDeWhatsApp(""), "https://wa.me/573228042438");
  assert.equal(enlaceDeWhatsApp("   "), "https://wa.me/573228042438");
});

test("se puede apuntar a otro número sin tocar el catálogo", () => {
  assert.ok(enlaceDeWhatsApp("Hola", "573001112233").startsWith("https://wa.me/573001112233?"));
});

// Cada enlace tiene que servir de verdad: sin id repetido y sin dónde vacío,
// que es lo que haría que dos filas de la pantalla se vieran iguales.
test("los enlaces del catálogo están bien formados", () => {
  const ids = ENLACES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "sin ids repetidos");
  for (const e of ENLACES) {
    assert.ok(e.donde.trim().length > 0, `«${e.id}» sin dónde se usa`);
    assert.ok(enlaceDeWhatsApp(e.mensaje).startsWith("https://wa.me/573228042438"));
  }
  // Y el de «sin mensaje» es el único que no lleva texto.
  const sinTexto = ENLACES.filter((e) => e.mensaje.trim() === "");
  assert.equal(sinTexto.length, 1);
  assert.equal(sinTexto[0].id, "libre");
});
