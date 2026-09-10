/* core.js — carga de datos, formato, gráficos y ayuda contextual.
   Sin dependencias externas. Los gráficos se dibujan como SVG inline: evita
   cargar una librería desde un CDN, cosa que el sitio no puede permitirse. */

/* Ruta relativa a la página. El sitio se sirve desde `dist/`, que ensambla
   src/build/06_assemble_site.py: las páginas quedan en la raíz y los
   artefactos bajo ./data/. Servir `web/` directamente no funciona a propósito:
   sin los datos ensamblados el sitio no debe aparentar estar completo. */
const RUTA_DATOS = 'data';

/* --------------------------------------------------------------- datos */
const cache = new Map();

export async function cargar(nombre) {
  if (cache.has(nombre)) return cache.get(nombre);
  const p = fetch(`${RUTA_DATOS}/${nombre}`).then(r => {
    if (!r.ok) throw new Error(`No se pudo cargar ${nombre} (${r.status})`);
    return r.json();
  });
  cache.set(nombre, p);
  return p;
}

/* -------------------------------------------------------------- formato */
export const nf = new Intl.NumberFormat('es-CL');

export function num(v, dec = 0) {
  if (v === null || v === undefined) return null;
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: dec, maximumFractionDigits: dec
  }).format(v);
}

/** La frase que declara, en el papel, sobre qué conjunto está medido lo que se
    imprime. Una sola redacción para los dos caminos que la escriben —el
    pre-renderizado, que sólo conoce el informe completo, y `paginas.js`, que
    conoce el recorte vigente—: dos textos para la misma declaración divergen
    sin que nadie lo note.

    Sin filtros lo dice con todas las letras. En un PDF archivado «no dice
    nada» y «es el informe completo» son indistinguibles, y el informe
    institucional de `make informe` se genera precisamente sin filtros. */
export function fraseRecorte(n, total, partes = []) {
  // Sin doblar el punto: muchas firmas terminan en abreviatura —«Abara J.F.»—
  // y la frase acababa en «J.F..», que en un informe con el nombre de una
  // persona se lee como un descuido sobre esa persona.
  const cerrar = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
  // `n` y `total` pueden faltar: una página sin explorador conoce el recorte
  // —viene en la URL— pero no tiene el corpus cargado para contarlo, y una
  // cifra inventada sería peor que ninguna.
  const cuantas = (n === null || n === undefined || total === null || total === undefined)
    ? '' : ` ${nf.format(n)} de ${nf.format(total)} publicaciones.`;
  return partes.length
    ? `Recorte aplicado: ${cerrar(partes.join(' · '))}${cuantas}`
    : `Sin filtros: el informe completo, ${nf.format(total)} publicaciones.`;
}

/** Ausencia de dato y cero nunca se ven igual (decisión D-24). */
export function celda(v, dec = 0) {
  if (v === null || v === undefined || v === '')
    return '<span class="sin-dato-txt">Sin dato declarado</span>';
  return typeof v === 'number' ? num(v, dec) : escapar(v);
}

/** Un año es una etiqueta, no una cantidad: nunca lleva separador de millar.
    Con el formato numérico de es-CL, 2025 se imprimía «2.025». */
export function anio(v) {
  if (v === null || v === undefined || v === '')
    return '<span class="sin-dato-txt">Sin dato declarado</span>';
  return escapar(String(v));
}

/** El nombre de una sección, sin la coletilla del informe.

    «Producción — Informe Bibliométrico» es un buen `<title>` para una pestaña
    del navegador y un mal titular para la hoja 1 de la sección de producción,
    donde la línea de crédito ya dice de qué informe se trata: el nombre se
    repetía en las cuatro portadillas del PDF.

    Vive aquí porque lo necesitan dos consumidores —el pre-renderizador y el
    navegador— y ya se había escrito dos veces, mal las dos: ambas cortaban por
    «·» y el separador del título es «—», así que no cortaban nada. Se aceptan
    los dos: el título los ha usado en distintos momentos, y una regla que sólo
    contemple el de hoy se rompe en cuanto alguien cambie el otro. */
export const tituloDeSeccion = (t, sino = '') =>
  String(t || '').split(/\s+[—·]\s+/)[0].trim() || sino;

