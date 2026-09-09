/* vista_explorador.js — el marcado del explorador. Sin DOM, como vista.js.

   Todo lo de aquí es una función de datos a cadena, para que el mismo código
   produzca el HTML en el BUILD (portada sin filtrar, legible sin JavaScript) y
   en el NAVEGADOR (al cambiar el recorte). Una segunda implementación para el
   repintado es la forma segura de que las dos versiones acaben divergiendo. */

import * as c from './core.js';
import * as X from './explorador.js';
import * as G from './grafo.js';

/* ────────────────────────────────────────────────────────────── cabecera */

/** Cabecera compacta. La anterior ocupaba media pantalla con el título en tres
    líneas, un párrafo de cuatro y TRES cifras que el tablero repite justo
    debajo. En un explorador eso es ruido dos veces: gasta la pantalla que le
    toca al dato y enseña una cifra del total mientras el lector mira un
    recorte, que es la manera de que se lea la que no es.

    Queda el nombre, la procedencia —que no es decorativa: dice de dónde salen
    las cifras— y la explicación detrás de un control. */
export function cabecera(meta) {
  const v = meta.ventana || {};
  return `<div class="portada-id">
    <h1>Informe bibliométrico</h1>
    <p class="portada-sub">${c.escapar(meta.institucion || 'Universidad Finis Terrae')}
      · Scopus y SciVal · ${c.escapar(String(v.inicio ?? ''))}–${c.escapar(String(v.fin ?? ''))}</p>
    <p class="ventana-cierre">La ventana de este informe termina en
      <b>${c.escapar(String(v.fin ?? ''))}</b>: lo publicado después
      <b>no está aquí</b>. La fija la carga de datos, no la fecha en que usted lo lee.</p>
  </div>
  <details class="metodo portada-metodo">
    <summary>Qué mide este informe y qué no</summary>
    <div class="metodo-cuerpo">
      <p>Producción, impacto, colaboración y estructura temática de la actividad
      científica indexada en <b>Scopus</b>, con las métricas normalizadas de
      <b>SciVal</b>. No mide la actividad académica total: sólo lo que esas dos
      fuentes recogen.</p>
      <p>Cada cifra declara <b>sobre cuántas publicaciones se calcula</b>, y esa
      base cambia según el indicador: no todas las publicaciones tienen
      métricas. Por eso dos cifras de esta página pueden no cuadrar entre sí sin
      que ninguna esté mal.</p>
    </div>
  </details>`;
}

/* ───────────────────────────────────────────────────────── cifras grandes */

/* El cuarto campo es el término del glosario. La ayuda contextual vivía en los
   KPI de la portada anterior y se habría perdido al sustituirlos: aquí es más
   necesaria todavía, porque una cifra recalculada sobre un recorte se
   malinterpreta con más facilidad que una del total. */
const FICHAS = [
  ['publicaciones', 'Publicaciones',        'publicaciones en el recorte', null],
  ['citas',         'Citas recibidas',      'sobre las que tienen métricas', 'Fecha de corte'],
  ['citas_por_pub', 'Citas por publicación', 'sobre las que tienen métricas', null],
  ['fwci_mediano',  'FWCI mediano',         '1,00 = promedio mundial', 'FWCI'],
  ['internacional', 'Colaboración internacional', 'sobre las que declaran país', 'Colaboración internacional'],
  ['autores',       'Autores UFT',          'formas de firma, no personas', 'Formas de firma'],
];

function fmt(f) {
  if (f.valor === null) return '—';
  const v = c.num(f.valor, f.decimales || 0);
  // El sufijo va en su propio elemento y más pequeño. Pegado a la cifra a
  // tamaño completo, «61,6 %» se partía en dos líneas y el símbolo caía solo
  // debajo del número.
  return v + (f.sufijo ? `<span class="ficha-sufijo">${f.sufijo.trim()}</span>` : '');
}

/** La fila de cifras. Cada una lleva SU denominador pegado (D-16): son bases
    distintas y presentarlas juntas sin decirlo invita a dividir una por otra.

    Y desde el 2026-09-09, su lectura: la misma línea «Qué muestra» que las
    figuras, del mismo registro. El denominador dice SOBRE CUÁNTOS está medida
    la cifra; la lectura dice QUÉ es la cifra. Son dos cosas distintas y la
    segunda faltaba: cuatro de las seis tenían botón de glosario y dos no, y un
    botón es ayuda para quien ya sospecha que no entiende algo.

    «Citas por publicación 4,82» es el caso que lo justifica: sin una frase al
    lado, un promedio que unas pocas publicaciones muy citadas levantan para
    todas se lee como la publicación típica. */
export function cifras(res, textos) {
  const lecturas = (textos || {}).lecturas || {};
  return `<div class="tablero">${FICHAS.map(([k, etq, base, termino]) => {
    const f = res[k];
    const l = lecturas[k];
    return `<article class="ficha" data-k="${k}">
      <p class="ficha-valor" data-valor="${k}">${fmt(f)}</p>
      <h3 class="ficha-etq">${c.escapar(etq)}${termino ? c.botonAyuda(termino) : ''}</h3>
      <p class="ficha-base"><b data-base="${k}">${c.nf.format(f.base)}</b> ${c.escapar(base)}</p>
      ${l ? `<p class="ficha-lectura">${c.escapar(l.muestra)}</p>` : ''}
    </article>`;
  }).join('')}</div>`;
}

/* ─────────────────────────────────────────────────────────── el recorte */

/** La frase que dice qué se está mirando. Es obligatoria, no decorativa:
    quien llega por un enlace con filtros tiene que saber que lo que ve es un
    subconjunto, o leerá las cifras como si fueran las del total. */
export function estado(n, total, sel, { enlaceLista = false } = {}) {
  const partes = X.describir(sel);
  const filtrado = partes.length > 0;
  // El puente entre el tablero y el listado: mirando un recorte, lo siguiente
  // que se quiere es ver QUÉ publicaciones lo componen. Sin este enlace había
  // que rehacer el mismo filtro a mano en la otra página.
  const q = X.consulta(sel);
  const aLista = enlaceLista
    ? `<a class="enlace-lista" href="publicaciones.html${q ? '?' + q : ''}">Ver las ${
        c.nf.format(n)} publicaciones →</a>` : '';
  return `<p class="recorte-estado" role="status">
    <span class="recorte-n">${c.nf.format(n)}</span>
    <span class="recorte-de">de ${c.nf.format(total)} publicaciones</span>
    ${filtrado
      ? `<span class="recorte-que">${partes.map(p =>
          `<span class="recorte-chip">${c.escapar(p)}</span>`).join('')}</span>
         <button type="button" class="boton boton-limpiar" id="limpiar-recorte">Ver todo</button>`
      : `<span class="recorte-que recorte-todo">sin filtros · el informe completo</span>`}
    ${aLista}
  </p>`;
}

