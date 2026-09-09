/* heatmap.js — Matriz de calor: temáticas ASJC más frecuentes por año.

   Se prefirió sobre un diagrama de Sankey por lo que dice `docs/DECISIONS.md`
   una y otra vez: no inventar la forma del dato. Este proyecto no tiene un
   flujo real que dibujar (una publicación no "fluye" de un año a un tema; el
   tema es un atributo, no un tránsito) — lo que sí existe es una frecuencia
   por año × categoría, y eso es exactamente lo que una matriz de calor
   representa sin forzar la lectura.

   Misma separación que `treemap.js`: `agregarMatriz()` reduce datos crudos a
   una matriz (pura), `renderHeatmap()` dibuja esa matriz en SVG (pura),
   `montarHeatmap()` es la única parte que toca el DOM.

   Escala de color: NO se introduce un tono nuevo. Se modula la opacidad de
   `--serie-1` (el bordeaux del dato), no de `--accion-viva`: en la paleta H
   `--accion-viva` es champagne (un acento claro), inadecuado como relleno de
   magnitud sobre el fondo champán. La intensidad se lee entonces como
   bordeaux sobre champán con el sistema cromático existente en los dos temas,
   sin depender de una paleta secuencial nueva que alguien tendría que validar
   aparte. */

import { esSinDato } from '../core.js';

const escapar = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = new Intl.NumberFormat('es-CL');

/* ------------------------------------------------------------ agregación */

/** `publicaciones`: registros de `publicaciones.json` (`anio`, y un campo
    multivaluado como `asjc`). Devuelve `{anios, categorias, matriz, maximo}`:
    `matriz[categoria][anio]` es el recuento; `categorias` son las `topN` más
    frecuentes en todo el período, ordenadas de más a menos. */
export function agregarMatriz(publicaciones, { campo = 'asjc', topN = 8 } = {}) {
  const anios = [...new Set(publicaciones.map(p => p.anio).filter(a => a != null))].sort();
  const totalPorCategoria = new Map();
  for (const p of publicaciones) {
    for (const cat of (p[campo] || [])) {
      if (!cat || esSinDato(cat)) continue;
      totalPorCategoria.set(cat, (totalPorCategoria.get(cat) || 0) + 1);
    }
  }
  const categorias = [...totalPorCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([cat]) => cat);
  const catSet = new Set(categorias);

  const matriz = new Map(categorias.map(c => [c, new Map(anios.map(a => [a, 0]))]));
  let maximo = 0;
  for (const p of publicaciones) {
    if (p.anio == null) continue;
    for (const cat of (p[campo] || [])) {
      if (!catSet.has(cat)) continue;
      const fila = matriz.get(cat);
      const n = (fila.get(p.anio) || 0) + 1;
      fila.set(p.anio, n);
      if (n > maximo) maximo = n;
    }
  }
  return { anios, categorias, matriz, maximo };
}

/* ------------------------------------------------------------------ render */

const MARGEN_IZQ = 210;  // ancho reservado para el nombre de categoría
const MARGEN_SUP = 28;   // alto reservado para el año

// Rama de intensidad → relleno. Igual que las celdas del treemap, el mapa NO
// usa la rampa ordinal bordeaux oscuro (se ve apelmazado y el texto no se
// lee): usa la rampa de celdas clara `--mapa-1..5`, y reserva el bordeaux del
// dato —`--mapa-dato`— para la franja de mayor intensidad (decisión del
// usuario: "bordeaux solo en el dato"). El campo es claro en ambos temas, así
// que la etiqueta se dibuja con `--mapa-tinta` (oscura fija) y la del dato
// (sobre bordeaux) con `--marca-tinta` (clara fija).
const RAMPA_CELDA = ['var(--mapa-1)', 'var(--mapa-2)', 'var(--mapa-3)', 'var(--mapa-4)', 'var(--mapa-5)'];
const CELDA_DATO = 'var(--mapa-dato)';
const UMBRAL_DATO = 0.9;   // por encima de este piso de intensidad → bordeaux
const PASO_RAMPA = 1 / RAMPA_CELDA.length;

const LEGEND_X = MARGEN_IZQ;               // misma línea de salida que las celdas
const LEGEND_SW = 22;                       // ancho de cada pastilla de la escala
const LEGEND_H = 12;
const LEGEND_GUTTER = 20;                   // separación vertical tras la última fila

function rellenoDeCelda(intensidad) {
  if (intensidad >= UMBRAL_DATO) return CELDA_DATO;
  const ranura = Math.min(RAMPA_CELDA.length - 1,
    Math.floor((intensidad / UMBRAL_DATO) * RAMPA_CELDA.length));
  return RAMPA_CELDA[Math.max(0, ranura)];
}