export function escapar(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------------- tema */

/* Tres estados explícitos, no dos: «automático» sigue al sistema operativo y es
   el de partida. La elección se recuerda; sin elección, no se escribe nada y el
   sitio respeta la preferencia del sistema. */
const TEMAS = [
  ['auto', 'Auto', 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.5-6.5-.7.7M6.2 17.8l-.7.7m12.6 0-.7-.7M6.2 6.2l-.7-.7M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  ['claro', 'Claro', 'M12 4v1m0 14v1m8-8h-1M5 12H4m13.7-5.7-.7.7M6.9 17.1l-.7.7m11.5 0-.7-.7M6.9 6.9l-.7-.7M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'],
  ['oscuro', 'Oscuro', 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z'],
];

function aplicarTema(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', t);
  try { t === 'auto' ? localStorage.removeItem('tema') : localStorage.setItem('tema', t); } catch { /* modo privado */ }
  document.querySelectorAll('.tema button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.tema === t)));
}

/* Se aplica antes de pintar para no mostrar un destello del tema equivocado. */
export function temaInicial() {
  try {
    const t = localStorage.getItem('tema');
    if (t) document.documentElement.setAttribute('data-tema', t);
    return t || 'auto';
  } catch { return 'auto'; }
}

/* ------------------------------------------------------------ cabecera */

export const PAGINAS = [
  ['index.html', 'Portada'],
  ['produccion.html', 'Producción'],
  ['impacto.html', 'Impacto'],
  ['colaboracion.html', 'Colaboración'],
  ['tematica.html', 'Áreas temáticas'],
  ['autores.html', 'Autores'],
  ['publicaciones.html', 'Publicaciones'],
  ['fuentes-externas.html', 'Fuentes externas'],
  ['indicadores.html', 'Indicadores'],
  ['produccion-ampliada.html', 'Producción ampliada'],
  ['metodologia.html', 'Metodología'],
];

/* Navegación agrupada en secciones. Cada grupo agrega un rótulo corto que sólo
   se muestra en el menú colapsado (móvil/tablet); en banda ancha los dos
   grupos de la izquierda (Informe / Datos) se tratan como uno y no se rotulan,
   para no meter más ruido del que se quita. */
export const NAV_GRUPOS = [
  {
    nombre: 'Informe',
    paginas: ['index.html', 'produccion.html', 'impacto.html', 'colaboracion.html', 'tematica.html'],
  },
  {
    nombre: 'Datos',
    paginas: ['autores.html', 'publicaciones.html', 'fuentes-externas.html'],
  },
  {
    nombre: 'Sobre este informe',
    paginas: ['indicadores.html', 'metodologia.html'],
  },
];

/** El nav completo marcado por grupo. En banda ancha los grupos se funden en
    una sola fila (sin rótulos); el rótulo de grupo aparece sólo cuando el menú
    se colapsa. `paginaActual` decide el aria-current. */
export function navHtml(paginaActual) {
  return NAV_GRUPOS.map(g => `<div class="nav-grupo">
    <span class="nav-grupo-nombre">${g.nombre}</span>
    <span class="nav-grupo-enlaces">${g.paginas.map(href => {
      const [, txt] = PAGINAS.find(([h]) => h === href) || [];
      return `<a href="${href}"${href === paginaActual ? ' aria-current="page"' : ''}>${txt}</a>`;
    }).join('')}</span>
  </div>`).join('');
}

/** Nombre legible de la página actual (para el rótulo de posición y las
    migas). Del `PAGINAS` ordenado, con una excepción para `autor.html` — la
    ficha de un autor, cuya etiqueta no puede saberse de antemano. */
function nombrePagina(href) {
  const hit = PAGINAS.find(([h]) => h === href);
  if (hit) return hit[1];
  return href === 'autor.html' ? 'Ficha de autor' : '';
}

export function cromo(meta, paginaActual, tema = 'auto') {
  const nav = navHtml(paginaActual);
  const actual = nombrePagina(paginaActual);
  // El universo, no el largo de `publications.json`: aquí no hay corpus
  // cargado, y por `D-16` el universo es una cifra declarada del informe. Es
  // la misma que el pie ya imprime en todas las páginas.
  const universo = meta.denominadores.universo_total;

  const selectorTema = `<div class="tema" role="group" aria-label="Tema de color">${
    TEMAS.map(([id, txt, d]) => `<button type="button" data-tema="${id}"
      aria-pressed="${String(id === tema)}" title="Tema ${txt.toLowerCase()}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>${txt}</span></button>`).join('')}</div>`;

  return {
    cabecera: `
    <div class="contenedor">
      <div class="marca-fila">
        <a class="marca" href="index.html">
          <span class="marca-sigla" aria-hidden="true">UFT</span>
          <span class="marca-txt">
            <strong>${escapar(meta.institucion)}</strong>
            <span>${escapar(meta.titulo_plataforma)}</span>
          </span>
        </a>
        ${selectorTema}
        <button type="button" class="nav-toggle" aria-expanded="false"
          aria-controls="menu-nav" aria-label="Abrir menú de secciones">
          <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"
            fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
            <path d="M4 7h16M4 12h16M4 17h16"/></svg>
          <span>Secciones</span>
        </button>
      </div>
      <nav class="nav" id="menu-nav" aria-label="Secciones">${nav}</nav>
    </div>`,

    /* La barra de vigencia lleva dos párrafos que en pantalla no existen y en
       papel son la línea de crédito del informe descargado.

       `.credito-impreso` — Fuente, ventana y fecha de corte de las citas están
       arriba, en tres pastillas, pero son `<details>` interactivos y la hoja
       de impresión los oculta: la caja se imprimía con su filete y sin una
       palabra dentro. El CSV exportado ya llevaba esos tres datos en su
       cabecera —`exportar()` en paginas.js— y el PDF no llevaba ninguno, que
       es la asimetría que esto corrige. Mismo `meta`, dos presentaciones, sin
       un segundo texto que pueda divergir.

       `.recorte-impreso` — nace declarando el informe completo y lo reescribe
       `actualizarRecorteVivo()` en cuanto hay un recorte, que es donde vive el
       estado del filtro. No se deja vacío a la espera de ese repintado: en una
       página pre-renderizada sin filtros el repintado NO ocurre —`paginas.js`
       se lo salta para no destruir un LCP que ya pasó— y la hoja habría salido
       sin declarar nada. Como el pie, que ya imprime el universo en todas las
       páginas, esto se imprime en todas: es la identidad del informe, no un
       adorno de las páginas con explorador. */
    vigencia: `
    <div class="contenedor">
      <nav class="v-migas" aria-label="Ruta de posición">
        <a href="index.html">Portada</a>
        <span class="migas-sep" aria-hidden="true">·</span>
        <span class="migas-actual" aria-current="page">${escapar(actual || 'Inicio')}</span>
      </nav>
      <span class="sep" aria-hidden="true"></span>
      <details class="v-chip">
        <summary>Fuente <b>${escapar(meta.fuentes.join(' · '))}</b></summary>
        <p>Bases de datos institucionales consultadas para el universo de publicaciones del informe.</p>
      </details>
      <span class="sep" aria-hidden="true"></span>
      <details class="v-chip">
        <summary>Ventana <b>${meta.ventana.inicio}–${meta.ventana.fin}</b></summary>
        <p>Fechas de publicación consideradas como universo del informe. Fuera de este periodo un trabajo no aparece.</p>
      </details>
      <span class="sep" aria-hidden="true"></span>
      <details class="v-chip">
        <summary>Citas al <b>${escapar(meta.fecha_corte_citas)}</b></summary>
        <p>Fecha en que se congelaron el recuento de citas y las métricas derivadas.</p>
      </details>
      <span class="recorte-vivo" id="recorte-vivo" hidden></span>
      <p class="solo-papel credito-impreso">
        ${escapar(meta.institucion)} · ${escapar(meta.titulo_plataforma)}.
        Fuentes: ${escapar(meta.fuentes.join(' · '))}.
        Ventana ${meta.ventana.inicio}–${meta.ventana.fin}.
        Citas actualizadas al ${escapar(meta.fecha_corte_citas)}.
      </p>
      <p class="solo-papel recorte-impreso" id="recorte-impreso">${
        escapar(fraseRecorte(universo, universo))}</p>
      <p class="solo-papel recorte-impreso" id="seleccion-impresa"></p>
      <label class="v-anio" id="recorte-anio-env" hidden>
        <span class="solo-lectores">Filtrar por año</span>
        <select id="recorte-anio" aria-label="Filtrar por año de publicación"></select>
      </label>
      <button type="button" class="descargar" id="descargar-informe"
        title="Abre el diálogo de impresión del navegador; elija «Guardar como PDF»">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Descargar informe
      </button>
      <a class="vigencia-guia" href="metodologia.html">Cómo leer estos indicadores →</a>
    </div>`,

    pie: `
    <div class="contenedor">
      <p>${escapar(meta.advertencia_global)}
      Ver <a href="metodologia.html">metodología y limitaciones</a>.</p>
      <p>Universo: ${nf.format(meta.denominadores.universo_total)} publicaciones ·
      ${nf.format(meta.denominadores.con_metricas)} con métricas ·
      ${nf.format(meta.denominadores.con_autoria_detallada)} con autoría detallada.
      Build ${meta.fecha_build}.</p>
    </div>`,
  };
}

/** Escribe el cromo en la página y engancha el conmutador de tema.

    Si el pre-renderizador ya dejó el HTML puesto, no se vuelve a pintar: sólo
    se corrige el botón de tema y se enganchan los eventos. Repintar borraría
    un LCP que ya ocurrió. */
export async function montarCabecera(paginaActual) {
  const meta = await cargar('meta.json');
  const cab = document.getElementById('cabecera');

  if (!cab.dataset.prerender) {
    const html = cromo(meta, paginaActual, temaInicial());
    cab.innerHTML = html.cabecera;
    document.getElementById('vigencia').innerHTML = html.vigencia;
    const pie = document.getElementById('pie');
    if (pie) pie.innerHTML = html.pie;
  } else {
    const t = temaInicial();
    document.querySelectorAll('.tema button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.tema === t)));
  }

  document.querySelectorAll('.tema button').forEach(b =>
    b.addEventListener('click', () => aplicarTema(b.dataset.tema)));

  /* Menú de navegación colapsable: en móvil/tablet el nav se pliega bajo un
     conmutador y se despliega al pulsarlo. El conmutador sólo se ve donde hace
     falta (CSS); en banda ancha queda oculto y este escucha no estorba. */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('menu-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const abierto = nav.classList.toggle('abierto');
      toggle.setAttribute('aria-expanded', String(abierto));
      toggle.setAttribute('aria-label',
        abierto ? 'Cerrar menú de secciones' : 'Abrir menú de secciones');
    });
    // Elegir una sección cierra el menú (en pantallas donde el nav se pliega).
    nav.addEventListener('click', e => {
      if (e.target.closest('a')) {
        nav.classList.remove('abierto');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menú de secciones');
      }
    });
  }

  /* Descargar el informe. Es `print()` a propósito y no una librería de PDF:
     el navegador ya sabe paginar, embeber tipografías y producir texto
     seleccionable y buscable. Una librería costaría entre 300 KB y 1 MB y, o
     bien rasteriza el texto —adiós accesibilidad y búsqueda—, o bien obliga a
     reimplementar el informe en su propia API de maquetación, que sería una
     segunda definición del marcado.

     El botón no se esconde si falta `print`: no falta en ningún navegador de
     escritorio, y en móvil el diálogo también existe. */
  const btn = document.getElementById('descargar-informe');
  if (btn) btn.addEventListener('click', () => window.print());

  return meta;
}

/* ---------------------------------------------------------------- notas */
export function nota(n) {
  if (!n) return '';
  if (n.destacada) {
    return `<p class="nota-destacada"><b>Advertencia metodológica</b>${escapar(n.texto)}</p>`;
  }
  return `<p class="nota">${escapar(n.texto)}</p>`;
}

/* --------------------------------------------------- ayuda contextual */
let glosario = null;

export async function montarAyuda() {
  if (!glosario) glosario = (await cargar('glossary.json')).entradas;
  const panel = document.createElement('div');
  panel.className = 'ayuda-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'tooltip');
  document.body.appendChild(panel);

  const mostrar = (btn) => {
    const termino = btn.dataset.ayuda.toLowerCase();
    const e = glosario.find(g => g.slug.includes(termino) || g.termino.toLowerCase().includes(termino));
    if (!e) return;
    panel.innerHTML = `<strong>${escapar(e.termino)}</strong><br>${escapar(e.corto)}
      <br><a href="metodologia.html#${e.slug}">Ver definición completa</a>`;
    panel.hidden = false;
    const r = btn.getBoundingClientRect();
    panel.style.top = `${window.scrollY + r.bottom + 6}px`;
    panel.style.left = `${Math.max(8, Math.min(window.scrollX + r.left - 40,
      window.innerWidth - panel.offsetWidth - 12))}px`;
  };
  const ocultar = () => { panel.hidden = true; };

  // Accesible por foco y no sólo por hover: si sólo respondiera al puntero,
  // la ayuda no existiría por teclado ni en móvil.
  document.addEventListener('mouseover', e => {
    const b = e.target.closest('[data-ayuda]'); if (b) mostrar(b);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-ayuda]')) ocultar();
  });
  document.addEventListener('focusin', e => {
    const b = e.target.closest('[data-ayuda]'); if (b) mostrar(b);
  });
  document.addEventListener('focusout', ocultar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ocultar(); });
}

export function botonAyuda(termino) {
  return `<button class="ayuda" type="button" data-ayuda="${escapar(termino)}"
    aria-label="Qué significa ${escapar(termino)}">?</button>`;
}

/* `data-k` en cada marca es la CLAVE de la categoría. La usa animar.js para
   reconocer una barra entre dos repintados: sin ella, al recortar el conjunto
   toda figura sería nueva y no habría nada que mover, sólo un reemplazo.
   Se emite aquí, junto al dato, y no se calcula fuera. */

/* ------------------------------------------------------------ gráficos */

/* Una categoría que representa AUSENCIA de dato nunca se pinta como una que
   representa una medición (decisión D-09). El nombre de esas categorías lo fija
   el build, así que la lista vive aquí y no se adivina por color. */
const SIN_DATO = /^(sin dato|no determinad|sin declarar|desconocid)/i;
export const esSinDato = v => SIN_DATO.test(String(v).trim());

/** Sello de procedencia de un indicador.

    Responde, sin que haya que buscarlo, a las cuatro preguntas que decide si
    una cifra puede citarse: de dónde sale, a qué fecha, sobre cuántos casos y
    con qué cobertura. El N NO es global —1.342 en producción y en impacto,
    1.960 pares autor × publicación en unidad académica— y por eso viaja pegado
    al gráfico y no en el pie de la página.

    Por debajo del umbral de cobertura declarado en config, el sello cambia de
    registro y pasa a ser una advertencia. Lo decide el dato. */
export function sello(p) {
  if (!p) return '';
  // Sin recuento de cobertura no se enseña la cláusula: decir «—» insinúa que
  // el dato existe y no se pudo calcular, y aquí lo que pasa es que nadie ha
  // afirmado nada. Callar es la lectura correcta.
  const hayCob = p.cubiertas !== null && p.cubiertas !== undefined;
  const cob = p.cobertura === null || p.cobertura === undefined
    ? '—' : `${num(p.cobertura, 1)} %`;
  const clase = p.insuficiente ? 'sello sello-aviso' : 'sello';
  const aviso = p.insuficiente
    ? `<span class="sello-alerta">cobertura baja</span>` : '';
  return `<p class="${clase}">
    <span><b>Fuente</b> ${escapar(p.fuente)}</span>
    <span><b>Corte</b> ${escapar(p.corte)}</span>
    <span><b>N</b> ${nf.format(p.n)} ${escapar(p.unidad || 'publicaciones')}</span>
    ${hayCob ? `<span><b>Cobertura</b> ${cob} · ${nf.format(p.cubiertas)} con dato</span>` : ''}
    ${aviso}</p>`;
}


/* Orden fijo de series. Nunca se cicla ni se reasigna según el ranking: el
   color sigue a la entidad, no a su posición.

   Son SEIS, no ocho: la paleta se validó a seis ranuras y añadir una séptima
   obligaría a meter un tono en la franja que ya ocupan otros. Más allá de seis
   entidades, lo correcto es agrupar en «Otras» o separar en varios gráficos,
   no generar un color nuevo. */
export const SERIES = Array.from({ length: 6 }, (_, i) => `var(--serie-${i + 1})`);

/* Rampa ordinal: un solo tono en cuatro pasos. Para escalas ORDENADAS
   (cuartiles, tramos). Cuatro tonos distintos afirmarían que Q1 y Q4 son
   categorías sin relación, cuando son posiciones de una misma escala. */
const ORDINAL = ['var(--ord-1)', 'var(--ord-2)', 'var(--ord-3)', 'var(--ord-4)'];

/** Color de una barra.

    `escala` distingue los tres casos que el color puede estar codificando:
      - null       una sola serie. El caso por defecto, y el correcto para un
                   ranking por volumen: colorear por posición haría que el color
                   siguiera al rank y repintara los supervivientes al filtrar.
      - 'serie'    entidades distintas sin orden entre sí.
      - 'ordinal'  posiciones de una escala ordenada.
    La ausencia de dato ignora las tres y siempre sale gris (decisión D-09). */
function colorDe(d, i, escala) {
  if (esSinDato(d.valor)) return 'var(--sin-dato)';
  if (escala === 'ordinal') return ORDINAL[Math.min(i, ORDINAL.length - 1)];
  if (escala === 'serie') return SERIES[i % SERIES.length];
  return 'var(--serie-1)';
}

/* Ancho aproximado de un texto a 11px en la fuente de sistema. No hay forma de
   medir dentro de una cadena SVG que aún no está en el documento, y el error de
   una estimación es preferible a que la etiqueta se salga del lienzo. */
// 13 px, que es lo que mide ahora `svg.chart text` en la hoja. Si este
// número y el del CSS se separan, las etiquetas se recortan donde no toca.
const anchoTexto = (s, px = 13) => String(s).length * px * 0.58;

/** Recorta una etiqueta al ancho disponible, con puntos suspensivos. */
function recortar(txt, maxPx, px = 11) {
  const s = String(txt);
  if (anchoTexto(s, px) <= maxPx) return s;
  const maxCar = Math.max(4, Math.floor(maxPx / (px * 0.58)) - 1);
  return s.slice(0, maxCar).trimEnd() + '…';
}

let idGrafico = 0;

/** Barras horizontales. Elegidas cuando las etiquetas son largas o muchas. */
export function barrasH(datos, {
  alto = 26, escala = null, sufijo = '', ancho = 680, cuotaValida = false,
  titulo = '', trama = false, refEtiqueta = '',
} = {}) {
  if (!datos.length) return '<p class="vacio">Sin datos para mostrar.</p>';
  // El máximo tiene que contemplar el valor esperado: si el observado se queda
  // corto, la marca de referencia caería fuera del lienzo justo en el caso que
  // más importa enseñar.
  const esperados = datos.map(d => d.esperado).filter(v => v != null);
  const max = Math.max(...datos.map(d => d.n), ...esperados, 1);

  // El ancho del lienzo se declara según el contexto. El SVG se escala al
  // contenedor, así que un lienzo de 680 dentro de una columna de 330 reduce el
  // texto a la mitad y lo vuelve ilegible: en una tarjeta estrecha se pide un
  // lienzo estrecho, no un escalado.
  //
  // La columna de etiquetas se dimensiona con el contenido real y se acota a un
  // tercio del lienzo. Antes era fija en 210 px y los nombres largos se salían
  // del viewBox por la izquierda, apareciendo cortados por el lado equivocado.
  const anchoValor = 56;
  // En un lienzo estrecho la etiqueta puede ocupar una fracción mayor: si no,
  // no cabe ni una palabra y la barra gana un espacio que no necesita.
  const anchoEtiqueta = Math.min(
    Math.max(96, Math.ceil(Math.max(...datos.map(d => anchoTexto(d.valor)))) + 14),
    Math.round(ancho * (ancho < 420 ? 0.44 : 0.34)));
  const anchoPista = ancho - anchoEtiqueta - anchoValor;
  const total = datos.length * alto + 10;
  const id = `g${++idGrafico}`;

  /* Cuota sobre el total mostrado. Se omite cuando las barras no son partes de
     un total —multivaluados, umbrales encajados, rankings recortados—: ahí un
     porcentaje sería una afirmación falsa, no una ayuda. */
  const sumaBarras = datos.reduce((s, d) => s + d.n, 0);
  const cuota = d => (cuotaValida && sumaBarras
    ? `${(100 * d.n / sumaBarras).toFixed(1).replace('.', ',')} % de lo mostrado` : '');

  /* ¿Sobrevivió alguna etiqueta al recorte? Lo necesita el papel: en pantalla
     la etiqueta recortada tiene su nombre completo a un tooltip de distancia,
     y en una hoja no hay tooltip. Cuando el recorte se comió un nombre, la
     tabla equivalente es la única que lo dice entero, así que se imprime;
     cuando no, la tabla repetiría barra por barra lo que la figura ya rotula.
     Se marca en el SVG y lo lee la hoja de impresión (`data-cifras`). */
  let recortadas = false;

  const filas = datos.map((d, i) => {
    const y = i * alto;
    const w = Math.max(2, anchoPista * (d.n / max));
    // px=13: mismo tamaño que `anchoEtiqueta` asumió para dimensionar la
    // columna (svg.chart text, app.css). Con el valor por defecto de
    // recortar() (11px) el recorte suponía una fuente más angosta que la
    // real, dejaba de más caracteres de los que caben, y el texto —anclado
    // por el extremo derecho (text-anchor="end")— se salía del lienzo por
    // la izquierda: exactamente el "lado equivocado" que el comentario de
    // más arriba decía resuelto.
    const etq = recortar(d.valor, anchoEtiqueta - 14, 13);
    if (etq !== String(d.valor)) recortadas = true;
    const cy = y + alto / 2;
    const nota = d.nota || cuota(d);

    // Marca del valor esperado. Una barra de recuento no dice si es mucho o
    // poco; con la referencia al lado, la comparación es inmediata y no exige
    // que el lector calcule un porcentaje de cabeza.
    let ref = '', refAria = '', xValor = anchoEtiqueta + w + 7;
    if (d.esperado != null) {
      const xr = anchoEtiqueta + anchoPista * (d.esperado / max);
      ref = `<line class="esperado" x1="${xr}" x2="${xr}" y1="${y + 2}" y2="${y + alto - 2}"/>`;
      const dif = d.n >= d.esperado ? 'por encima de' : 'por debajo de';
      refAria = `, ${dif} lo esperable (${nf.format(d.esperado)})`;
      // Cuando lo esperable queda a la DERECHA de la barra —es decir, cuando el
      // valor observado se queda corto— la marca cae justo donde iba la cifra y
      // ambas se pisan. La cifra se corre más allá de la marca: es el caso que
      // más importa leer, y taparlo lo volvería ilegible justo ahí.
      if (xr > anchoEtiqueta + w) xValor = xr + 7;
    }

    // La trama va ENCIMA del relleno, no en lugar de él: así funciona con
    // cualquier color de barra, incluido el gris de «sin dato», sin necesitar
    // un patrón por color.
    const rayado = trama
      ? `<rect class="trama" x="${anchoEtiqueta}" y="${y + 6}" width="${w}"
           height="${alto - 12}" rx="4" fill="url(#${id}-t)"/>` : '';

    return `<g class="marca" data-k="${escapar(String(d.valor))}" tabindex="${i ? -1 : 0}" role="listitem"
        aria-label="${escapar(d.valor)}: ${nf.format(d.n)}${sufijo}${refAria}"
        data-tip="${escapar(d.valor)}" data-tip-v="${nf.format(d.n)}${sufijo}"
        ${nota ? `data-tip-n="${escapar(nota)}"` : ''}>
      <text x="${anchoEtiqueta - 10}" y="${cy + 3.5}" text-anchor="end">${escapar(etq)}</text>
      <rect class="barra" fill="${colorDe(d, i, escala)}" x="${anchoEtiqueta}" y="${y + 6}"
        width="${w}" height="${alto - 12}" rx="4"/>${rayado}${ref}
      <text class="valor" x="${xValor}" y="${cy + 3.5}">${nf.format(d.n)}${sufijo}</text>
    </g>`;
  }).join('');

  /* El patrón se declara una vez por gráfico. Las líneas van en el color de la
     superficie, de modo que «cortan» la barra en lugar de teñirla: el rayado se
     lee igual sobre cualquier relleno y sobrevive a la impresión en gris. */
  const defs = trama ? `<defs>
    <pattern id="${id}-t" width="7" height="7" patternUnits="userSpaceOnUse"
             patternTransform="rotate(45)">
      <rect width="7" height="7" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="7" stroke="var(--superficie)" stroke-width="2.4"/>
    </pattern></defs>` : '';

  // La etiqueta accesible nombra el INDICADOR, no la forma del gráfico: cinco
  // «gráfico de barras horizontales» seguidos no le dicen nada a quien navega
  // con lector de pantalla.
  const etq = titulo ? `${titulo} — gráfico de barras, ${datos.length} categorías`
                     : `Gráfico de barras horizontales, ${datos.length} categorías`;
  const pie = refEtiqueta
    ? `<p class="leyenda-ref">${escapar(refEtiqueta)}</p>` : '';
  return `<div class="grafico"><svg class="chart" id="${id}" viewBox="0 0 ${ancho} ${total}"
    data-cifras="${recortadas ? 'parciales' : 'completas'}"
    role="list" aria-label="${escapar(etq)}">${defs}${filas}</svg></div>${pie}`;
}

/** Barras verticales. Para series anuales cortas: 3 años no son una línea. */
export function barrasV(datos, {
  etiquetaX = 'anio', etiquetaY = 'n', referencia = null,
  refEtiqueta = '', decimales = 0, ancho = 680, alto = 260, titulo = '',
} = {}) {
  if (!datos.length) return '<p class="vacio">Sin datos para mostrar.</p>';
  const mIzq = 52, mDer = 16, mAb = 38, mArr = 26;

  /* Tres años estirados a lo ancho de una tarjeta de 900 px son tres barras
     finas perdidas en un descampado: el ojo lee «poco dato», que es una
     impresión y no una medición. El lienzo se ajusta al número de categorías y
     el contenedor se acota al mismo valor, de modo que el SVG se dibuja a
     escala 1:1 y el texto sale al tamaño que se declaró. Estirar el viewBox sin
     acotar el contenedor —o al revés— deforma la tipografía del gráfico. */
  ancho = Math.min(ancho, mIzq + mDer + datos.length * 150);

  const vals = datos.map(d => d[etiquetaY]).filter(v => v !== null && v !== undefined);
  const max = Math.max(...vals, referencia || 0) * 1.18 || 1;
  const bw = (ancho - mIzq - mDer) / datos.length;
  const base = alto - mAb;
  const y = v => mArr + (base - mArr) * (1 - v / max);

  // Rejilla recesiva con tres marcas: da escala sin competir con las barras.
  const pasos = [0, max / 2, max];
  // El cero se rotula «0», no «0,0»: un decimal en el origen sugiere una
  // precisión que la marca de escala no tiene.
  const tick = v => (v === 0 ? '0' : num(v, max < 10 ? 1 : 0));
  const red = pasos.map(v => `
    <line class="red" x1="${mIzq}" x2="${ancho - mDer}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="tick" x="${mIzq - 8}" y="${y(v) + 3.5}" text-anchor="end">${tick(v)}</text>`
  ).join('');

  // Barras finas: como mucho 56 px, y nunca más de la mitad del hueco.
  const w = Math.min(56, bw * 0.5);
  const barras = datos.map((d, i) => {
    const v = d[etiquetaY];
    const x = mIzq + i * bw + (bw - w) / 2;
    if (v === null || v === undefined) {
      return `<g class="marca" data-k="${escapar(String(d[etiquetaX]))}" role="listitem" aria-label="${escapar(String(d[etiquetaX]))}: sin dato">
        <text class="tick" x="${x + w / 2}" y="${base - 8}" text-anchor="middle">sin dato</text>
        <text x="${x + w / 2}" y="${base + 18}" text-anchor="middle">${escapar(String(d[etiquetaX]))}</text>
      </g>`;
    }
    const yy = y(v);
    return `<g class="marca" data-k="${escapar(String(d[etiquetaX]))}" tabindex="${i ? -1 : 0}" role="listitem"
        aria-label="${escapar(String(d[etiquetaX]))}: ${num(v, decimales)}"
        data-tip="${escapar(String(d[etiquetaX]))}" data-tip-v="${num(v, decimales)}"
        ${d.nota ? `data-tip-n="${escapar(d.nota)}"` : ''}>
      <rect class="barra" x="${x}" y="${yy}" width="${w}" height="${Math.max(2, base - yy)}" rx="4"/>
      <text class="valor" x="${x + w / 2}" y="${yy - 7}" text-anchor="middle">${num(v, decimales)}</text>
      <text x="${x + w / 2}" y="${base + 18}" text-anchor="middle">${escapar(String(d[etiquetaX]))}</text>
    </g>`;
  }).join('');

  // La etiqueta de referencia va sobre la línea y alineada a la derecha, pero
  // sin invadir la última barra: se sube un poco cuando queda muy arriba.
  const ref = referencia !== null ? `
    <line class="ref" x1="${mIzq}" x2="${ancho - mDer}" y1="${y(referencia)}" y2="${y(referencia)}"/>
    <text class="ref-etq" x="${ancho - mDer}" y="${Math.max(12, y(referencia) - 7)}"
      text-anchor="end">${escapar(refEtiqueta || String(referencia))}</text>` : '';

  const etq = titulo ? `${titulo} — gráfico de barras por año, ${datos.length} años`
                     : `Gráfico de barras verticales, ${datos.length} valores`;
  // `completas`: cada barra lleva su valor encima y su categoría debajo, sin
  // recorte. En papel, la tabla equivalente no añadiría nada. Ver `barrasH`.
  return `<div class="grafico" style="max-width:${ancho}px"><svg class="chart" viewBox="0 0 ${ancho} ${alto}"
    data-cifras="completas" role="list" aria-label="${escapar(etq)}">
    ${red}${ref}${barras}
    <line class="eje" x1="${mIzq}" x2="${ancho - mDer}" y1="${base}" y2="${base}"/>
  </svg></div>`;
}

/* ═══════════════════════════════════════════ red() — C-05, coautoría

   Cuarta primitiva, no una variante de las tres anteriores. Las otras tres
   comparten un supuesto que la red rompe: cada marca es una categoría discreta
   y su identidad la lleva el color. En un grafo la pertenencia a un grupo la
   lleva la POSICIÓN —el layout hace visibles los cúmulos como densidad
   espacial—, así que el color queda libre y se gasta en un solo eje: unidad
   académica determinada (--serie-1) o no determinada (--sin-dato con trama,
   por esSinDato(), la misma prueba que usan las barras). El gris no lo decide
   C-05: lo decide la misma función que en el resto del sitio (D-09).

   ESTADO: C-05 se publicó el 2026-08-26 (T-10), en `colaboracion.html`. Estas
   funciones sólo dibujan, no calculan: el grafo lo construye
   `web/assets/js/grafo.js` en el navegador (recorte en vivo, puerto
   verificado línea a línea contra `src/build/grafo_coautoria.py`) o el mismo
   `grafo.js` bajo Node en el prerenderizado — nunca esta primitiva.

   ENTRADA de disponerRed(): nodos con `com` YA asignado. La detección de
   comunidades es de quien arma el grafo (grafo.js o grafo_coautoria.py), no
   del renderizador — igual que el resto de los indicadores llega calculado
   antes de dibujarse. */

/** true si la unidad de la firma es ausencia de dato, no una unidad real.
    Se prueba sobre `unidad ?? 'No determinada'` porque el contrato admite que
    el pipeline mande esa cadena en vez de null, y una comprobación de
    veracidad la tomaría por unidad real. */
export const sinUnidadRed = e => esSinDato(e.unidad ?? 'No determinada');

const rellenoNodoRed = e =>
  (sinUnidadRed(e) ? 'url(#tramaSinDatoRed)' : 'var(--serie-1)');
const radioNodoRed = e =>
  (e.puente ? 3.6 + Math.min(e.grupos, 4) * 1.15 : 3.4);

/** Resuelve posiciones y métricas derivadas de un grafo ya construido.

    `nodos`: [{ i, id, valor, n, unidad, com }] — `com` viene del build.
    `E`:     [{ a, b, n }] con a y b índices en `nodos`. No dirigida.

    Devuelve el mismo objeto que consumen las tres formas de red(). */
export function disponerRed(nodos, E) {
  const ents = nodos;
  ents.forEach(e => { e.vec = new Set(); e.comsVec = new Set(); });
  E.forEach(a => { ents[a.a].vec.add(a.b); ents[a.b].vec.add(a.a); });
  ents.forEach(e => {
    e.grado = e.vec.size;
    e.vec.forEach(v => e.comsVec.add(ents[v].com));
    e.grupos = e.comsVec.size;
    e.puente = e.grupos >= 2;
  });
  const con = ents.filter(e => e.grado > 0), ais = ents.filter(e => e.grado === 0);
  const W = 1000, HRED = 545;
  const porCom = {}; con.forEach(e => { (porCom[e.com] = porCom[e.com] || []).push(e); });
  /* El cúmulo se dimensiona ANTES que la órbita, y la órbita se deriva de él.
     Al revés —órbita fija, cúmulo libre— los grupos se solapaban. */
  const SEP = 9.2, radios = {};
  const grandes = Object.keys(porCom).map(Number).sort((x, y) => porCom[y].length - porCom[x].length);
  grandes.forEach(c => { radios[c] = SEP * Math.sqrt(porCom[c].length) + 6; });
  /* Alternar grande/pequeño alrededor del círculo reparte la presión: dos
     cúmulos grandes contiguos obligarían a una órbita mucho mayor. */
  const claves = []; let lo = 0, hi = grandes.length - 1;
  while (lo <= hi) { claves.push(grandes[lo++]); if (lo <= hi) claves.push(grandes[hi--]); }
  const K = claves.length, GAP = 22, COMP = .82;
  let R = 0;
  for (let k = 0; k < K; k++) {
    const need = radios[claves[k]] + radios[claves[(k + 1) % K]] + GAP;
    R = Math.max(R, need / (2 * Math.sin(Math.PI / K) * COMP));
  }
  const cx = W / 2, cy = HRED / 2, centros = {};
  claves.forEach((c, k) => {
    const ang = (k / K) * Math.PI * 2 - Math.PI / 2;
    centros[c] = { x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R * COMP };
  });
  claves.forEach(c => {
    const ct = centros[c];
    porCom[c].slice().sort((p, q) => q.grado - p.grado).forEach((e, k) => {
      const t = k * 2.399963, rr = SEP * Math.sqrt(k + .55);
      e.x = ct.x + Math.cos(t) * rr; e.y = ct.y + Math.sin(t) * rr * .9;
    });
  });
  // Las firmas puente se tiran hacia el espacio entre los grupos que conectan,
  // que es literalmente donde su trabajo ocurre.
  con.filter(e => e.puente).forEach(e => {
    let sx = 0, sy = 0, n = 0;
    e.comsVec.forEach(c => { if (centros[c]) { sx += centros[c].x; sy += centros[c].y; n++; } });
    if (n > 1) { const f = .34 + Math.min(e.grupos, 4) * .05; e.x += (sx / n - e.x) * f; e.y += (sy / n - e.y) * f; }
  });
  /* Encajar el dibujo entero en el lienzo, sin recortar posiciones: recortar
     aplastaría los cúmulos del borde contra el marco y falsearía la lectura.
     Escala independiente en X e Y: la posición aquí es topológica, no métrica,
     así que estirar a lo ancho no miente sobre ninguna distancia. */
  const PAD = 26;
  const xs = con.map(e => e.x), ys = con.map(e => e.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const escX = (W - PAD * 2) / Math.max(x1 - x0, 1), escY = (HRED - PAD * 2) / Math.max(y1 - y0, 1);
  const esc = Math.min(escX, escY);
  const dx = PAD - x0 * escX, dy = PAD - y0 * escY;
  con.forEach(e => { e.x = e.x * escX + dx; e.y = e.y * escY + dy; });
  claves.forEach(c => { const ct = centros[c]; ct.x = ct.x * escX + dx; ct.y = ct.y * escY + dy; radios[c] *= esc; });
  /* Descolisión DESPUÉS de encajar: el radio dibujado de un puente no encoge
     con el lienzo, así que separarlos antes de escalar no serviría de nada. */
  con.forEach(e => { e.sep = (e.puente ? 3.6 + Math.min(e.grupos, 4) * 1.15 + 3.4 : 3.4) + 1.4; });
  for (let it = 0; it < 9; it++) {
    for (let i = 0; i < con.length; i++) for (let j = i + 1; j < con.length; j++) {
      const p = con[i], q = con[j], ux = q.x - p.x, uy = q.y - p.y;
      const min = p.sep + q.sep, d2 = ux * ux + uy * uy;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2), f = (min - d) / d * .48;
        p.x -= ux * f; p.y -= uy * f; q.x += ux * f; q.y += uy * f;
      }
    }
  }
  con.forEach(e => { e.x = Math.max(12, Math.min(W - 12, e.x)); e.y = Math.max(14, Math.min(HRED - 6, e.y)); });
  /* La etiqueta cuelga de la extensión REAL del cúmulo ya descolisionado, no
     de su radio teórico, que la descolisión ya invalidó. */
  claves.forEach(c => {
    const ct = centros[c];
    let alto = 0;
    porCom[c].forEach(e => { alto = Math.max(alto, ct.y - e.y); });
    ct.etq = Math.max(11, ct.y - alto - 8);
  });
  const cols = 46, paso = (W - 24) / cols;
  ais.forEach((e, k) => { e.x = 12 + (k % cols) * paso + paso / 2; e.y = 604 + Math.floor(k / cols) * 15.5; });
  /* Para matriz y arcos no basta con el grado global: una firma de grado alto
     cuyos coautores queden todos fuera del recorte dibuja una fila vacía. Se
     poda por grado INDUCIDO hasta que ninguna fila quede vacía. */
  const densos = (cupo, semilla) => {
    let cand = con.slice().sort((p, q) => q.grado - p.grado).slice(0, semilla);
    for (let pase = 0; pase < 4; pase++) {
      const dentro = new Set(cand.map(e => e.i));
      cand.forEach(e => { e.ind = 0; e.vec.forEach(v => { if (dentro.has(v)) e.ind++; }); });
      const vivos = cand.filter(e => e.ind > 0);
      if (vivos.length === cand.length) break;
      cand = vivos;
    }
    let sel = cand.sort((p, q) => q.ind - p.ind).slice(0, cupo);
    for (let pase = 0; pase < 3; pase++) {
      const dentro = new Set(sel.map(e => e.i));
      const vivos = sel.filter(e => { let n = 0; e.vec.forEach(v => { if (dentro.has(v)) n++; }); e.ind = n; return n > 0; });
      if (vivos.length === sel.length) break;
      sel = vivos;
    }
    return sel.sort((p, q) => p.com - q.com || q.ind - p.ind);
  };
  const uniN = {};
  ents.forEach(e => { const k = sinUnidadRed(e) ? '—' : e.unidad; uniN[k] = (uniN[k] || 0) + 1; });
  return {
    ents, E, con, ais, centros, claves, radios, uniN, W, HRED,
    topM: densos(46, 84), topA: densos(68, 120),
    nav: con.slice().sort((p, q) => q.grupos - p.grupos || q.grado - p.grado).slice(0, 90),
    altura: 604 + Math.ceil(ais.length / cols) * 15.5 + 14,
  };
}