/* ───────────────────────────────────── salvaguardas de un informe personal */

/* Las tres advertencias que acompañan a una persona. Viven aquí, en una sola
   redacción, porque las escriben dos superficies: la ficha (`fichaAutor` en
   paginas.js) y el informe recortado a esa persona. Antes sólo existía la
   primera; copiar su texto habría creado la segunda versión de una advertencia
   metodológica, que es exactamente la clase de duplicado que ya divergió una
   vez en los paneles de eje. */

/** Cómo se lee lo que describe a una persona. Adhiere a DORA y al Manifiesto
    de Leiden, que es lo que impide leer estas cifras como una evaluación. */
export function advertenciaLectura(meta, titulo = 'Cómo leer este informe') {
  return `<div class="nota-destacada"><b>${c.escapar(titulo)}</b>
    Los indicadores describen la producción indexada en Scopus entre
    ${meta.ventana.inicio} y ${meta.ventana.fin}, con citas actualizadas al
    ${c.escapar(meta.fecha_corte_citas)}. No representan la trayectoria completa de la persona.
    Las métricas individuales sobre ventanas cortas y pocas publicaciones no son
    comparables entre personas ni deben usarse para evaluar desempeño individual.
    Este informe adhiere a los principios de DORA y del Manifiesto de Leiden.</div>`;
}

/** El umbral bajo el cual un indicador individual no es interpretable. Llega
    de `authors.json` —`parametros.n_minimo_interpretable`, que el build copia
    de `config/indicators.yml`—, que es el mismo que aplica la ficha. El
    navegador no fija un umbral propio ni lo lleva escrito en dos sitios. */
export function advertenciaMuestraReducida(umbral) {
  return `<div class="nota-destacada"><b>Muestra reducida</b>
    Con menos de ${c.nf.format(umbral)} publicaciones en la ventana, los indicadores
    de impacto no son interpretables individualmente. Se muestran por transparencia,
    no para comparación.</div>`;
}

/** Lo que un informe recortado a una persona tiene que llevar encima.

    POR QUÉ VA CON LAS CIFRAS Y NO EN LA BARRA
    Porque tiene que imprimirse. La barra de vigencia es cromo y la hoja de
    impresión retira casi todo lo que hay en ella; esto va en el cuerpo, sobre
    las cifras que califica, y por eso aparece también en la primera hoja del
    PDF descargado — que es donde hace falta, porque un PDF nominal circula sin
    el sitio al lado.

    Se muestra para las 530 entidades, no sólo para las 50 que superan el
    umbral: 480 quedan por debajo, y excluirlas de su propio informe sería
    decidir sobre esas personas en silencio en vez de declararles la
    limitación. Es la decisión del usuario del 2026-09-07. */
export function salvaguardasPersona(pubs, sel, meta, umbral) {
  const persona = X.personaDelRecorte(sel);
  if (!persona || !meta) return '';
  const n = X.publicacionesDe(pubs, persona);
  return `<section class="salvaguardas" aria-label="Cómo leer este informe">
    ${advertenciaLectura(meta)}
    ${umbral && n < umbral ? advertenciaMuestraReducida(umbral) : ''}
    <p class="nota">Recortado a <b>${c.escapar(persona)}</b>, con
      ${c.nf.format(n)} ${n === 1 ? 'publicación' : 'publicaciones'} en la ventana.
      Su identidad, su ORCID y su unidad académica —con la evidencia de cada uno—
      se declaran en su ficha:
      <a href="autores.html?q=${encodeURIComponent(persona)}">buscarla en Autores</a>.</p>
  </section>`;
}

/** Los controles. Un `details` por dimensión: sin JavaScript se abren y se
    leen igual, que es la razón de usarlo en vez de un panel montado por
    guion. La primera dimensión va abierta para que el mecanismo se vea. */
export function controles(pubs, sel, { buscador = false } = {}) {
  const busca = buscador ? `<div class="dim dim-busca">
    <label for="q">Buscar en título, fuente o autor</label>
    <input type="search" id="q" name="q" value="${c.escapar(sel.q || '')}"
      placeholder="Escriba para filtrar…" autocomplete="off">
  </div>` : '';
  return busca + `<div class="filtros-explorador">${X.DIMENSIONES.map(([clave, etiqueta], i) => {
    const cuenta = X.facetas(pubs, sel, clave);
    const elegidos = sel[clave] || [];
    const opciones = [...cuenta.entries()]
      .sort(clave === 'anio' ? (a, b) => a[0].localeCompare(b[0]) : (a, b) => b[1] - a[1]);
    return `<details class="dim" ${i === 0 || elegidos.length ? 'open' : ''}>
      <summary><span class="dim-nombre">${c.escapar(etiqueta)}</span>${
        elegidos.length ? `<span class="dim-n">${elegidos.length}</span>` : ''}</summary>
      <div class="dim-ops">${clave === 'autor'
        ? opcionesAutor(opciones, elegidos)
        : opciones.map(([valor, n]) => {
          const act = elegidos.includes(valor);
          return `<button type="button" class="chip${act ? ' chip-on' : ''}"
            data-dim="${clave}" data-valor="${c.escapar(valor)}"
            aria-pressed="${act}">${c.escapar(valor)}<span class="chip-n">${c.nf.format(n)}</span></button>`;
        }).join('')}</div>
    </details>`;
  }).join('')}</div>`;
}

/** La dimensión de persona no se dibuja como las demás.

    Quinientas treinta pastillas no son un filtro, son una guía telefónica: la
    lista deja de ser recorrible mucho antes de llegar al nombre que se busca,
    y empuja el resto del panel fuera de la pantalla. Se dibuja lo elegido
    —pastillas, que se quitan igual que cualquier otra— y un campo de búsqueda
    con `datalist`, que es autocompletado del navegador: sin librería, con
    teclado, y legible por un lector de pantalla.

    Las opciones son las del recorte vigente, no las 530 siempre: con un año o
    una unidad ya elegidos, sugerir a quien no publicó nada ahí ofrecería un
    filtro que deja la página vacía. */
