/* treemap.js — Squarified Treemap para producción por unidad académica.

   Algoritmo de Bruls, Huizing y van Wijk (1999): minimiza la relación de
   aspecto de cada rectángulo en vez de rellenar filas o columnas a ciegas,
   así ninguna celda queda como una tira ilegible aunque su valor sea chico.

   Misma separación que el resto de `assets/js/`: `squarify()` es una función
   pura de datos a geometría (corre igual en Node y en el navegador, aunque
   hoy sólo se monta en el navegador porque necesita medir el contenedor),
   `renderTreemap()` es una función pura de geometría a cadena SVG, y
   `montarTreemap()` es la única parte que toca el DOM.

   Fuente: `data/processed/hierarchy.json` (`src/build/07_hierarchy.py`).
   Reutiliza el tooltip global (`c.montarTooltip()`, `[data-tip]`) y la
   rotación de color `SERIES` que ya usan los demás gráficos: ver
   `src/design/validar_paleta.py` para cómo se miden esos tokens. */

import { esSinDato } from '../core.js';
import { mediana } from '../explorador.js';

/* --------------------------------------------------------------- layout */

/** Coloca `fila` (ya decidida) a lo largo del lado corto del rectángulo
    `restante`, y devuelve el rectángulo que queda libre para lo siguiente. */
function layoutFila(fila, restante) {
  const { x, y, w, h } = restante;
  const horizontal = w >= h;
  const largo = horizontal ? h : w;
  const suma = fila.reduce((s, n) => s + n.area, 0);
  const grosor = largo > 0 ? suma / largo : 0;

  let corrido = 0;
  for (const n of fila) {
    const lado = grosor > 0 ? n.area / grosor : 0;
    n.rect = horizontal
      ? { x, y: y + corrido, w: grosor, h: lado }
      : { x: x + corrido, y, w: lado, h: grosor };
    corrido += lado;
  }

  return horizontal
    ? { x: x + grosor, y, w: Math.max(0, w - grosor), h }
    : { x, y: y + grosor, w, h: Math.max(0, h - grosor) };
}

/** Peor relación de aspecto (ancho:alto) que produciría `fila` si se colocara
    ahora mismo contra un lado corto de longitud `largoCorto`. Cuanto más
    lejos de 1, más "tira" sale el rectángulo. */