/* La trama de ausencia es parte de la primitiva, no de una de sus vistas: si
   viviera dentro de una sola forma, las otras dos referenciarían un paint
   server que no existe en su propio documento y la ausencia se perdería justo
   donde la regla del segundo canal la exige. */
function defsTramaRed() {
  return `<defs><pattern id="tramaSinDatoRed" width="5" height="5"
      patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="5" height="5" fill="var(--sin-dato)"/>
    <line x1="0" y1="0" x2="0" y2="5" stroke="var(--superficie)" stroke-width="1.7"/>
  </pattern></defs>`;
}

const tipRed = e => `data-tip="${escapar(e.valor)}"`
  + ` data-tip-v="${sinUnidadRed(e) ? 'Unidad no determinada' : escapar(e.unidad)}"`
  + ` data-tip-n="${escapar((e.grado === 0 ? 'Cero coautores internos'
      : e.grado + ' coautores · ' + e.grupos + (e.grupos === 1 ? ' grupo' : ' grupos'))
      + ' · ' + e.n + (e.n === 1 ? ' publicación' : ' publicaciones'))}"`;

function svgRedNodos(D, activa, foco) {
  const hayFoco = foco != null;
  const vecinosFoco = hayFoco ? D.ents[foco].vec : null;
  const lineas = D.E.map(a => {
    const p = D.ents[a.a], q = D.ents[a.b];
    const cruza = p.com !== q.com;
    const act = activa(p) && activa(q);
    const enFoco = hayFoco && (a.a === foco || a.b === foco);
    let op = act ? (cruza ? .55 : .32) : .07;
    if (hayFoco) op = enFoco ? .95 : .05;
    return `<line class="vinculo" data-a="${a.a}" data-b="${a.b}"
      x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}"
      x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}"
      stroke="${enFoco ? 'var(--tinta)' : (cruza ? 'var(--tinta-3)' : 'var(--eje)')}"
      stroke-width="${enFoco ? 1.5 : (cruza ? .9 : .7)}" opacity="${op}"/>`;
  }).join('');
  // Los primeros D.nav.length nodos (los de mayor grado, tope 90 — ver
  // disponerRed) son los únicos que entran a la tabulación giratoria: son el
  // conjunto que pasoTecladoRed()/la interacción cliente recorren con
  // flechas. Un nodo fuera de ese tope sigue siendo clicable con mouse y
  // legible por tooltip, pero no suma una parada de Tab más — el mismo
  // criterio que ya evitó "veinte pulsaciones de Tab" en las barras.
  const ordenNav = D.nav.map(e => e.i);
  const nodos = D.con.map(e => {
    const act = activa(e);
    const enFoco = hayFoco && (e.i === foco || vecinosFoco.has(e.i));
    let op = act ? 1 : .16; if (hayFoco) op = enFoco ? 1 : .12;
    const esF = e.i === foco;
    const anillo = e.puente
      ? `<circle r="${(radioNodoRed(e) + 2.6).toFixed(2)}" fill="none" stroke="var(--tinta)" stroke-width="1.15" opacity=".75"/>` : '';
    const kNav = ordenNav.indexOf(e.i);
    const tab = kNav === -1 ? '' : ` tabindex="${kNav === 0 ? 0 : -1}"`;
    return `<g class="nodo-red" data-red-nodo="${e.i}" data-vecinos="${[...e.vec].join(',')}"
        role="button"${tab} ${tipRed(e)}
        transform="translate(${e.x.toFixed(1)},${e.y.toFixed(1)})" opacity="${op}">
      ${anillo}<circle class="marca-nodo" r="${radioNodoRed(e)}" fill="${rellenoNodoRed(e)}"
        stroke="${esF ? 'var(--accion-viva)' : (sinUnidadRed(e) ? 'var(--tinta-3)' : 'var(--superficie)')}"
        stroke-width="${esF ? 2.6 : (sinUnidadRed(e) ? 1.1 : .9)}"/>
    </g>`;
  }).join('');
  const cuadros = D.ais.map(e => {
    const act = activa(e);
    let op = act ? .95 : .16; if (hayFoco) op = .12;
    const r = 3.1, sin = sinUnidadRed(e);
    return `<g class="nodo-red" ${tipRed(e)}
        transform="translate(${e.x.toFixed(1)},${e.y.toFixed(1)})" opacity="${op}">
      <rect x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}"
        fill="${sin ? 'url(#tramaSinDatoRed)' : 'none'}"
        stroke="${sin ? 'var(--tinta-3)' : 'var(--serie-1)'}" stroke-width="1.3" opacity="${sin ? .85 : 1}"/>
    </g>`;
  }).join('');
  const etiquetas = D.claves.map(c => {
    const ct = D.centros[c], txt = 'Grupo ' + (c + 1), an = txt.length * 5.9 + 12, y = ct.etq || ct.y;
    return `<g opacity="${hayFoco ? .28 : 1}">
      <rect x="${(ct.x - an / 2).toFixed(1)}" y="${(y - 9).toFixed(1)}" width="${an.toFixed(1)}"
        height="13" rx="2" fill="var(--superficie)" opacity=".82"/>
      <text class="etiqueta-grupo" x="${ct.x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${escapar(txt)}</text>
    </g>`;
  }).join('');
  // Las firmas sin ningún coautor interno son un dato real, no una ausencia:
  // van separadas por una línea y rotuladas, nunca omitidas.
  const sep = `<g>
    <line x1="0" y1="578" x2="${D.W}" y2="578" stroke="var(--linea)" stroke-width="1"/>
    <text class="aislados-titulo" x="0" y="594">${D.ais.length} firmas con cero coautores internos — dato real, no ausencia</text>
  </g>`;
  return `<div class="grafico"><svg class="chart red-svg${hayFoco ? ' hay-foco' : ''}"
      viewBox="0 0 ${D.W} ${Math.round(D.altura)}" role="img" data-nav="${ordenNav.join(',')}"
      aria-label="Red de coautoría interna: ${D.con.length} firmas conectadas en ${D.claves.length} grupos, ${D.ais.length} sin coautoría interna. Cada firma es un nodo enfocable con el tabulador y las flechas; Intro fija el foco en ella y sus coautores, Escape lo suelta. Tabla equivalente debajo.">
    ${defsTramaRed()}${lineas}${nodos}${sep}${cuadros}${etiquetas}
  </svg></div>`;
}