function opcionesAutor(opciones, elegidos) {
  const puestas = elegidos.map(valor =>
    `<button type="button" class="chip chip-on" data-dim="autor"
      data-valor="${c.escapar(valor)}" aria-pressed="true"
      >${c.escapar(valor)}<span class="chip-n" aria-hidden="true">×</span></button>`).join('');
  const libres = opciones.filter(([valor]) => !elegidos.includes(valor));
  return `${puestas}
    <label class="solo-lectores" for="q-autor">Buscar una persona por su firma</label>
    <input type="search" id="q-autor" class="busca-autor" list="autores-sugeridos"
      placeholder="Escriba una firma…" autocomplete="off"
      aria-describedby="q-autor-ayuda">
    <datalist id="autores-sugeridos">${libres.map(([valor, n]) =>
      `<option value="${c.escapar(valor)}">${c.nf.format(n)}</option>`).join('')}</datalist>
    <p class="nota" id="q-autor-ayuda">${c.nf.format(libres.length)} firmas en este recorte.
      Son formas de firma, no personas: las que una revisión humana declaró la misma
      persona ya están fusionadas; el resto puede incluir variantes.</p>`;
}

/* ────────────────────────────────────────────────────────────── gráficos */

/* Cuatro cortes que responden al recorte. Cada uno declara su forma según la
   RELACIÓN del dato, no por costumbre: el año es una secuencia y va en
   vertical; los rankings de categorías largas van en horizontal. */
export const CORTES = [
  ['anio',        'Producción por año',    'barrasV'],
  ['qs_area',     'Áreas QS',              'barrasH'],
  ['unidad',      'Unidades académicas',   'barrasH'],
  ['tipo',        'Tipos documentales',    'barrasH'],
];

export function grafico(pubs_sel, clave, titulo, forma, jerarquia) {
  // Mismo criterio que en `dibujar()`: 'unidad' se agrega a facultad, nunca
  // se mezcla con escuelas sueltas.
  const datos = clave === 'unidad'
    ? X.porFacultad(pubs_sel, jerarquia)
    : X.porDimension(pubs_sel, clave, { tope: forma === 'barrasH' ? 10 : 0 });
  if (!datos.length) {
    return `<p class="vacio">Ninguna publicación en este recorte.</p>`;
  }
  // 'qs_area' y 'unidad' son multivaluados (MULTIVALUADO más abajo): una
  // publicación puede aportar a varias barras, y sin la trama esta portada
  // —la primera pantalla del sitio— dejaba leer las barras como si sumaran
  // el total, justo lo que METHODOLOGY.md §6 prohíbe. `dibujar()`, que
  // dibuja el mismo corte dentro de cada sección, ya lo hacía bien; esta
  // vía paralela para la portada se había quedado atrás.
  return forma === 'barrasV'
    ? c.barrasV(datos.map(d => ({ anio: d.valor, n: d.n })),
        { titulo, etiquetaX: 'anio', etiquetaY: 'n' })
    : c.barrasH(datos, { titulo, trama: MULTIVALUADO.has(clave) });
}

/* Qué indicador dibuja cada corte de la portada. Los cortes de sección ya
   traen su `cod`; éstos no lo tenían porque nadie se lo había pedido, y el
   sello lo necesita para saber de qué fuente hablar. */
const COD_PORTADA = { anio: 'P-02', qs_area: 'T-05', unidad: 'P-07', tipo: 'P-03' };

/** El mapa de procedencias que consumen los sellos, desde los artefactos.

    Se construye UNA vez y lo comparten el pre-renderizado y el navegador, para
    que no haya dos formas de decidir de qué fuente viene un indicador. */
export function procedencias(series, meta) {
  const umbral = meta && meta.cobertura_minima_sin_advertencia;
  const m = {};
  for (const [cod, bloque] of Object.entries(series || {})) {
    const p = bloque && bloque.procedencia;
    if (p) m[cod] = { fuente: p.fuente, corte: p.corte, unidad: p.unidad, umbral };
  }
  return m;
}

/** Sello de procedencia de un corte, medido sobre el recorte que se mira.

    QUÉ ES INVARIANTE Y QUÉ NO
    `fuente` y `corte` son propiedades de la fuente y no cambian al filtrar:
    vienen de `series.json`, que las calcula el build. `N` y la cobertura SÍ
    cambian, y por eso se recalculan aquí sobre el subconjunto.

    Repetir el N del total mientras el lector mira un recorte es exactamente el
    error que la cabecera de este archivo describe: enseñar «una cifra del
    total mientras el lector mira un recorte, que es la manera de que se lea la
    que no es».

    Sin procedencia para ese código no se inventa una: se devuelve cadena
    vacía. Un sello con la fuente adivinada es peor que ningún sello. */
function selloCorte(sub, campo, cod, proc) {
  const p = proc && proc[cod];
  if (!p) return '';
  const { n, cubiertas, pct } = X.cobertura(sub, campo);
  return c.sello({
    fuente: p.fuente, corte: p.corte, unidad: p.unidad || 'publicaciones',
    n, cubiertas, cobertura: pct,
    insuficiente: pct !== null && p.umbral != null && pct < p.umbral * 100,
  });
}