function peorAspecto(fila, largoCorto) {
  const areas = fila.map(n => n.area);
  const suma = areas.reduce((a, b) => a + b, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  if (min <= 0 || suma <= 0) return Infinity;
  const l2 = largoCorto * largoCorto, s2 = suma * suma;
  return Math.max((l2 * max) / s2, s2 / (l2 * min));
}

/** Distribuye `nodos` (cada uno con `.valor >= 0`) dentro del rectángulo
    `{x,y,ancho,alto}`. Devuelve los mismos objetos con `.rect` añadido.
    Los de valor 0 se descartan: un rectángulo de área cero no es una celda,
    es un caso que el algoritmo no puede resolver sin dividir por cero. */
export function squarify(nodosOrig, { x = 0, y = 0, ancho, alto }) {
  const area = Math.max(0, ancho) * Math.max(0, alto);
  const conValor = nodosOrig.filter(n => n.valor > 0);
  if (!conValor.length || area <= 0) return [];

  const sumaValores = conValor.reduce((s, n) => s + n.valor, 0);
  const nodos = conValor
    .map(n => ({ ...n, area: (n.valor / sumaValores) * area }))
    .sort((a, b) => b.area - a.area);

  const resultado = [];
  let restante = { x, y, w: ancho, h: alto };
  let fila = [];
  let resto = nodos;

  while (resto.length) {
    const candidato = resto[0];
    const largoCorto = Math.min(restante.w, restante.h);
    const filaConCandidato = [...fila, candidato];
    if (!fila.length || peorAspecto(filaConCandidato, largoCorto) <= peorAspecto(fila, largoCorto)) {
      fila = filaConCandidato;
      resto = resto.slice(1);
    } else {
      restante = layoutFila(fila, restante);
      resultado.push(...fila);
      fila = [];
    }
  }
  if (fila.length) {
    layoutFila(fila, restante);
    resultado.push(...fila);
  }
  return resultado;
}

/* --------------------------------------------------------------- render */

const escapar = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = new Intl.NumberFormat('es-CL');

/** Ancho mínimo de celda para que quepa una etiqueta corta sin desbordar
    (misma estimación aproximada que `core.js`: no hay forma de medir texto
    dentro de una cadena SVG que aún no está en el documento). */
const CABE_ETIQUETA = 46;

/* Un treemap con 10 facultades necesitaría 10 tonos distinguibles, y
   `app.css` sólo tiene DOS series validadas como par (`--serie-1`/`-2`); las
   otras cuatro, medidas aquí contra sí mismas (no sólo contra el fondo, que
   es lo único que medía `validar_paleta.py` hasta ahora), caen a ΔE 2,5 bajo
   deuteranopía — el propio comentario del token ya avisaba de esto ("quien
   las estrene debe revalidarlas para el número de ranuras que vaya a usar,
   no para seis").

   La identidad de cada celda la lleva la ETIQUETA (igual que en cualquier
   treemap profesional); el color sólo ayuda a separar celdas vecinas. Tras la
   revisión del usuario (2026-09-01), el treemap vuelve a la FAMILIA BORDEAUX
   del resto del informe (la detección anterior de celdas pastel fue un
   paréntesis: "la paleta es distinta a todo el resto"). Usa la rampa ordinal
   `--ord-1..4` (los mismos tonos de los gráficos de cuartiles). El texto va
   en `--superficie` (claro sobre el bordeaux oscuro en claro, oscuro sobre el
   bordeaux claro en oscuro) con un HALO `--marca` para que se lea hasta sobre
   la celda más clara (`--ord-4`), y cada celda lleva una separación de la
   superficie de la tarjeta para que el mosaico no se apelmace. Gris mantenido
   para "sin dato" (D-09). Validado por `src/design/validar_paleta.py` §1. */
const RAMPA = ['var(--ord-3)', 'var(--ord-2)', 'var(--ord-4)', 'var(--ord-1)'];

function colorDe(nombre, indice) {
  return esSinDato(nombre) ? 'var(--sin-dato)' : RAMPA[indice % RAMPA.length];
}

/** `nodos`: salida de `squarify()` — cada uno con `.nombre`, `.valor`,
    `.citas`, `.rect`. `nivel`: rótulo del nivel actual, para el `aria-label`
    ("Facultad" / "Escuela"), sólo texto, no cambia el dato. */
export function renderTreemap(nodos, { ancho, alto, nivel = 'unidad', conHijos = () => false } = {}) {
  // Un solo punto de tabulación para todo el mapa (la primera celda
  // realmente dibujada — algunas se saltan por `w<=0||h<=0`), no una por
  // celda: el mismo "veinte paradas de Tab" que las barras ya evitan
  // (paginas.js, tecladoGraficos()), que recorre estas celdas con flechas
  // generalizando el mismo mecanismo.
  let primeraVisible = true;
  const celdas = nodos.map((n, i) => {
    const { x, y, w, h } = n.rect;
    if (w <= 0 || h <= 0) return '';
    const color = colorDe(n.nombre, i);
    const clicable = conHijos(n);
    const tab = primeraVisible ? 0 : -1;
    primeraVisible = false;
    const etiqueta = (w >= CABE_ETIQUETA && h >= 24)
      ? `<text x="${x + 8}" y="${y + 18}" class="treemap-etq">${escapar(n.nombre)}</text>
         ${h >= 42 ? `<text x="${x + 8}" y="${y + 34}" class="treemap-cifra">${nf.format(n.valor)}</text>` : ''}`
      : '';
    return `<g class="treemap-nodo${clicable ? ' es-clicable' : ''}" tabindex="${tab}"
        role="${clicable ? 'button' : 'listitem'}"
        aria-label="${escapar(n.nombre)}: ${nf.format(n.valor)} publicaciones${n.citas != null ? `, ${nf.format(n.citas)} citas` : ''}${clicable ? '. Activar para ver el detalle' : ''}"
        data-tip="${escapar(n.nombre)}" data-tip-v="${nf.format(n.valor)} pub."
        ${n.citas != null ? `data-tip-n="${nf.format(n.citas)} citas · ${escapar(nivel)}"` : `data-tip-n="${escapar(nivel)}"`}
        data-nombre="${escapar(n.nombre)}">
      <rect class="treemap-celda" x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${color}"/>
      ${etiqueta}
    </g>`;
  }).join('');

  return `<svg class="chart treemap-svg" viewBox="0 0 ${ancho} ${alto}" role="list"
      preserveAspectRatio="xMidYMid meet">${celdas}</svg>`;
}

/* --------------------------------------------------------------- montaje */

/** Prepara los hijos de un nodo de `hierarchy.json` para `squarify()`:
    aplana `{nombre, n_publicaciones, citas_totales}` a `{nombre, valor,
    citas}`, que es el vocabulario que entiende el layout. */
/** Exportada: `prerender.mjs` la necesita para dibujar el primer nivel del
    treemap bajo Node, con la misma conversión que usa el navegador. */
export const aPlano = hijos => (hijos || []).map(h => ({
  nombre: h.nombre, valor: h.n_publicaciones, citas: h.citas_totales, _origen: h,
}));

/* --------------------------------------------------------- árbol reactivo */

/** Nodo con la misma forma que `hierarchy.json` (`nombre`, `n_publicaciones`,
    `citas_totales`, `citas_mediana`, y `hijos` si corresponde). */
function nodo(nombre, stats, hijos = null) {
  const n = { nombre, n_publicaciones: stats.n_publicaciones,
              citas_totales: stats.citas_totales, citas_mediana: stats.citas_mediana };
  if (hijos) n.hijos = hijos;
  return n;
}

/** Una mediana de medianas no es la mediana del conjunto — igual que
    `_sumar()` en `07_hierarchy.py`, se declara `null`, no se inventa. */
const sumar = nodos => ({
  n_publicaciones: nodos.reduce((s, n) => s + n.n_publicaciones, 0),
  citas_totales: nodos.reduce((s, n) => s + n.citas_totales, 0),
  citas_mediana: null,
});

/** Reconstruye el árbol Raíz > Facultad > Escuela sobre un recorte de
    publicaciones — el mismo criterio que `07_hierarchy.py` (pares
    autor×publicación), no "publicaciones distintas": `unidades_conteo` de
    cada publicación (cuántos autores UFT hay por unidad, sin identidades)
    es lo que permite reconstruirlo en el navegador sin recibir datos de
    persona. Puerto línea a línea de `construir()` en `07_hierarchy.py` —
    si una de las dos cambia, la otra tiene que cambiar igual, o el treemap
    del recorte completo (sin filtrar) dejaría de coincidir con
    `hierarchy.json`.

    `jerarquia` es `meta.jerarquia` (escuela → facultad, plano). */
export function construirArbol(publicaciones, jerarquia, nombreRaiz) {
  const j = jerarquia || {};
  const facultadDe = u => j[u] || u;

  // 1. Estadísticas por unidad CRUDA (facultad o escuela, tal como aparece
  //    en unidades_conteo), sumando sobre pares, no sobre publicaciones.
  const listasPorUnidad = new Map(); // unidad -> [citas, citas, ...] (una por par)
  for (const p of publicaciones) {
    const conteo = p.unidades_conteo || {};
    for (const [unidad, n] of Object.entries(conteo)) {
      if (!listasPorUnidad.has(unidad)) listasPorUnidad.set(unidad, []);
      const lista = listasPorUnidad.get(unidad);
      if (typeof p.citas === 'number') {
        for (let i = 0; i < n; i++) lista.push(p.citas);
      }
      lista.n_publicaciones = (lista.n_publicaciones || 0) + n;
    }
  }
  const stats = new Map();
  for (const [unidad, lista] of listasPorUnidad) {
    stats.set(unidad, {
      n_publicaciones: lista.n_publicaciones || 0,
      citas_totales: lista.reduce((s, c) => s + c, 0),
      citas_mediana: lista.length ? mediana(lista) : null,
    });
  }

  // 2. Agrupar escuelas bajo su facultad. Una unidad cuya facultad_de(u) es
  //    ella misma NO se repite como hija de sí misma.
  const escuelasPorFacultad = new Map();
  for (const [unidad, s] of stats) {
    const facultad = facultadDe(unidad);
    if (!escuelasPorFacultad.has(facultad)) escuelasPorFacultad.set(facultad, []);
    if (facultad !== unidad) escuelasPorFacultad.get(facultad).push(nodo(unidad, s));
  }

  // 3. Un nodo de facultad por cada clave, sumando su estadística propia
  //    (si la tiene) con la de sus escuelas hijas (si las tiene).
  const facultades = [];
  for (const [facultad, escuelas] of escuelasPorFacultad) {
    let statsFacultad = stats.get(facultad);
    if (!statsFacultad) {
      statsFacultad = escuelas.length
        ? sumar(escuelas) : { n_publicaciones: 0, citas_totales: 0, citas_mediana: null };
    } else if (escuelas.length) {
      const propio = statsFacultad;
      const agregado = sumar(escuelas);
      statsFacultad = {
        n_publicaciones: propio.n_publicaciones + agregado.n_publicaciones,
        citas_totales: propio.citas_totales + agregado.citas_totales,
        citas_mediana: propio.citas_mediana,
      };
    }
    escuelas.sort((a, b) => b.n_publicaciones - a.n_publicaciones);
    facultades.push(nodo(facultad, statsFacultad, escuelas.length ? escuelas : null));
  }
  facultades.sort((a, b) => b.n_publicaciones - a.n_publicaciones);

  return nodo(nombreRaiz, sumar(facultades), facultades);
}

/** Monta un treemap con drill-down en `contenedor` (un elemento del DOM) a
    partir de `arbol` (el `raiz` de `hierarchy.json`).

    Nivel 1: facultades. Clic en una con `hijos` reales: entra a sus escuelas
    con una animación de acercamiento (crossfade + escala desde el punto
    donde se hizo clic — no un morph elemento-a-elemento, que exigiría que
    cada celda persista entre renders; con celdas que cambian de cantidad y
    de orden entre niveles, la persistencia no está garantizada y un morph a
    medias se ve peor que un acercamiento limpio). Un breadcrumb permite
    volver. Se re-dibuja solo, con `ResizeObserver`, si el contenedor cambia
    de tamaño — el sitio no usa JS de terceros para eso tampoco. */
export function montarTreemap(contenedor, arbolRaiz) {
  // Un recorte del explorador vuelve a llamar a esta función sobre el MISMO
  // contenedor con un árbol distinto. replaceChildren() más abajo crea un
  // `lienzo` nuevo cada vez, pero el ResizeObserver de la corrida anterior
  // seguía observando el `lienzo` viejo (ya desprendido del DOM) para
  // siempre si no se desconectaba — mismo bug que ya se corrigió en
  // heatmap.js, mismo arreglo.
  contenedor._treemapObserver?.disconnect();

  const pila = [{ nombre: arbolRaiz.nombre, hijos: aPlano(arbolRaiz.hijos) }];

  const migas = document.createElement('div');
  migas.className = 'treemap-migas';
  const leyenda = document.createElement('div');
  leyenda.className = 'treemap-leyenda';
  // El color en este treemap es una paleta de ORDEN (identidad por etiqueta),
  // no una magnitud: por eso la leyenda no promete "más oscuro = más", sólo
  // aclara el gris de "sin dato" y que el tono alterna entre celdas para
  // ayudar a la vista a separarlas. Cambia con el nivel (facultad/escuela).
  leyenda.innerHTML =
    `<span class="treemap-ley-titulo">Tono</span>` +
    RAMPA.map(t => `<span class="treemap-ley-mostrar" style="background:${t}"></span>`).join('') +
    `<span class="treemap-ley-mostrar treemap-ley-sin" style="background:var(--sin-dato)"></span>` +
    `<span class="treemap-ley-rotulo">identifica la celda · gris = sin datos</span>`;
  const lienzo = document.createElement('div');
  lienzo.className = 'treemap-lienzo';
  contenedor.replaceChildren(migas, leyenda, lienzo);

  function pintarMigas() {
    migas.innerHTML = pila.map((paso, i) => {
      const esUltimo = i === pila.length - 1;
      return esUltimo
        ? `<span class="treemap-miga-actual">${escapar(paso.nombre)}</span>`
        : `<button type="button" class="treemap-miga" data-hasta="${i}">${escapar(paso.nombre)}</button> <span aria-hidden="true">›</span> `;
    }).join('');
  }

  function medir() {
    const r = lienzo.getBoundingClientRect();
    return { ancho: Math.max(1, Math.round(r.width)), alto: Math.max(1, Math.round(r.height || r.width * 0.55)) };
  }

  function dibujar({ origen } = {}) {
    const paso = pila[pila.length - 1];
    const { ancho, alto } = medir();
    const nodos = squarify(paso.hijos, { ancho, alto });
    const conHijos = n => !!(n._origen && n._origen.hijos && n._origen.hijos.length);
    const svgHtml = renderTreemap(nodos, {
      ancho, alto, nivel: pila.length === 1 ? 'Facultad' : 'Escuela', conHijos,
    });

    const entrante = document.createElement('div');
    entrante.className = 'treemap-capa treemap-entrando';
    entrante.innerHTML = svgHtml;

    if (origen) {
      // Origen del acercamiento: el punto donde se hizo clic, en % del
      // lienzo, para que el zoom "salga" de ahí en vez de desde el centro.
      const r = lienzo.getBoundingClientRect();
      const ox = ((origen.left + origen.width / 2 - r.left) / r.width) * 100;
      const oy = ((origen.top + origen.height / 2 - r.top) / r.height) * 100;
      entrante.style.transformOrigin = `${ox}% ${oy}%`;
    }

    const saliente = lienzo.querySelector('.treemap-capa:not(.treemap-saliendo)');
    lienzo.appendChild(entrante);
    // Fuerza un reflow antes de quitar la clase de entrada: si no, el
    // navegador puede fusionar el estado inicial y final en un mismo frame
    // y la transición no se ve.
    void entrante.offsetWidth;
    entrante.classList.remove('treemap-entrando');

    if (saliente) {
      saliente.classList.add('treemap-saliendo');
      saliente.addEventListener('transitionend', () => saliente.remove(), { once: true });
      // Salvavidas: si el navegador no dispara transitionend (motion
      // reducida, pestaña en segundo plano), no se acumulan capas.
      setTimeout(() => saliente.remove(), 500);
    }

    pintarMigas();
  }

  lienzo.addEventListener('click', e => {
    const celda = e.target.closest('.treemap-nodo.es-clicable');
    if (!celda) return;
    const nombre = celda.dataset.nombre;
    const nodo = pila[pila.length - 1].hijos.find(h => h.nombre === nombre);
    if (!nodo?._origen?.hijos?.length) return;
    pila.push({ nombre: nodo.nombre, hijos: aPlano(nodo._origen.hijos) });
    dibujar({ origen: celda.getBoundingClientRect() });
  });
  lienzo.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const celda = e.target.closest?.('.treemap-nodo.es-clicable');
    if (!celda) return;
    e.preventDefault();
    celda.click();
  });

  migas.addEventListener('click', e => {
    const b = e.target.closest('.treemap-miga');
    if (!b) return;
    const hasta = Number(b.dataset.hasta);
    pila.length = hasta + 1;
    dibujar();
  });

  dibujar();

  let pendiente = null;
  const observador = new ResizeObserver(() => {
    clearTimeout(pendiente);
    pendiente = setTimeout(() => dibujar(), 120);
  });
  observador.observe(lienzo);
  contenedor._treemapObserver = observador;
}