function svgRedMatriz(D, activa) {
  const lista = D.topM, n = lista.length;
  const M = 84, C = 15, W = M + n * C + 12;
  const idx = {}; lista.forEach((e, k) => idx[e.i] = k);
  const cel = [];
  D.E.forEach(a => {
    const p = idx[a.a], q = idx[a.b];
    if (p == null || q == null) return;
    const act = activa(D.ents[a.a]) && activa(D.ents[a.b]);
    const cruza = D.ents[a.a].com !== D.ents[a.b].com;
    [[p, q], [q, p]].forEach(([r, c2]) => cel.push(`<rect x="${M + c2 * C + 1}" y="${M + r * C + 1}"
      width="${C - 2}" height="${C - 2}" rx="1.5" fill="var(--serie-1)"
      opacity="${act ? Math.min(.35 + a.n * .3, 1) : .1}"
      stroke="${cruza ? 'var(--tinta)' : 'none'}" stroke-width="${cruza ? .9 : 0}"/>`));
  });
  const rejilla = [];
  for (let k = 0; k <= n; k++) {
    rejilla.push(`<line x1="${M + k * C}" y1="${M}" x2="${M + k * C}" y2="${M + n * C}" stroke="var(--red)" stroke-width="1"/>`);
    rejilla.push(`<line x1="${M}" y1="${M + k * C}" x2="${M + n * C}" y2="${M + k * C}" stroke="var(--red)" stroke-width="1"/>`);
  }
  let prev = null;
  lista.forEach((e, k) => {
    if (prev !== null && e.com !== prev) {
      rejilla.push(`<line x1="${M + k * C}" y1="${M - 6}" x2="${M + k * C}" y2="${M + n * C}" stroke="var(--linea-fuerte)" stroke-width="1.4"/>`);
      rejilla.push(`<line x1="${M - 6}" y1="${M + k * C}" x2="${M + n * C}" y2="${M + k * C}" stroke="var(--linea-fuerte)" stroke-width="1.4"/>`);
    }
    prev = e.com;
  });
  const etq = [];
  lista.forEach((e, k) => {
    const act = activa(e), sin = sinUnidadRed(e);
    const clase = 'etiqueta-firma' + (sin ? ' sin-unidad' : '');
    const txt = escapar(e.id) + (sin ? ' ·' : '');
    etq.push(`<text class="${clase}" x="${M - 7}" y="${M + k * C + C / 2 + 3.4}" text-anchor="end" opacity="${act ? 1 : .32}">${txt}</text>`);
    etq.push(`<text class="${clase}" x="${M + k * C + C / 2}" y="${M - 7}"
      transform="rotate(-90 ${M + k * C + C / 2} ${M - 7})" text-anchor="start" opacity="${act ? 1 : .32}">${txt}</text>`);
  });
  return `<div class="grafico"><svg class="chart red-svg" viewBox="0 0 ${W} ${W}" role="img"
      aria-label="Matriz de adyacencia de las ${n} firmas de mayor grado, ordenada por grupo. Los bloques en la diagonal son los grupos; las celdas con contorno son vínculos entre grupos distintos.">
    ${defsTramaRed()}${rejilla.join('')}${cel.join('')}${etq.join('')}
  </svg></div>`;
}