export function cortes(pubs_sel, proc, jerarquia, textos, sel = {}) {
  // El aviso de P-07 se reutiliza tal cual del corte de sección, en vez de
  // escribirlo una segunda vez: dos textos para la misma advertencia
  // metodológica divergen sin que nadie lo note (ver SESSION_NOTES.md sobre
  // AU-01/AU-02/AU-03 duplicados). Se busca en vez de importarse aparte
  // porque SECCIONES ya es la fuente de verdad de ese texto. (Definida
  // dentro de la función, no al nivel del módulo: `SECCIONES` se declara
  // más abajo en este mismo archivo.)
  const avisoUnidad = SECCIONES.produccion.cortes.find(c2 => c2.campo === 'unidad')?.aviso || '';
  const elegidos = CORTES.filter(([clave]) => X.graficoElegido(sel, COD_PORTADA[clave]));
  if (!elegidos.length) return sinGraficos();
  return elegidos.map(([clave, titulo, forma]) => `
    <section class="corte" data-corte="${clave}">
      <h3>${c.escapar(titulo)}</h3>
      <div class="grafico">${grafico(pubs_sel, clave, titulo, forma, jerarquia)}</div>
      ${MULTIVALUADO.has(clave)
        ? '<p class="leyenda-trama">Barras rayadas: no son partes de un total y no suman.</p>' : ''}
      ${clave === 'unidad' && avisoUnidad ? `<p class="nota">${c.escapar(avisoUnidad)}</p>` : ''}
      ${bloqueLectura(COD_PORTADA[clave], { cod: COD_PORTADA[clave],
        aviso: clave === 'unidad' ? avisoUnidad : null }, textos)}
      ${selloCorte(pubs_sel, clave, COD_PORTADA[clave], proc)}
    </section>`).join('');
}

/* ─────────────────────────────────────────────────────── página completa */

/** Todo el cuerpo del explorador. La usa el pre-renderizado con el conjunto
    completo y el navegador con el recorte vigente. `jerarquia` (opcional,
    de meta.json) agrega 'unidad' a facultad — sin ella se ve tal como la
    afiliación la nombró, escuela o facultad indistinto. */
export function explorador(pubs, sel, proc, jerarquia, meta, umbral, textos) {
  const sub = X.recorte(pubs, sel);
  return {
    estado: estado(sub.length, pubs.length, sel, { enlaceLista: true }),
    controles: controles(pubs, sel),
    // Las salvaguardas van pegadas a las cifras que califican, y por delante:
    // una advertencia debajo del número al que corrige llega tarde.
    cifras: salvaguardasPersona(pubs, sel, meta, umbral) + cifras(X.resumen(sub), textos),
    cortes: cortes(sub, proc, jerarquia, textos, sel),
  };
}

/* ═══════════════════════════════════════════ secciones ═══════════════════ */

/* Cada sección declara SUS cortes. La forma la fija la relación del dato, no
   la costumbre: una serie anual va en vertical, un ranking largo en
   horizontal, unos umbrales anidados en acumulada y un total repartido en
   proporcional.

   El panel «qué responde / qué NO responde» de cada sección NO vive aquí:
   antes cada clave tenía su propio `pregunta`/`noResponde` copiado a mano
   desde `docs/EJES.md`, y las dos copias ya habían empezado a divergir
   (verificado: el "no responde" de producción decía algo distinto en cada
   lado). `cabeceraSeccion()` lee `ejes.json` —el mismo artefacto que
   `04_glossary.py` genera y verifica contra los denominadores reales de
   cada indicador— en vez de repetir el texto. */
export const SECCIONES = {
  produccion: {
    cortes: [
      { cod: 'P-02', campo: 'anio',   titulo: 'Publicaciones por año',        forma: 'barrasV' },
      { cod: 'P-03', campo: 'tipo',   titulo: 'Tipo documental',              forma: 'barrasH' },
      { cod: 'P-05', campo: 'fuente', titulo: 'Fuentes con más publicaciones', forma: 'barrasH', tope: 15 },
      { cod: 'P-07', campo: 'unidad', titulo: 'Unidad académica',             forma: 'barrasH',
        aviso: 'Cuenta publicaciones distintas por unidad: una publicación con dos autores UFT de la misma unidad cuenta una sola vez. El treemap "Producción por facultad y escuela", en esta misma sección, cuenta pares autor×publicación —la misma publicación puede contar dos veces— y por eso sus totales no coinciden con estas barras. Ambos criterios están documentados; ninguno es un error.' },
      // Sin `cod` propio a propósito: no es un indicador nuevo, es la misma
      // P-07 vista a nivel de escuela. Con `cod: 'P-07'` el id chocaría con
      // el corte de arriba (dos secciones con el mismo id="P-07" en la
      // página) y el ancla del índice lateral aterrizaría en el equivocado.
      //
      // `seleccionCon` dice de qué indicador es una vista: al elegir `P-07` en
      // el catálogo vienen las dos, la de facultades y la de escuelas. Su
      // lectura sigue siendo propia —son dos figuras y cada una explica lo que
      // cuenta—, pero no se elige por separado porque no es otro indicador.
      { campo: 'escuela', titulo: 'Escuelas dentro de cada facultad',        forma: 'barrasH',
        seleccionCon: 'P-07' },
    ],
  },
  impacto: {
    cortes: [
      { cod: 'I-01', campo: 'citas',  titulo: 'Citas por año de publicación', forma: 'suma-anio',
        aviso: 'Las barras cuentan las citas recibidas por lo publicado en cada año, no la actividad de ese año. Un año reciente tuvo menos tiempo para acumular citas.' },
      { cod: 'I-04', campo: 'fwci',   titulo: 'FWCI mediano por año',         forma: 'mediana-anio' },
      { cod: 'I-05', campo: 'percentil', titulo: 'Umbrales de percentil',     forma: 'acumulada' },
      { cod: 'R-01', campo: 'cuartil', titulo: 'Cuartil de la revista',       forma: 'proporcional' },
      { cod: 'A-01', campo: 'open_access', titulo: 'Vías de acceso abierto',  forma: 'barrasH' },
    ],
  },
  colaboracion: {
    cortes: [
      { cod: 'C-01', campo: 'colaboracion',   titulo: 'Nacional o internacional', forma: 'barrasH' },
      { cod: 'C-03', campo: 'paises',         titulo: 'Países colaboradores',     forma: 'barrasH', tope: 15 },
      { cod: 'C-04', campo: 'instituciones',  titulo: 'Instituciones colaboradoras', forma: 'barrasH', tope: 15 },
      { cod: 'C-06', campo: 'autores_tramo',  titulo: 'Autores por publicación',  forma: 'distribucion' },
      { cod: 'C-05', campo: 'coautoria',      titulo: 'Red de coautoría',         forma: 'red' },
    ],
  },
  tematica: {
    cortes: [
      { cod: 'T-05', campo: 'qs_area', titulo: 'Áreas QS',                    forma: 'barrasH' },
      { cod: 'T-01', campo: 'asjc',    titulo: 'Áreas temáticas ASJC',        forma: 'barrasH', tope: 20 },
      { cod: 'T-04', campo: 'ods',     titulo: 'Objetivos de Desarrollo Sostenible', forma: 'barrasH', tope: 17 },
    ],
  },
};