function renderLegend(maximo, baseY) {
  // Leyenda de escala sobre la misma rampa que las celdas: varias pastillas
  // de --mapa-* + la pastilla bordeaux del dato, y marcas 0 / mitad / máximo.
  const fila = n => n > 0 ? Math.sqrt(n / maximo) : 0;
  const puntos = [
    { t: '0',                f: 0 },
    { t: nf.format(Math.ceil(maximo / 2)), f: fila(Math.ceil(maximo / 2)) },
    { t: nf.format(maximo),  f: fila(maximo) },
  ];
  const pastillas = [...RAMPA_CELDA, CELDA_DATO].map((c, i) => {
    const x = LEGEND_X + i * LEGEND_SW;
    return `<rect x="${x}" y="${baseY + 2}" width="${LEGEND_SW}" height="${LEGEND_H}" rx="3" fill="${c}"/>`;
  }).join('');

  const marcas = puntos.map((p, i) => {
    const x = LEGEND_X + p.f * (LEGEND_SW * 5);
    const et = `<text x="${x}" y="${baseY + LEGEND_H + 14}" class="heatmap-ley-marca"
        text-anchor="${i === 0 ? 'start' : (i === puntos.length - 1 ? 'end' : 'middle')}">${p.t}</text>`;
    const guia = i === 0 || i === puntos.length - 1 ? '' : `<line x1="${x}" y1="${baseY + 2}" x2="${x}" y2="${baseY + LEGEND_H + 2}" class="heatmap-ley-guia"/>`;
    return et + guia;
  }).join('');

  return `<g class="heatmap-leyenda" role="img" aria-label="Escala de 0 a ${nf.format(maximo)} publicaciones">
    <text x="${LEGEND_X + LEGEND_SW * 5 + 8}" y="${baseY + LEGEND_H - 1}" class="heatmap-ley-titulo">publicaciones</text>
    ${pastillas}${marcas}
  </g>`;
}

export function renderHeatmap({ anios, categorias, matriz, maximo }, { ancho, altoFila = 34 } = {}) {
  const alto = MARGEN_SUP + categorias.length * altoFila + LEGEND_GUTTER + LEGEND_H + 18;
  const anchoCol = Math.max(28, (ancho - MARGEN_IZQ) / Math.max(1, anios.length));

  const cabeceraAnios = anios.map((a, i) => {
    const x = MARGEN_IZQ + i * anchoCol + anchoCol / 2;
    return `<text x="${x}" y="${MARGEN_SUP - 8}" class="heatmap-anio" text-anchor="middle">${a}</text>`;
  }).join('');

  const filas = categorias.map((cat, fi) => {
    const y = MARGEN_SUP + fi * altoFila;
    const etiqueta = `<text x="${MARGEN_IZQ - 12}" y="${y + altoFila / 2 + 4}" class="heatmap-etq"
        text-anchor="end">${escapar(cat.length > 28 ? cat.slice(0, 27) + '…' : cat)}</text>`;

    const celdas = anios.map((anio, ai) => {
      const n = matriz.get(cat).get(anio) || 0;
      const x = MARGEN_IZQ + ai * anchoCol;
      // Raíz cuadrada, no lineal: en bibliometría la frecuencia por celda
      // suele tener una cola larga, y una escala lineal deja casi todo el
      // mapa con opacidad casi cero salvo un par de celdas dominantes.
      const intensidad = maximo > 0 ? Math.sqrt(n / maximo) : 0;
      // Un solo punto de tabulación para todo el mapa (la primera celda),
      // no una por celda: antes eran hasta 24 paradas de Tab para llegar al
      // resto de la página, justo lo que el propio sitio ya evitó en las
      // barras (paginas.js, tecladoGraficos()) — que también recorre estas
      // celdas con flechas, generalizando el mismo mecanismo.
      const tab = fi === 0 && ai === 0 ? 0 : -1;
      const esDato = intensidad >= UMBRAL_DATO && n > 0;
      return `<g class="heatmap-celda" tabindex="${tab}" role="gridcell"
          aria-label="${escapar(cat)}, ${anio}: ${nf.format(n)} publicaciones"
          data-tip="${escapar(cat)}" data-tip-v="${nf.format(n)} pub." data-tip-n="${anio}">
        <rect x="${x + 2}" y="${y + 3}" width="${anchoCol - 4}" height="${altoFila - 6}" rx="6"
          fill="${rellenoDeCelda(intensidad)}"/>
        ${n > 0 && anchoCol >= 30 ? `<text x="${x + anchoCol / 2}" y="${y + altoFila / 2 + 4}"
          class="heatmap-cifra${esDato ? ' es-clara' : ''}" text-anchor="middle">${n}</text>` : ''}
      </g>`;
    }).join('');

    return `<g class="heatmap-fila">${etiqueta}${celdas}</g>`;
  }).join('');

  return `<svg class="chart heatmap-svg" viewBox="0 0 ${ancho} ${alto}" role="img"
      aria-label="Frecuencia de temática ASJC por año">
    ${cabeceraAnios}${filas}${renderLegend(maximo, MARGEN_SUP + categorias.length * altoFila + LEGEND_GUTTER)}
  </svg>`;
}

/* ------------------------------------------------------------------ montaje */

export function montarHeatmap(contenedor, publicaciones, opciones = {}) {
  // Un recorte del explorador vuelve a llamar a esta función sobre el MISMO
  // contenedor con una lista de publicaciones distinta. Sin desconectar el
  // observador de la corrida anterior, cada recorte deja un ResizeObserver
  // vivo de más — un ratón que abre y cierra filtros un rato acumula
  // decenas de observadores sobre el mismo nodo.
  contenedor._heatmapObserver?.disconnect();

  const agregado = agregarMatriz(publicaciones, opciones);

  function dibujar() {
    const ancho = Math.max(360, Math.round(contenedor.getBoundingClientRect().width));
    contenedor.innerHTML = agregado.categorias.length
      ? renderHeatmap(agregado, { ancho })
      : '<p class="heatmap-vacio">Sin datos de área temática suficientes para el mapa.</p>';
  }

  dibujar();
  let pendiente = null;
  const observador = new ResizeObserver(() => {
    clearTimeout(pendiente);
    pendiente = setTimeout(dibujar, 120);
  });
  observador.observe(contenedor);
  contenedor._heatmapObserver = observador;
}