function svgRedArcos(D, activa) {
  const lista = D.topA, n = lista.length;
  const W = 1000, H = 340, base = 292, pad = 26;
  const paso = (W - pad * 2) / Math.max(n - 1, 1);
  const idx = {}; lista.forEach((e, k) => idx[e.i] = k);
  const arcos = [];
  D.E.forEach(a => {
    const p = idx[a.a], q = idx[a.b];
    if (p == null || q == null) return;
    const x1 = pad + Math.min(p, q) * paso, x2 = pad + Math.max(p, q) * paso;
    const r = (x2 - x1) / 2;
    const cruza = D.ents[a.a].com !== D.ents[a.b].com;
    const act = activa(D.ents[a.a]) && activa(D.ents[a.b]);
    arcos.push(`<path d="M ${x1} ${base} A ${r} ${Math.min(r * 1.15, 250)} 0 0 1 ${x2} ${base}"
      fill="none" stroke="${cruza ? 'var(--tinta-2)' : 'var(--eje)'}"
      stroke-width="${cruza ? 1.25 : .8}" opacity="${act ? (cruza ? .72 : .38) : .07}"/>`);
  });
  const marcas = [], etq = [];
  let prev = null;
  lista.forEach((e, k) => {
    const x = pad + k * paso, act = activa(e);
    if (prev !== null && e.com !== prev) marcas.push(`<line x1="${x - paso / 2}" y1="${base - 4}" x2="${x - paso / 2}" y2="${base + 40}" stroke="var(--linea-fuerte)" stroke-width="1.2"/>`);
    prev = e.com;
    if (e.puente) marcas.push(`<circle cx="${x}" cy="${base}" r="${(radioNodoRed(e) + 2.4).toFixed(2)}" fill="none" stroke="var(--tinta)" stroke-width="1.1" opacity="${act ? .75 : .12}"/>`);
    marcas.push(`<circle cx="${x}" cy="${base}" r="${radioNodoRed(e)}" fill="${rellenoNodoRed(e)}" stroke="${sinUnidadRed(e) ? 'var(--tinta-3)' : 'var(--superficie)'}" stroke-width="${sinUnidadRed(e) ? 1.1 : .9}" opacity="${act ? 1 : .16}"/>`);
    etq.push(`<text class="etiqueta-firma${sinUnidadRed(e) ? ' sin-unidad' : ''}" x="${x}" y="${base + 12}"
      transform="rotate(90 ${x} ${base + 12})" text-anchor="start" opacity="${act ? 1 : .3}">${escapar(e.id)}</text>`);
  });
  return `<div class="grafico"><svg class="chart red-svg" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Diagrama de arcos: ${n} firmas de mayor grado ordenadas por grupo. Los arcos largos que cruzan las divisiones son la coautoría entre grupos distintos.">
    ${defsTramaRed()}<line x1="${pad - 10}" y1="${base}" x2="${W - pad + 10}" y2="${base}" stroke="var(--eje)" stroke-width="1"/>${arcos.join('')}${marcas.join('')}${etq.join('')}
  </svg></div>`;
}