/* Los campos multivaluados: una publicación aparece en varias barras y la suma
   de las barras supera el número de publicaciones. Se marca con trama, que es
   el código visual que el sitio ya enseña. */
const MULTIVALUADO = new Set(['paises', 'instituciones', 'asjc', 'ods', 'qs_area', 'unidad', 'escuela', 'open_access']);

/* Devuelve el gráfico Y sus datos. La TABLA equivalente no es un extra: es la
   vía alternativa al gráfico para quien no puede leerlo, y se construye de los
   mismos números para que no pueda decir otra cosa.
   `jerarquia` (Map/objeto escuela -> facultad, desde meta.json) sólo lo usan
   los campos 'unidad' y 'escuela'; el resto de los cortes lo ignora. */
function dibujar(sub, corte, jerarquia) {
  const { campo, titulo, forma, tope } = corte;
  // 'unidad' y 'escuela' no pasan por `X.porCampo()` con el extractor
  // genérico: ese extractor da la unidad tal como la afiliación la nombró
  // -escuela o facultad, lo que haya-, y mezclar ambos niveles en una misma
  // lista de barras es justo lo que hacía ilegible el gráfico.
  if (campo === 'unidad') {
    const datos = X.porFacultad(sub, jerarquia);
    return datos.length ? { svg: c.barrasH(datos, { titulo, trama: true }), datos } : null;
  }
  if (campo === 'escuela') {
    const datos = X.porEscuela(sub, jerarquia);
    return datos.length ? { svg: c.barrasH(datos, { titulo, trama: true }), datos } : null;
  }
  if (forma === 'suma-anio') {
    const d = X.sumaPorAnio(sub, campo);
    return d.length
      ? { svg: c.barrasV(d, { titulo, etiquetaX: 'anio', etiquetaY: 'n' }),
          datos: d.map(x => ({ valor: x.anio, n: x.n })) } : null;
  }
  if (forma === 'mediana-anio') {
    const d = X.medianaPorAnio(sub, campo).filter(x => x.valor !== null);
    return d.length
      ? { svg: c.desviacion(d, { titulo, etiquetaX: 'anio', etiquetaY: 'valor',
            decimales: 2, referencia: 1, refEtiqueta: '1,00 — promedio mundial' }),
          datos: d.map(x => ({ valor: x.anio, n: x.valor })) } : null;
  }
  if (forma === 'acumulada') {
    const { datos, base } = X.umbralesPercentil(sub);
    return base ? { svg: c.acumulada(datos, { titulo, total: base }), datos } : null;
  }
  const datos = X.porCampo(sub, campo, { tope: tope || 0 });
  if (!datos.length) return null;
  if (forma === 'proporcional') return { svg: c.proporcional(datos, { titulo }), datos };
  if (forma === 'distribucion') {
    return { svg: c.distribucion(datos, { titulo, etiquetaEje: 'autores por publicación' }), datos };
  }
  if (forma === 'barrasV') {
    return { svg: c.barrasV(datos.map(d => ({ anio: d.valor, n: d.n })),
      { titulo, etiquetaX: 'anio', etiquetaY: 'n' }), datos };
  }
  return { svg: c.barrasH(datos, { titulo, trama: MULTIVALUADO.has(campo) }), datos };
}

/** Gráfico y tabla, conmutables. Sin JavaScript se muestran los dos, que es lo
    correcto: la tabla es la vía equivalente, no un añadido. */
function conmutador(id) {
  return `<div class="vistas" role="group" aria-label="Forma de presentación">
    <button type="button" data-vista="grafico" aria-pressed="true"
      aria-controls="${id}-grafico">Gráfico</button>
    <button type="button" data-vista="tabla" aria-pressed="false"
      aria-controls="${id}-tabla">Tabla</button>
  </div>`;
}

/* ─────────────────────────────────────────────────── C-05, red de coautoría

   No pasa por `dibujar()`/`conmutador()`: la red no es un gráfico con una
   tabla equivalente, son TRES lecturas del mismo grafo (nodos, matriz,
   arcos) más una tabla de aristas como cuarta vía accesible. Reutiliza el
   mismo conmutador genérico de `.vistas button[data-vista]` que ya engancha
   `conmutadorVistas()` en paginas.js — no hace falta escucha nueva. */

/** El id del patrón de trama (D-09, ausencia de unidad) se pone en conflicto
    si dos SVG de esta misma sección lo declaran igual: el navegador resuelve
    `url(#id)` contra el documento entero, no por SVG. Los tres SVG de este
    corte —nodos, matriz, arcos— conviven en el DOM a la vez (se alternan con
    CSS, no con innerHTML), así que cada uno necesita su propio id. */
function svgConTramaUnica(svg, sufijo) {
  return svg.replace(/tramaSinDatoRed/g, `tramaSinDatoRed-${sufijo}`);
}

/** Tabla de aristas: la vía accesible para quien no puede leer el SVG. Cada
    fila es una coautoría real, con las dos formas de pesarla —igual que
    declara `docs/METHODOLOGY.md`, el recuento y el peso fraccional no
    responden la misma pregunta y no se elige uno por el lector. */
function tablaRed(aristas) {
  const filas = aristas.slice()
    .sort((e1, e2) => e2.peso - e1.peso || e1.a.localeCompare(e1.b) || e1.b.localeCompare(e2.b))
    .map(e => `<tr><td>${c.escapar(e.a)}</td><td>${c.escapar(e.b)}</td>
      <td class="num">${e.peso}</td><td class="num">${e.peso_fraccional.toFixed(2)}</td></tr>`).join('');
  return `<div class="tabla-envoltura tabla-datos"><table>
    <thead><tr><th scope="col">Persona</th><th scope="col">Coautor</th>
      <th scope="col" class="num">Publicaciones compartidas</th>
      <th scope="col" class="num">Peso fraccional</th></tr></thead>
    <tbody>${filas}</tbody></table></div>`;
}

/** El módulo completo de C-05. `unidadPorPersona`: Map nombre → unidad
    académica, de `authors.json` (no hay forma de derivarla de `sub` sola:
    una publicación no lleva la unidad por autor individual, sólo el conjunto
    de unidades de TODOS sus firmantes). */
function corteRed(sub, corte, unidadPorPersona, proc, textos) {
  const id = corte.cod;
  const autoria = [];
  for (const p of sub) for (const persona of (p.autores_uft || [])) autoria.push([persona, p.eid]);

  const g = G.construirGrafo(autoria, new Set(), unidadPorPersona || new Map());
  if (!g.nodos.length) {
    return `<section class="corte" id="${id}" data-corte="${corte.campo}" tabindex="-1">
      <header class="corte-cab"><h3>${c.escapar(corte.titulo)}</h3></header>
      <p class="vacio">Ninguna publicación con autoría UFT detallada en este recorte.</p>
    </section>`;
  }
  const comp = G.componentes(g.nodos, g.aristas);
  const coms = G.comunidades(g.nodos, g.aristas);
  const nComp = new Set(comp.values()).size;
  const nComs = new Set(coms.values()).size;
  const nodosConArista = new Set();
  for (const e of g.aristas) { nodosConArista.add(e.a); nodosConArista.add(e.b); }
  const conectadas = nodosConArista.size;

  // El DIBUJO se recorta a las componentes de 5 personas o más — el mismo
  // criterio y el mismo motivo que `internal/red_coautoria.html`
  // (src/review/vista_red.py): con cientos de componentes de una pareja o un
  // trío, el anillo de grupos se vuelve ilegible. Se recorta el dibujo, no el
  // análisis — las cifras de arriba y la tabla de abajo cubren a TODAS.
  const MINIMO = 5;
  const tamComp = new Map();
  for (const c2 of comp.values()) tamComp.set(c2, (tamComp.get(c2) || 0) + 1);
  const visibles = g.nodos.filter(n => tamComp.get(comp.get(n)) >= MINIMO);
  const idxVis = new Map(visibles.map((n, i) => [n, i]));
  const nodos = visibles.map((n, i) => ({
    i, id: n, valor: n, n: g.publicacionesPorPersona.get(n) || 0,
    unidad: g.unidades.get(n), com: coms.get(n),
  }));
  const aristasIdx = g.aristas
    .filter(e => idxVis.has(e.a) && idxVis.has(e.b))
    .map(e => ({ a: idxVis.get(e.a), b: idxVis.get(e.b), n: e.peso }));

  // Un recorte angosto puede no dejar NINGUNA componente de 5+: el dibujo se
  // queda sin nada que mostrar, pero la tabla de aristas sigue cubriendo todo
  // lo que el recorte sí tiene. Un hueco sin avisar se leería como que no hay
  // coautoría en absoluto, que sería falso si `conectadas` es mayor que 0.
  const sinDibujo = !nodos.length;
  const D = sinDibujo ? null : c.disponerRed(nodos, aristasIdx);
  const vacioDibujo = `<p class="vacio">Ninguna componente de 5 personas o más en este
    recorte. La tabla, abajo, cubre las ${c.nf.format(conectadas)} personas con
    coautoría interna que sí tiene.</p>`;

  return `<section class="corte corte-red" id="${id}" data-corte="${corte.campo}" tabindex="-1">
    <header class="corte-cab">
      <h3>${c.escapar(corte.titulo)}</h3>
      <div class="vistas" role="group" aria-label="Forma de la red">
        <button type="button" data-vista="nodos" aria-pressed="${!sinDibujo}" aria-controls="${id}-nodos">Nodos</button>
        <button type="button" data-vista="matriz" aria-pressed="false" aria-controls="${id}-matriz">Matriz</button>
        <button type="button" data-vista="arcos" aria-pressed="false" aria-controls="${id}-arcos">Arcos</button>
        <button type="button" data-vista="tabla" aria-pressed="${sinDibujo}" aria-controls="${id}-tabla">Tabla</button>
      </div>
    </header>
    <p class="nota-destacada"><b>Dos particiones que no son lo mismo</b>
      La posición agrupa por <b>comunidad</b>, detectada por un algoritmo (Louvain) que
      maximiza densidad interna — una heurística razonable, no un veredicto sobre qué
      grupos de investigación existen. La <b>componente</b> —si hay un camino de
      coautoría entre dos personas— sí es un hecho objetivo del grafo, sin parámetros
      ni azar. <a href="metodologia.html#componente-y-comunidad-red-de-coautoria">Cómo se lee esta red →</a></p>
    <div class="vista" id="${id}-nodos" data-vista="nodos" data-activa="${!sinDibujo}">
      ${sinDibujo ? vacioDibujo : svgConTramaUnica(c.red(D, 'nodos'), id + '-nodos')}</div>
    <div class="vista" id="${id}-matriz" data-vista="matriz" data-activa="false">
      ${sinDibujo ? vacioDibujo : svgConTramaUnica(c.red(D, 'matriz'), id + '-matriz')}</div>
    <div class="vista" id="${id}-arcos" data-vista="arcos" data-activa="false">
      ${sinDibujo ? vacioDibujo : svgConTramaUnica(c.red(D, 'arcos'), id + '-arcos')}</div>
    <div class="vista" id="${id}-tabla" data-vista="tabla" data-activa="${sinDibujo}">${tablaRed(g.aristas)}</div>
    ${bloqueLectura(id, corte, textos)}
    <p class="solo-papel lectura-cuidado"><b>En papel</b>
      Se dibuja sólo la vista de nodos. La matriz, los arcos y la tabla de pares
      —una fila por cada par de firmas que coautoró— se consultan en el sitio: en
      una hoja ocupaban cuarenta páginas de listado.</p>
    <p class="nota"><strong>${c.nf.format(g.nodos.length)}</strong> personas en el recorte ·
      <strong>${c.nf.format(conectadas)}</strong> con al menos una coautoría interna ·
      <strong>${c.nf.format(nComp)}</strong> componentes · <strong>${c.nf.format(nComs)}</strong>
      comunidades Louvain. Sólo se dibujan las componentes de 5 personas o más; la tabla
      cubre a todas.</p>
    ${selloCorte(sub, corte.campo, corte.cod, proc)}
  </section>`;
}

/** Ninguna figura de esta sección está en la selección.

    Se dice en vez de callar: una sección vacía sin explicación se lee como que
    no hay dato, que es lo contrario de lo que pasa. */