/** Dibuja la red en una de sus tres formas.

    `activa(e)` decide si una firma pasa el filtro vigente. Filtrar ATENÚA, no
    oculta ni reordena: así ninguna marca cambia de color ni de sitio al
    filtrar, que es la misma regla que rige las barras.
    `foco` es el índice de la firma fijada por clic o teclado, o null.

    Tres formas para el mismo dato porque la maraña de nodos esconde vínculos
    cuando el grafo crece: la matriz no puede solapar y los arcos ordenan por
    grupo. No son tres gráficos distintos, son tres lecturas del mismo. */
export function red(D, forma, activa = () => true, foco = null) {
  if (forma === 'matriz') return svgRedMatriz(D, activa);
  if (forma === 'arcos') return svgRedArcos(D, activa);
  return svgRedNodos(D, activa, foco);
}

/* ═══════════════════════ formas elegidas por la RELACIÓN del dato

   Hasta esta revisión el sitio dibujaba 11 de sus 16 indicadores con
   `barrasH`. No era una preferencia estética: era la forma por defecto
   aplicándose a relaciones de datos distintas. El Visual Vocabulary del
   Financial Times (Financial-Times/chart-doctor) clasifica los gráficos por
   la RELACIÓN que expresan, y cuatro de los indicadores del sitio estaban en
   la categoría equivocada:

     I-04  FWCI contra el 1,00 mundial   -> Desviación, no magnitud
     I-05  umbrales de percentil anidados -> Distribución acumulada, no ranking
     C-06  autores por publicación        -> Distribución, no ranking
     R-01  cuartiles Q1–Q4 del total      -> Parte-de-un-todo, no magnitud

   Las cuatro primitivas de abajo cubren esas cuatro relaciones. Ninguna es
   decorativa: cada una existe porque la anterior afirmaba algo falso sobre
   la estructura del dato. */