function sinGraficos() {
  return `<p class="vacio">Ningún gráfico de esta sección está en la selección.
    El informe completo los incluye todos.</p>`;
}

/** En qué sección vive cada gráfico. Lo consume el selector del catálogo, que
    es la única página donde se ven los dieciocho juntos: sin esto tendría que
    guardar su propia copia de la tabla `SECCIONES` y las dos divergirían. */
export function seccionDeGrafico() {
  const m = {};
  for (const [clave, s] of Object.entries(SECCIONES)) {
    // Las variantes no entran: se eligen con su indicador, no aparte.
    for (const corte of s.cortes) {
      if (!corte.seleccionCon) m[corte.cod || corte.campo] = clave;
    }
  }
  return m;
}

/* Qué muestra el gráfico, para el papel.

   En pantalla, quien no entiende una figura tiene la ayuda contextual, el
   glosario y el panel de la sección a un clic. En el PDF no tiene nada: la
   ayuda es un panel que aparece al pasar el puntero. Un informe que se archiva
   y se cita necesita decir, junto a la figura, qué cuenta cada barra.

   Dos párrafos y en este orden: qué muestra —de `docs/LECTURAS.md`, revisado
   como documento— y qué cuidado exige —la advertencia del catálogo, que ya es
   pública en `indicadores.html`—. El sello de procedencia va después y lo pone
   el propio corte.

   La advertencia del catálogo NO se imprime si el corte ya trae su propio
   `aviso`: son dos textos sobre lo mismo y en papel se leerían como dos
   advertencias distintas. */
/** «Qué muestra» y «Cuidado», pegados a la figura. EN PANTALLA TAMBIÉN.

    Nacieron `solo-papel`, con este argumento: en pantalla quien no entiende una
    figura tiene la ayuda contextual, el glosario y el panel de la sección a un
    clic, y en el PDF no tiene nada. El argumento era cierto y la conclusión
    estaba mal. «A un clic» es la parte que falla: quien no entiende un gráfico
    no siempre sabe que no lo entiende, y menos aún qué término buscar. La
    ayuda escondida sirve a quien ya sospecha; la frase junto a la figura sirve
    a quien la mira por primera vez, que es el caso normal de alguien que llega
    a un tablero bibliométrico desde su propia disciplina.

    La consecuencia práctica era peor de lo que suena: el sitio, que es la
    superficie que casi todo el mundo usa, era la única donde el gráfico no se
    explicaba. Sólo lo veía quien descargaba el PDF.

    El texto es el mismo en los dos medios —un origen, `docs/LECTURAS.md`— y lo
    que cambia es la presentación, que la hoja de estilo resuelve: pie de figura
    en pantalla, bloque compacto en papel. */
function bloqueLectura(clave, corte, textos) {
  if (!textos) return '';
  const l = (textos.lecturas || {})[clave];
  const adv = corte.aviso ? null : (textos.advertencias || {})[corte.cod];
  if (!l && !adv) return '';
  return `${l ? `<p class="lectura-grafico"><b>Qué muestra</b>
      ${c.escapar(l.muestra)}</p>` : ''}
    ${adv ? `<p class="lectura-cuidado"><b>Cuidado</b>
      ${c.escapar(adv)}</p>` : ''}`;
}

/* Un corte que sobre una sola persona diría otra cosa.

   La regla del proyecto es la de siempre: si el indicador cambia de
   significado, se dice. Sobre un informe personal hay dos casos y no se
   resuelven igual.

   La RED DE COAUTORÍA se apaga. Recortada a una persona no es una red: es esa
   persona en el centro y sus coautores alrededor, una estrella cuyo dibujo
   siempre sale igual para todo el mundo y en la que la métrica que da sentido
   al corte —cómo se agrupan las personas entre sí— no existe. Dibujarla
   ofrecería una forma que se lee como estructura de colaboración y no lo es.
   Su contenido no se pierde: la coautoría de esa persona, con quién y cuántas
   veces, está en su ficha (C-05, `T-10`), que además abre el informe personal.

   La MEDIANA POR AÑO se queda, con su aviso. Es una cifra correcta sobre pocos
   valores, y ocultarla dejaría un hueco que se leería como ausencia de dato;
   lo que hace falta es decir sobre cuántos se calcula. Apagar de más también
   engaña. */
function cortePersonal(corte, persona) {
  if (corte.forma !== 'red') return null;
  return `<section class="corte" id="${c.escapar(corte.cod || corte.campo)}"
    data-corte="${c.escapar(corte.campo)}" tabindex="-1">
    <header class="corte-cab"><h3>${c.escapar(corte.titulo)}</h3></header>
    <p class="vacio">No se dibuja en un informe recortado a una persona.
      Sobre ${c.escapar(persona)} esta red sería una estrella —esa firma en el
      centro y sus coautores alrededor—, y su forma no describiría la estructura
      de colaboración, que es lo que este indicador mide.
      Con quién coautoró y cuántas veces está en su ficha.</p>
  </section>`;
}

/** Los cortes de una sección, recalculados sobre el recorte vigente.
    `unidadPorPersona` sólo lo usa C-05 (red de coautoría); `jerarquia` sólo
    'unidad' y 'escuela' (P-07). `persona` (opcional) es la firma a la que está
    recortado el informe, y cambia qué se dibuja: ver `cortePersonal`. */