/** DESVIACIÓN — valores contra una referencia fija (FT: «Deviation»).

    Para I-04: el FWCI se lee contra el 1,00 mundial. Dibujarlo como columnas
    desde cero obliga a comparar alturas contra una línea punteada; dibujarlo
    como desviación pone el 1,00 en el eje y el déficit o el superávit se lee
    como lo que es, sin aritmética mental. */
export function desviacion(datos, {
  referencia = 1, etiquetaX = 'anio', etiquetaY = 'valor', decimales = 2,
  ancho = 680, alto = 260, titulo = '', refEtiqueta = '',
} = {}) {
  if (!datos.length) return '<p class="vacio">Sin datos para mostrar.</p>';
  const mIzq = 58, mDer = 20, mAb = 40, mArr = 30;
  const vals = datos.map(d => d[etiquetaY]).filter(v => v !== null && v !== undefined);
  const desv = vals.map(v => v - referencia);
  const tope = Math.max(...desv.map(Math.abs), 0.01) * 1.25;
  const base = alto - mAb, arriba = mArr;
  const cero = arriba + (base - arriba) / 2;          // la referencia va al centro
  const y = d => cero - (d / tope) * ((base - arriba) / 2);
  const bw = (ancho - mIzq - mDer) / datos.length;
  const w = Math.min(56, bw * 0.5);

  const marcasY = [tope, 0, -tope].map(v => `
    <line class="red" x1="${mIzq}" x2="${ancho - mDer}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="tick" x="${mIzq - 8}" y="${y(v) + 3.5}" text-anchor="end">${
      v === 0 ? num(referencia, decimales) : (v > 0 ? '+' : '−') + num(Math.abs(v), decimales)}</text>`).join('');

  const barras = datos.map((d, i) => {
    const v = d[etiquetaY];
    const x = mIzq + i * bw + (bw - w) / 2;
    if (v === null || v === undefined) {
      return `<g class="marca" data-k="${escapar(String(d[etiquetaX]))}" role="listitem" aria-label="${escapar(String(d[etiquetaX]))}: sin dato">
        <text class="tick" x="${x + w / 2}" y="${cero - 8}" text-anchor="middle">sin dato</text>
        <text x="${x + w / 2}" y="${base + 18}" text-anchor="middle">${escapar(String(d[etiquetaX]))}</text></g>`;
    }
    const dv = v - referencia, yy = y(Math.max(dv, 0)), h = Math.abs(y(dv) - cero);
    const bajo = dv < 0;
    return `<g class="marca" data-k="${escapar(String(d[etiquetaX]))}" tabindex="${i ? -1 : 0}" role="listitem"
        aria-label="${escapar(String(d[etiquetaX]))}: ${num(v, decimales)}, ${
          bajo ? 'por debajo de' : 'por encima de'} la referencia ${num(referencia, decimales)}"
        data-tip="${escapar(String(d[etiquetaX]))}" data-tip-v="${num(v, decimales)}"
        data-tip-n="${bajo ? '−' : '+'}${num(Math.abs(dv), decimales)} respecto de ${num(referencia, decimales)}">
      <rect class="barra ${bajo ? 'deficit' : 'superavit'}" x="${x}" y="${yy}"
        width="${w}" height="${Math.max(2, h)}" rx="3"/>
      <text class="valor" x="${x + w / 2}" y="${bajo ? y(dv) + 16 : yy - 7}" text-anchor="middle">${num(v, decimales)}</text>
      <text x="${x + w / 2}" y="${base + 18}" text-anchor="middle">${escapar(String(d[etiquetaX]))}</text>
    </g>`;
  }).join('');

  const etq = titulo ? `${titulo} — desviación respecto de ${num(referencia, decimales)}, ${datos.length} valores`
                     : `Gráfico de desviación, ${datos.length} valores`;
  return `<div class="grafico"><svg class="chart" viewBox="0 0 ${ancho} ${alto}"
    role="list" aria-label="${escapar(etq)}">
    ${marcasY}${barras}
    <line class="ref" x1="${mIzq}" x2="${ancho - mDer}" y1="${cero}" y2="${cero}"/>
    <text class="ref-etq" x="${ancho - mDer}" y="${cero - 8}" text-anchor="end">${
      escapar(refEtiqueta || `referencia ${num(referencia, decimales)}`)}</text>
  </svg></div>`;
}

/** DISTRIBUCIÓN ACUMULADA — umbrales anidados (FT: «Distribution»).

    Para I-05. Los tramos son ACUMULADOS: las 11 publicaciones del top 1 % están
    también en el top 5 %, en el top 10 % y en el top 25 %. Dibujarlos como
    cuatro barras hermanas sugiere cuatro grupos disjuntos que podrían sumarse
    —524, una cifra sin significado—. Aquí cada tramo se dibuja CONTENIDO en el
    siguiente, que es la relación real. */
export function acumulada(datos, { titulo = '', total = null, ancho = 680, sufijo = '' } = {}) {
  if (!datos.length) return '<p class="vacio">Sin datos para mostrar.</p>';
  const orden = datos.slice().sort((a, b) => a.n - b.n);
  const max = total || Math.max(...orden.map(d => d.n));
  const alto = 46 + orden.length * 44;
  const mIzq = 96, mDer = 78;
  const pista = ancho - mIzq - mDer;

  const filas = orden.map((d, i) => {
    const y = 30 + i * 44;
    const w = Math.max(3, pista * (d.n / max));
    const cuota = total ? ` · ${num(100 * d.n / total, 1)} % de ${nf.format(total)}` : '';
    return `<g class="marca" tabindex="${i ? -1 : 0}" role="listitem"
        aria-label="${escapar(d.valor)}: ${nf.format(d.n)}${sufijo}${cuota}"
        data-tip="${escapar(d.valor)}" data-tip-v="${nf.format(d.n)}${sufijo}"
        ${total ? `data-tip-n="${num(100 * d.n / total, 1)} % de ${nf.format(total)}"` : ''}>
      <text x="${mIzq - 12}" y="${y + 21}" text-anchor="end">${escapar(d.valor)}</text>
      <rect class="acum-pista" x="${mIzq}" y="${y + 6}" width="${pista}" height="26" rx="3"/>
      <rect class="barra" x="${mIzq}" y="${y + 6}" width="${w}" height="26" rx="3"/>
      <text class="valor" x="${mIzq + w + 9}" y="${y + 24}">${nf.format(d.n)}${sufijo}</text>
    </g>`;
  }).join('');

  // Las llaves de anidamiento: cada tramo cabe dentro del siguiente.
  const llaves = orden.slice(0, -1).map((d, i) => {
    const y = 30 + i * 44, w = Math.max(3, pista * (d.n / max));
    return `<path class="acum-nido" d="M ${mIzq + w} ${y + 32} L ${mIzq + w} ${y + 44}" />`;
  }).join('');

  const etq = titulo ? `${titulo} — tramos acumulados anidados, ${orden.length} umbrales`
                     : `Gráfico de tramos acumulados, ${orden.length} umbrales`;
  return `<div class="grafico"><svg class="chart" viewBox="0 0 ${ancho} ${alto}"
    role="list" aria-label="${escapar(etq)}">
    <text class="tick" x="${mIzq}" y="18">cada tramo CONTIENE a los de arriba — no se suman</text>
    ${llaves}${filas}
  </svg></div>`;
}

/** DISTRIBUCIÓN — cuántos casos caen en cada tramo (FT: «Distribution»).

    Para C-06. El tamaño del equipo es un continuo tramificado: 1, 2–3, 4–6…
    Dibujarlo como ranking ordena los tramos por frecuencia y destruye el eje,
    que es justo la información. Aquí los tramos conservan su orden natural y
    la altura dice la frecuencia. */
export function distribucion(datos, { titulo = '', ancho = 680, alto = 250, etiquetaEje = '' } = {}) {
  if (!datos.length) return '<p class="vacio">Sin datos para mostrar.</p>';
  const mIzq = 52, mDer = 16, mAb = 52, mArr = 26;
  const max = Math.max(...datos.map(d => d.n), 1) * 1.18;
  const base = alto - mAb;
  const bw = (ancho - mIzq - mDer) / datos.length;
  const y = v => mArr + (base - mArr) * (1 - v / max);
  const total = datos.reduce((s, d) => s + d.n, 0);

  const red = [0, max / 2, max].map(v => `
    <line class="red" x1="${mIzq}" x2="${ancho - mDer}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="tick" x="${mIzq - 8}" y="${y(v) + 3.5}" text-anchor="end">${v === 0 ? '0' : num(v, 0)}</text>`).join('');

  // Sin hueco entre columnas: es una distribución sobre un continuo, y el
  // hueco de un gráfico de barras sugiere categorías sin relación entre sí.
  const cols = datos.map((d, i) => {
    const x = mIzq + i * bw, yy = y(d.n);
    return `<g class="marca" data-k="${escapar(String(d.valor))}" tabindex="${i ? -1 : 0}" role="listitem"
        aria-label="${escapar(d.valor)}: ${nf.format(d.n)} publicaciones, ${num(100 * d.n / total, 1)} %"
        data-tip="${escapar(d.valor)}" data-tip-v="${nf.format(d.n)}"
        data-tip-n="${num(100 * d.n / total, 1)} % de ${nf.format(total)}">
      <rect class="barra" x="${x + 0.5}" y="${yy}" width="${bw - 1}" height="${Math.max(2, base - yy)}"/>
      <text class="valor" x="${x + bw / 2}" y="${yy - 7}" text-anchor="middle">${nf.format(d.n)}</text>
      <text x="${x + bw / 2}" y="${base + 18}" text-anchor="middle">${escapar(d.valor)}</text>
    </g>`;
  }).join('');

  const eje = etiquetaEje
    ? `<text class="tick" x="${mIzq + (ancho - mIzq - mDer) / 2}" y="${alto - 10}" text-anchor="middle">${escapar(etiquetaEje)}</text>` : '';
  const etq = titulo ? `${titulo} — distribución en ${datos.length} tramos`
                     : `Distribución en ${datos.length} tramos`;
  // `completas`: cada columna rotula su tramo y su recuento. Ver `barrasH`.
  return `<div class="grafico"><svg class="chart" viewBox="0 0 ${ancho} ${alto}"
    data-cifras="completas" role="list" aria-label="${escapar(etq)}">
    ${red}${cols}${eje}
    <line class="eje" x1="${mIzq}" x2="${ancho - mDer}" y1="${base}" y2="${base}"/>
  </svg></div>`;
}