export function cortesSeccion(sub, clave, proc, unidadPorPersona, jerarquia, sel, textos) {
  const s = SECCIONES[clave];
  if (!s) return '';
  const persona = X.personaDelRecorte(sel || {});
  /* La selección de gráficos se aplica ANTES que nada: una sección sin ninguno
     elegido no dibuja nada y lo dice, en vez de dejar una página en blanco que
     se lee como que la sección no tiene datos. */
  const elegidos = s.cortes.filter(corte =>
    X.graficoElegido(sel || {}, corte.seleccionCon || corte.cod || corte.campo));
  if (!elegidos.length) return sinGraficos();
  return elegidos.map(corte => {
    if (persona) {
      const personal = cortePersonal(corte, persona);
      if (personal) return personal;
    }
    if (corte.forma === 'red') return corteRed(sub, corte, unidadPorPersona, proc, textos);
    const r = dibujar(sub, corte, jerarquia);
    const id = corte.cod || corte.campo;
    // 'escuela' no tiene indicador propio — es P-07 visto por escuela—, así
    // que el sello (fuente, corte, cobertura) se pide con el campo y el
    // código de 'unidad': misma procedencia, mismo denominador.
    const campoSello = corte.campo === 'escuela' ? 'unidad' : corte.campo;
    const codSello = corte.campo === 'escuela' ? 'P-07' : corte.cod;
    // El id es el CÓDIGO del indicador y no el campo: así la compuerta de
    // higiene puede comprobar que cada indicador declarado se dibuja de
    // verdad, y los enlaces del catálogo a #C-01 siguen llegando al gráfico.
    return `<section class="corte" id="${c.escapar(corte.cod || corte.campo)}"
      data-corte="${corte.campo}" tabindex="-1">
      <header class="corte-cab">
        <h3>${c.escapar(corte.titulo)}</h3>
        ${r ? conmutador(id) : ''}
      </header>
      ${r ? `<div class="vista" id="${id}-grafico" data-vista="grafico" data-activa="true">
        <div class="grafico">${r.svg}</div>
      </div>
      <div class="vista" id="${id}-tabla" data-vista="tabla" data-activa="false">
        ${c.tablaEquivalente(r.datos)}
      </div>`
      : '<p class="vacio">Ninguna publicación con este dato en el recorte.</p>'}
      ${MULTIVALUADO.has(corte.campo)
        ? '<p class="leyenda-trama">Barras rayadas: no son partes de un total y no suman.</p>' : ''}
      ${corte.aviso ? `<p class="nota">${c.escapar(corte.aviso)}</p>` : ''}
      ${bloqueLectura(corte.cod || corte.campo, corte, textos)}
      ${persona && corte.forma === 'mediana-anio'
        ? `<p class="nota">Recortado a una persona, cada punto es la mediana de
            las publicaciones de esa firma en ese año, que pueden ser una o dos.
            Una mediana sobre tan pocos valores no describe una tendencia.</p>`
        : ''}
      ${selloCorte(sub, campoSello, codSello, proc)}
    </section>`;
  }).join('');
}

/** Índice de los cortes de la sección.

    El panel lateral pasó de ser un índice de módulos a ser los controles del
    recorte, y con eso se habría perdido la navegación rápida entre gráficos.
    Vuelve debajo de los filtros: sigue siendo la forma de saltar a un
    indicador concreto sin buscarlo con la rueda. */
export function indice(clave) {
  const s = SECCIONES[clave];
  if (!s) return '';
  return `<nav class="rail" aria-label="Indicadores de la sección">
    <p class="rail-titulo">En esta sección</p>
    ${s.cortes.map(x => `<a href="#${c.escapar(x.cod || x.campo)}">
      <span class="rail-cod">${c.escapar(x.cod || '')}</span>
      <span class="rail-nom">${c.escapar(x.titulo)}</span></a>`).join('')}
  </nav>`;
}

/** La cabecera de una sección: qué responde y qué NO responde.

    `eje` es la entrada de `ejes.json` para esta clave (`{titulo, responde,
    no_responde, sobre_que}`) — la misma fuente que `docs/EJES.md` declara y
    que `04_glossary.py` verifica contra los denominadores reales de cada
    indicador antes de publicarla. Sin `ejes.json` cargado (o sin panel para
    esta clave) se omite el bloque en vez de inventar un texto. */
export function cabeceraSeccion(clave, titulo, eje) {
  return `<div class="portada-id">
    <h1>${c.escapar(titulo)}</h1>
    <p class="portada-sub">${c.escapar(eje ? eje.responde : '')}</p>
  </div>
  ${eje ? `<details class="metodo portada-metodo">
    <summary>Qué NO dice esta sección</summary>
    <div class="metodo-cuerpo"><p>${c.escapar(eje.no_responde)}</p></div>
  </details>` : ''}`;
}

/** Todo el cuerpo de una sección. `unidadPorPersona` (Map, opcional) sólo lo
    necesita C-05; `jerarquia` (objeto, opcional, de meta.json) sólo P-07.
    Las demás secciones los reciben y no los usan. */
export function seccion(pubs, sel, clave, proc, unidadPorPersona, jerarquia, meta, umbral, textos) {
  const sub = X.recorte(pubs, sel);
  return {
    estado: estado(sub.length, pubs.length, sel, { enlaceLista: true }),
    controles: controles(pubs, sel) + indice(clave),
    cifras: salvaguardasPersona(pubs, sel, meta, umbral) + cifras(X.resumen(sub), textos),
    cortes: cortesSeccion(sub, clave, proc, unidadPorPersona, jerarquia, sel, textos),
  };
}

/* ────────────────────────────────────────────── indicadores no publicados */

/** Los indicadores de la sección que existen y NO se publican.

    Aparecen a propósito: que uno esté verificado y diferido es información del
    informe, y un hueco se leería como que el fenómeno no existe. Van sobre el
    suelo de contraste porque NO responden al recorte —no se calculan aquí— y
    mezclarlos con lo que sí responde haría creer que el filtro los cambia. */
export function diferidos(catalogo, clave) {
  const filas = (catalogo.indicadores || []).filter(
    r => r.categoria === clave && r.estado !== 'publicado');
  if (!filas.length) return '';
  return `<section class="banda banda-contraste no-publicados">
    <div class="banda-titulo">
      <p class="banda-gancho">Lo que esta sección todavía no puede mostrar</p>
      <h2>${filas.length === 1 ? 'Un indicador' : `${filas.length} indicadores`}
        de esta sección está${filas.length === 1 ? '' : 'n'} verificado${
        filas.length === 1 ? '' : 's'} pero no se publica${filas.length === 1 ? '' : 'n'}.</h2>
      <p>No responden al recorte: no se calculan aquí. Se dice cuál y por qué.</p>
    </div>
    ${filas.map(r => `<article class="modulo modulo-diferido" id="${c.escapar(r.codigo)}">
      <header><div class="modulo-id">
        <h3>${c.escapar(r.nombre)}</h3><span class="codigo">${c.escapar(r.codigo)}</span>
      </div><span class="estado" data-e="${c.escapar(r.estado)}">${
        c.escapar(r.estado_etiqueta || r.estado)}</span></header>
      <p class="nota">${c.escapar(r.advertencia || r.definicion || '')}</p>
    </article>`).join('')}
  </section>`;
}