/** PARTE-DE-UN-TODO ordenado (FT: «Part-to-whole»).

    Para R-01. Q1–Q4 más la ausencia reparten un total conocido. Cuatro barras
    sueltas obligan a sumar de cabeza para saber qué fracción es Q1; una barra
    proporcional lo muestra. Usa la rampa ordinal —un solo tono en cuatro
    pasos— porque Q1 y Q4 son posiciones de una escala, no categorías sueltas;
    la ausencia se sale de la rampa y va en gris con trama. */
export function proporcional(datos, { titulo = '', ancho = 680, alto = 128 } = {}) {
  if (!datos.length) return '<p class="vacio">Sin datos para mostrar.</p>';
  const total = datos.reduce((s, d) => s + d.n, 0) || 1;
  const h = 42, y0 = 16;
  let x = 0;
  const idOrd = `ordTrama${++idGrafico}`;

  const seg = datos.map((d, i) => {
    const w = (ancho * d.n) / total;
    const xi = x; x += w;
    const sd = esSinDato(d.valor);
    const relleno = sd ? `url(#${idOrd})` : ORDINAL[Math.min(i, ORDINAL.length - 1)];
    const pct = num(100 * d.n / total, 1);
    return `<g class="marca" data-k="${escapar(String(d.valor))}" tabindex="${i ? -1 : 0}" role="listitem"
        aria-label="${escapar(d.valor)}: ${nf.format(d.n)}, ${pct} % del total"
        data-tip="${escapar(d.valor)}" data-tip-v="${nf.format(d.n)}" data-tip-n="${pct} % de ${nf.format(total)}">
      <rect class="segmento" x="${xi.toFixed(1)}" y="${y0}" width="${Math.max(w - 1.5, 1).toFixed(1)}" height="${h}"
        fill="${relleno}"${sd ? ' stroke="var(--sin-dato)" stroke-width="1"' : ''}/>
      ${w > 46 ? `<text class="seg-pct" x="${(xi + w / 2).toFixed(1)}" y="${y0 + h / 2 + 4}" text-anchor="middle">${pct} %</text>` : ''}
    </g>`;
  }).join('');

  const leyenda = datos.map((d, i) => {
    const sd = esSinDato(d.valor);
    return `<span class="seg-leyenda"><span class="punto" style="background:${
      sd ? 'var(--sin-dato)' : ORDINAL[Math.min(i, ORDINAL.length - 1)]}"></span>${
      escapar(d.valor)} <strong>${nf.format(d.n)}</strong></span>`;
  }).join('');

  const etq = titulo ? `${titulo} — barra proporcional de ${datos.length} tramos sobre ${nf.format(total)}`
                     : `Barra proporcional de ${datos.length} tramos`;
  return `<div class="grafico"><svg class="chart" viewBox="0 0 ${ancho} ${alto - 40}"
    role="list" aria-label="${escapar(etq)}" preserveAspectRatio="none" style="height:74px">
    <defs><pattern id="${idOrd}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="var(--sin-dato)"/>
      <line x1="0" y1="0" x2="0" y2="5" stroke="var(--superficie)" stroke-width="1.7"/></pattern></defs>
    ${seg}
  </svg><div class="leyenda leyenda-seg">${leyenda}</div></div>`;
}

/* ------------------------------------------------------ tooltip común */

/* Un gráfico HTML es interactivo por naturaleza: `<title>` sólo aparece tras
   una pausa larga del puntero y no existe por teclado. Este panel responde a
   ambos. Se instala una vez por página y sirve a todas las marcas. */
export function montarTooltip() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  let activa = null;

  /* Resaltar es atenuar el resto. Señalar una barra sin apagar las demás no
     dirige la mirada: sólo añade un borde que hay que buscar. La atenuación se
     aplica en el SVG que contiene la marca, no en la página, para que dos
     gráficos de la misma pantalla no se interfieran. */
  const resaltar = (m) => {
    if (activa === m) return;
    apagar();
    activa = m;
    m.classList.add('activa');
    m.ownerSVGElement?.classList.add('hay-foco');
  };
  const apagar = () => {
    if (!activa) return;
    activa.classList.remove('activa');
    activa.ownerSVGElement?.classList.remove('hay-foco');
    activa = null;
  };

  const mostrar = (el, x, y) => {
    resaltar(el);
    // `dataset.tip` ya viene decodificado por el parser HTML: reinyectarlo con
    // innerHTML anula el escape que se hizo al escribir el atributo. textContent
    // no interpreta marcado, así que el dato vuelve a quedar inerte.
    tip.replaceChildren();
    const spanTip = document.createElement('span');
    spanTip.className = 'tip-t';
    spanTip.textContent = el.dataset.tip;
    tip.append(spanTip);
    const spanValor = document.createElement('span');
    spanValor.className = 'tip-v';
    spanValor.textContent = el.dataset.tipV;
    tip.append(spanValor);
    if (el.dataset.tipN) {
      const spanN = document.createElement('span');
      spanN.className = 'tip-n';
      spanN.textContent = el.dataset.tipN;
      tip.append(spanN);
    }
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    // Se coloca arriba a la derecha del puntero, y salta abajo o a la izquierda
    // cuando no cabe: un tooltip recortado por el borde no informa de nada.
    const izq = Math.min(Math.max(8, x + 14), window.innerWidth - r.width - 10);
    const arr = y - r.height - 12 < 8 ? y + 20 : y - r.height - 12;
    tip.style.left = `${izq}px`;
    tip.style.top = `${arr}px`;
  };
  const ocultar = () => { tip.hidden = true; apagar(); };

  document.addEventListener('pointermove', e => {
    const m = e.target.closest?.('[data-tip]');
    if (m) mostrar(m, e.clientX, e.clientY); else ocultar();
  });
  document.addEventListener('pointerleave', ocultar);
  document.addEventListener('focusin', e => {
    const m = e.target.closest?.('[data-tip]');
    if (m) { const r = m.getBoundingClientRect(); mostrar(m, r.right, r.bottom); }
    else ocultar();
  });
  document.addEventListener('focusout', ocultar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ocultar(); });
}

/** Tabla de datos equivalente: los gráficos no pueden ser la única vía.

    Los portales de análisis bibliométrico serios ofrecen la misma serie en más
    de una representación y dejan elegir —el Leiden Ranking alterna lista,
    dispersión y mapa— porque la figura resume y la tabla es la que se cita.
    Aquí la tabla no está escondida detrás de un desplegable: es la segunda
    vista del módulo, al mismo nivel que el gráfico.

    La columna `esperado` sólo aparece cuando el indicador la trae. Es la que
    convierte un recuento en un juicio: 75 publicaciones en el top 10 % no dice
    nada hasta que al lado está lo que cabría esperar. */
export function tablaEquivalente(datos, col = 'valor') {
  const hayEsperado = datos.some(d => d.esperado != null);
  const filas = datos.map(d => {
    const etiqueta = String(d[col] ?? d.anio);
    const v = d.n ?? d.valor;
    const esp = d.esperado == null ? ''
      : `<td class="num">${nf.format(d.esperado)}</td>
         <td class="num ${d.n >= d.esperado ? 'sobre' : 'bajo'}">${
           d.n >= d.esperado ? '+' : '−'}${nf.format(Math.abs(d.n - d.esperado))}</td>`;
    return `<tr><td${esSinDato(etiqueta) ? ' class="sin-dato-txt"' : ''}>${escapar(etiqueta)}</td>
      <td class="num">${typeof v === 'number' ? nf.format(v) : escapar(String(v))}</td>
      ${hayEsperado && !esp ? '<td class="num">—</td><td class="num">—</td>' : esp}</tr>`;
  }).join('');
  const cab = hayEsperado
    ? '<th scope="col">Categoría</th><th scope="col" class="num">Observado</th>'
      + '<th scope="col" class="num">Esperado</th><th scope="col" class="num">Diferencia</th>'
    : '<th scope="col">Categoría</th><th scope="col" class="num">n</th>';
  return `<div class="tabla-envoltura tabla-datos"><table>
    <thead><tr>${cab}</tr></thead><tbody>${filas}</tbody></table></div>`;
}

export function mostrarError(contenedor, err) {
  contenedor.innerHTML = `<div class="error"><p><strong>No se pudieron cargar los datos.</strong></p>
    <p>${escapar(err.message)}</p>
    <button class="boton" onclick="location.reload()">Reintentar</button></div>`;
}

export function debounce(fn, ms = 250) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
