/* explorador.js — recálculo de indicadores en el navegador.

   QUÉ CAMBIA RESPECTO DEL SITIO ANTERIOR
     Antes el sitio servía indicadores YA CALCULADOS: el build dejaba
     `series.json` con las cifras del conjunto completo y la página las
     pintaba. Eso hacía un informe, no una plataforma: el lector veía las
     cifras que alguien decidió por él y no podía preguntar nada más.

     Aquí los indicadores se derivan de `publications.json` en el navegador,
     sobre el subconjunto que el lector elige. «Publicaciones de la Facultad de
     Medicina de 2024 con colaboración internacional» no es una vista
     preparada: es una pregunta que se responde al momento porque el dato de
     cada publicación viaja entero.

   POR QUÉ NO ROMPE LA GARANTÍA DE «SIN JAVASCRIPT»
     El HTML llega pre-renderizado con los valores del conjunto COMPLETO, que
     son los del informe. Este módulo no escribe nada hasta que el lector toca
     un filtro. Sin JavaScript se ve el informe entero; con JavaScript, además,
     se puede interrogar. Mejora progresiva, no dependencia.

   LO QUE NO HACE
     No recalcula el FWCI ni los percentiles: son métricas NORMALIZADAS que
     SciVal computa contra el mundo, y promediarlas sobre un subconjunto
     arbitrario daría un número con aspecto de FWCI que no lo es. Sobre un
     recorte se informa la MEDIANA de los valores que la fuente ya asignó a
     cada publicación, y se dice que es eso. Confundir «promedio de FWCI» con
     «FWCI del conjunto» es el error que el Leiden Manifesto pide no cometer. */

/* ─────────────────────────────────────────────────── el estado del recorte */

export const DIMENSIONES = [
  ['anio',          'Año',                p => [String(p.anio)]],
  /* La persona. Los nombres de `autores_uft` YA son los canónicos de cada
     entidad —530 nombres distintos, ninguno una variante suelta, y ninguna
     entidad comparte nombre con otra: comprobado sobre el artefacto—, así que
     filtrar por nombre es exacto y no hay heurística de emparejamiento en el
     navegador, que es lo que `D-08` prohíbe.

     NO lleva cubo «sin dato». `unidad` sí lo lleva porque toda publicación
     tiene una o carece de ella, pero la autoría es una lista de personas y «sin
     autoría UFT nombrada» no es una persona: ofrecerla dentro de un filtro de
     personas sería un error de categoría. Esas publicaciones siguen estando en
     el informe y el listado las declara una por una. */
  ['autor',         'Autor',              p => p.autores_uft || []],
  ['qs_area',       'Área QS',            p => p.qs_area],
  ['unidad',        'Unidad académica',   p => p.unidades.length ? p.unidades : ['Sin dato declarado']],
  ['tipo',          'Tipo documental',    p => [p.tipo]],
  ['open_access',   'Acceso abierto',     p => p.open_access.length ? p.open_access : ['Sin dato declarado']],
  ['colaboracion',  'Colaboración',       p => [p.es_internacional === null ? 'Sin dato declarado'
                                                : p.es_internacional ? 'Internacional' : 'Nacional']],
];

const EXTRAE = Object.fromEntries(DIMENSIONES.map(([k, , f]) => [k, f]));

/* Comparación insensible a acentos y a mayúsculas. Buscar «Nunez» tiene que
   encontrar «Núñez»: en un corpus con nombres en español, exigir el acento
   convierte el buscador en un examen de ortografía. */
const plano = s => String(s).normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** El texto sobre el que busca `q`. Título, fuente y autores UFT: lo que una
    persona recuerda de una publicación cuando la busca. */
const heno = p => plano(`${p.titulo} ${p.fuente} ${(p.autores_uft || []).join(' ')}`);

/** ¿Esta publicación entra en el recorte? `omitir` deja fuera una dimensión,
    que es como se cuentan las facetas de la propia dimensión sin que se
    anulen a sí mismas. */
export function pasa(p, sel, omitir = null) {
  if (sel.q && omitir !== 'q' && !heno(p).includes(plano(sel.q))) return false;
  for (const [clave] of DIMENSIONES) {
    if (clave === omitir) continue;
    const elegidos = sel[clave];
    if (!elegidos || !elegidos.length) continue;
    // OR dentro de una dimensión, AND entre dimensiones. Es lo que espera
    // cualquiera que haya usado un filtro, y hacerlo al revés convierte cada
    // clic adicional en menos resultados sin que se entienda por qué.
    if (!EXTRAE[clave](p).some(v => elegidos.includes(String(v)))) return false;
  }
  return true;
}

export const recorte = (pubs, sel) => pubs.filter(p => pasa(p, sel));

/* ──────────────────────────────────────────────────────── los indicadores */

const num = xs => xs.filter(v => typeof v === 'number' && !Number.isNaN(v));

export function mediana(xs) {
  const v = num(xs).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Las cifras de cabecera del recorte.

    Cada una declara SU PROPIO DENOMINADOR, que es la decisión D-16 del
    proyecto: no todas las publicaciones tienen métricas, así que dividir
    siempre por el total daría porcentajes que no significan nada. */
export function resumen(sel_pubs) {
  const conMetricas = sel_pubs.filter(p => p.tiene_metricas);
  const conColab = sel_pubs.filter(p => p.es_internacional !== null);
  const inter = conColab.filter(p => p.es_internacional);
  const citas = conMetricas.reduce((a, p) => a + (p.citas || 0), 0);
  const fwci = num(conMetricas.map(p => p.fwci));

  return {
    publicaciones: { valor: sel_pubs.length, base: sel_pubs.length },
    citas:         { valor: citas, base: conMetricas.length },
    citas_por_pub: { valor: conMetricas.length ? citas / conMetricas.length : null,
                     base: conMetricas.length, decimales: 2 },
    // MEDIANA y no media: la distribución del FWCI es asimétrica —unas pocas
    // publicaciones muy citadas tiran del promedio— y sobre un recorte
    // pequeño la media miente más todavía.
    fwci_mediano:  { valor: mediana(fwci), base: fwci.length, decimales: 2 },
    internacional: { valor: conColab.length ? inter.length / conColab.length * 100 : null,
                     base: conColab.length, decimales: 1, sufijo: ' %' },
    autores:       { valor: new Set(sel_pubs.flatMap(p => p.autores_uft)).size,
                     base: sel_pubs.filter(p => p.tiene_autoria).length },
  };
}

/** Recuento por categoría de una dimensión, listo para dibujar. */
export function porDimension(sel_pubs, clave, { tope = 0, ordenar = true } = {}) {
  const cuenta = new Map();
  for (const p of sel_pubs) {
    for (const v of EXTRAE[clave](p)) {
      cuenta.set(String(v), (cuenta.get(String(v)) || 0) + 1);
    }
  }
  let filas = [...cuenta].map(([valor, n]) => ({ valor, n }));
  // El año es un EJE, no un ranking: ordenarlo por frecuencia destruye la
  // única lectura que tiene, que es la secuencia temporal.
  filas.sort(clave === 'anio' || !ordenar
    ? (a, b) => a.valor.localeCompare(b.valor)
    : (a, b) => b.n - a.n || a.valor.localeCompare(b.valor));
  return tope ? filas.slice(0, tope) : filas;
}

/** Unidad académica agregada a FACULTAD, según la jerarquía del build
    (`meta.jerarquia`, escuela -> facultad). `p.unidades` trae el nivel más
    fino que la afiliación permitió detectar —a veces escuela, a veces ya
    facultad—, porque el filtro necesita esa granularidad. El gráfico
    principal no: mezclar «Facultad de Medicina y Salud» con «Escuela de
    Kinesiología» en la misma lista de barras hace ilegible cuál es la
    unidad de comparación. `porEscuela()`, más abajo, es la vista aparte
    para quien sí quiere el detalle de escuela. */
export function porFacultad(sel_pubs, jerarquia) {
  const j = jerarquia || {};
  const cuenta = new Map();
  for (const p of sel_pubs) {
    const unidades = p.unidades.length ? p.unidades : ['Sin dato declarado'];
    for (const u of unidades) {
      const f = j[u] || u;
      cuenta.set(f, (cuenta.get(f) || 0) + 1);
    }
  }
  return [...cuenta].map(([valor, n]) => ({ valor, n }))
    .sort((a, b) => b.n - a.n || a.valor.localeCompare(b.valor));
}

/** Sólo las unidades que la jerarquía reconoce como escuela —nunca
    facultades sueltas, «No determinada» ni «Sin dato declarado», que no
    tienen lectura como escuela. */
export function porEscuela(sel_pubs, jerarquia) {
  const j = jerarquia || {};
  const cuenta = new Map();
  for (const p of sel_pubs) {
    for (const u of p.unidades) {
      if (j[u]) cuenta.set(u, (cuenta.get(u) || 0) + 1);
    }
  }
  return [...cuenta].map(([valor, n]) => ({ valor, n }))
    .sort((a, b) => b.n - a.n || a.valor.localeCompare(b.valor));
}

/** Recuentos por faceta para pintar los propios controles del filtro.

    Se calculan con las DEMÁS dimensiones aplicadas pero no la propia: si una
    faceta se contara a sí misma, al elegirla todas sus hermanas caerían a
    cero y el filtro dejaría de poder cambiarse sin limpiarlo antes. */
export function facetas(pubs, sel, clave) {
  const visibles = pubs.filter(p => pasa(p, sel, clave));
  const cuenta = new Map();
  for (const p of visibles) {
    for (const v of EXTRAE[clave](p)) cuenta.set(String(v), (cuenta.get(String(v)) || 0) + 1);
  }
  return cuenta;
}

/* ────────────────────────────────────────────────────── URL como estado */

/* El recorte vive en la barra de direcciones. Es lo que permite CITAR una
   vista concreta —«la Facultad de Medicina en 2024»— en un correo o en un
   informe, que es justo lo que un lector de datos institucionales necesita
   hacer y lo que un tablero sin URL no deja. También hace que el botón de
   volver funcione. */

export function leerURL(busqueda = location.search) {
  const q = new URLSearchParams(busqueda), sel = {};
  for (const [clave] of DIMENSIONES) {
    const v = q.get(clave);
    if (v) sel[clave] = v.split('|').filter(Boolean);
  }
  // `internacional` es como se llamaba esta dimensión en la página de
  // publicaciones antes de unificar el filtrado. Se sigue leyendo para que un
  // enlace guardado o citado no deje de funcionar.
  if (!sel.colaboracion) {
    const viejo = q.get('internacional');
    if (viejo) sel.colaboracion = viejo.split('|').filter(Boolean);
  }
  const texto = q.get('q');
  if (texto) sel.q = texto;
  /* La SELECCIÓN de gráficos viaja con el recorte pero NO es un recorte: no
     cambia qué publicaciones se cuentan, cambia qué figuras se dibujan. Por eso
     no entra en `DIMENSIONES` —no filtra datos, no tiene facetas y no aparece
     en `describir()`, que es lo que declara sobre qué está medido el informe—.
     Confundirlas haría que una hoja dijera «recortado a I-04», como si los
     datos estuvieran restringidos a algo. */
  const graficos = q.get('grafico');
  if (graficos) sel.grafico = graficos.split('|').filter(Boolean);
  return sel;
}

/** Los códigos de gráfico elegidos, o `null` si no hay selección.

    `null` y lista vacía significan cosas distintas: sin selección se dibuja
    todo, y una selección vacía sería un informe sin figuras que nadie pidió. */
export const graficosDe = (sel) =>
  (sel.grafico && sel.grafico.length) ? sel.grafico : null;

/** ¿Se dibuja este gráfico? Sin selección, todos. */
export const graficoElegido = (sel, clave) => {
  const g = graficosDe(sel);
  return !g || g.includes(clave);
};

/** El recorte serializado a query. Se calcula del RECORTE y no de
    `location.search`, por dos razones: es la verdad —la URL puede ir un paso
    por detrás— y `location` no existe bajo Node, donde corre el
    pre-renderizado. */
export function consulta(sel) {
  const q = new URLSearchParams();
  for (const [clave] of DIMENSIONES) {
    if (sel[clave] && sel[clave].length) q.set(clave, sel[clave].join('|'));
  }
  if (sel.q) q.set('q', sel.q);
  if (sel.grafico && sel.grafico.length) q.set('grafico', sel.grafico.join('|'));
  return q.toString();
}

export function escribirURL(sel, reemplazar = true) {
  const q = consulta(sel);
  history[reemplazar ? 'replaceState' : 'pushState'](null, '', q ? `?${q}` : location.pathname);
}

/** El nombre de la persona a la que está recortado el informe, o `null`.

    Una sola, y con o sin otras dimensiones encima: un informe de una persona
    filtrado además por año sigue siendo el informe de esa persona, y las
    salvaguardas que exige no dependen de cuántos filtros más haya. Con dos
    personas elegidas ya no lo es, y las cifras vuelven a ser de un conjunto. */
export const personaDelRecorte = (sel) =>
  (sel.autor && sel.autor.length === 1) ? sel.autor[0] : null;

/** Cuántas publicaciones tiene esa persona EN LA VENTANA, sin el resto del
    recorte aplicado.

    Sin el resto a propósito: es su base de interpretabilidad, no la del corte
    que se esté mirando. Alguien con seis publicaciones a quien se le añade un
    filtro de año no pasa a ser «muestra reducida» por eso; lo que baja es el
    tamaño del corte, y eso ya lo declara la línea del recorte.

    Coincide con `n_publicaciones` de `authors.json` para las 530 entidades
    —comprobado sobre el artefacto—, así que la ficha y el informe recortado
    dicen el mismo número sin que éste tenga que cargar aquél. */
export const publicacionesDe = (pubs, nombre) =>
  pubs.reduce((n, p) => n + ((p.autores_uft || []).includes(nombre) ? 1 : 0), 0);

/** La unidad del recorte, cuando es UNA sola.

    Alcanza a las escuelas sin nada añadido: no hay una dimensión `escuela`
    aparte —el corte por escuela es P-07 visto un nivel más abajo, derivado de
    la jerarquía—, así que facultades y escuelas son valores del mismo campo
    `unidades`. La aritmética de la inestabilidad tampoco distingue entre
    ellas, y tres de las escuelas están por debajo del umbral. */
export const unidadDelRecorte = (sel) =>
  (sel.unidad && sel.unidad.length === 1) ? sel.unidad[0] : null;

/** Sobre cuántas publicaciones descansan los indicadores de impacto de esta
    unidad, y cuánto vale una de ellas en el «top 10 %».

    Las dos cifras son distintas y las dos hacen falta. La primera es el tamaño
    del conjunto; la segunda es la base del indicador frágil, que no es la
    misma: sólo las publicaciones con percentil de citación entran en él. Que
    una publicación valga `100/n` puntos no se estima, se calcula.

    Se mide sobre la unidad ENTERA en la ventana, sin el resto del recorte
    aplicado, por la misma razón que en `publicacionesDe`: añadir un filtro de
    año no convierte a una facultad en muestra reducida. */
export const baseDeUnidad = (pubs, nombre) => {
  const suyas = pubs.filter((p) => (p.unidades || []).includes(nombre));
  const conDato = suyas.filter((p) => p.percentil_citacion !== null
                                   && p.percentil_citacion !== undefined);
  const enTop = conDato.filter((p) => p.percentil_citacion <= 10).length;
  return { n: suyas.length, base: conDato.length, enTop };
};

/** Cuánto mueve UNA publicación el «top 10 %» de un conjunto de `base`
    publicaciones con percentil, de las que `enTop` están en el decil.

    Forma cerrada del jackknife, no una aproximación. Quitar una publicación
    deja `base - 1`, y sólo hay dos resultados posibles: si la que sale estaba
    en el top, el valor pasa a `100(enTop-1)/(base-1)`; si no, a
    `100·enTop/(base-1)`. La diferencia entre ambos es `100/(base-1)`.

    `100/base` parecía la cifra evidente y no lo era: con 17 publicaciones da
    5,9 puntos y el jackknife medido sobre el corpus da 6,2. La diferencia nace
    de que al quitar una cambia también el denominador. Se vio comparando la
    banda contra la tabla de `docs/UMBRAL_POR_UNIDAD.md`.

    Cuando NINGUNA está en el top, el jackknife da cero y ese cero engaña: no
    es estabilidad, es que no hay nada que quitar. Ahí se devuelve `null` y la
    banda dice otra cosa. */
export const vaivenTop10 = ({ base, enTop }) => {
  if (!base || base < 2) return null;
  if (enTop === 0) return null;
  return 100 / (base - 1);
};

export const hayRecorte = sel =>
  Boolean(sel.q) || DIMENSIONES.some(([c]) => sel[c] && sel[c].length);

/** Cómo se llama el recorte activo, en palabras. Un tablero que sólo muestra
    cifras filtradas sin decir por qué está filtrado produce lecturas falsas:
    quien llega por un enlace tiene que saber qué está mirando. */
export function describir(sel) {
  const partes = [];
  if (sel.q) partes.push(`Texto: «${sel.q}»`);
  for (const [clave, etiqueta] of DIMENSIONES) {
    const v = sel[clave];
    if (v && v.length) partes.push(`${etiqueta}: ${v.join(' o ')}`);
  }
  return partes;
}

/* ═════════════════════════════════════ cortes derivados, por sección ═════ */

/* Catorce de los quince indicadores del sitio se pueden derivar de
   publications.json, así que las secciones también responden al recorte. El
   que no —C-04, instituciones colaboradoras— se declara aparte: la lista de
   nombres de institución no viaja por publicación, y fingir que responde al
   filtro sería peor que decir que no.

   Cada corte declara DE QUÉ CAMPO sale y CÓMO se agrega. Tenerlo en una tabla
   y no repartido por el código es lo que permite comprobar de un vistazo que
   ningún indicador cambió de significado al volverse filtrable. */

// Mismos cortes que `equipo` en src/build/02_indicators.py (C-06): antes esta
// lista tenía sus propios tramos —1,2,3,4–5,6–10,11–20,21 o más—, y el
// gráfico de "Autores por publicación" cambiaba de agrupación entera al
// tocar cualquier filtro (la vista estática usa 1,2–3,4–6,7–10,11–20,21+).
// No es sólo un rótulo distinto: son fronteras de bin distintas, así que un
// mismo valor podía caer en tramos distintos según cuál de las dos versiones
// se estuviera mirando.
const TRAMOS_AUTORES = [
  [1, 1, '1'], [2, 3, '2-3'], [4, 6, '4-6'], [7, 10, '7-10'],
  [11, 20, '11-20'], [21, Infinity, '21+'],
];

/** Campos que no son dimensiones de filtro pero sí ejes de un gráfico. */
export const CAMPOS = {
  fuente:  p => (p.fuente ? [p.fuente] : []),
  paises:  p => p.paises || [],
  instituciones: p => p.instituciones || [],
  asjc:    p => p.asjc || [],
  ods:     p => p.ods || [],
  autores_tramo: p => {
    const n = p.n_autores;
    if (typeof n !== 'number') return [];
    const t = TRAMOS_AUTORES.find(([a, b]) => n >= a && n <= b);
    return t ? [t[2]] : [];
  },
  // El cuartil sale del percentil SJR de la revista. Q1 es el mejor, y el
  // percentil alto es el mejor, así que el corte va de mayor a menor.
  // Sin percentil declarado, cuenta como 'Sin dato declarado' — el mismo
  // quinto valor que ya trae `cuartiles` en 02_indicators.py (R-01). Antes
  // esta rama devolvía [] y la publicación simplemente desaparecía del
  // gráfico reactivo: el de proporcional() es un "parte de un total" del
  // 100 % conocido, así que sin este bucket el corte filtrado se redibujaba
  // como si TODO lo filtrado tuviera cuartil, mientras el sello de cobertura
  // justo debajo (que sí usa cobertura(), más abajo) seguía diciendo el
  // porcentaje real — dos lecturas contradictorias del mismo recorte.
  cuartil: p => {
    const q = p.sjr_percentil;
    if (typeof q !== 'number') return ['Sin dato declarado'];
    return [q >= 75 ? 'Q1' : q >= 50 ? 'Q2' : q >= 25 ? 'Q3' : 'Q4'];
  },
};

const ORDEN_FIJO = {
  autores_tramo: TRAMOS_AUTORES.map(t => t[2]),
  cuartil: ['Q1', 'Q2', 'Q3', 'Q4', 'Sin dato declarado'],
};

/** Recuento por un campo cualquiera —dimensión de filtro o eje de gráfico—. */
export function porCampo(pubs_sel, clave, { tope = 0 } = {}) {
  const saca = EXTRAE[clave] || CAMPOS[clave];
  if (!saca) return [];
  const cuenta = new Map();
  for (const p of pubs_sel) {
    for (const v of saca(p)) cuenta.set(String(v), (cuenta.get(String(v)) || 0) + 1);
  }
  let filas = [...cuenta].map(([valor, n]) => ({ valor, n }));
  const fijo = ORDEN_FIJO[clave];
  if (fijo) {
    // Un tramo vacío se DIBUJA en cero, no desaparece: en una distribución, un
    // hueco que se salta miente sobre la forma de la curva.
    filas = fijo.map(v => ({ valor: v, n: cuenta.get(v) || 0 }));
  } else if (clave === 'anio') {
    filas.sort((a, b) => a.valor.localeCompare(b.valor));
  } else {
    filas.sort((a, b) => b.n - a.n || a.valor.localeCompare(b.valor));
  }
  return tope ? filas.slice(0, tope) : filas;
}

/** Cobertura de un campo dentro del recorte: cuántas publicaciones lo traen.

    NO se deriva sumando las barras del gráfico. En los campos multivaluados
    —países, instituciones, ASJC— una publicación aporta a varias barras y la
    suma pasa del total: un sello construido así publicaría coberturas por
    encima del 100 %. Aquí se cuenta la publicación, no sus valores. */
/* Los tres cortes numéricos no pasan por un extractor de valores: se dibujan
   desde `sumaPorAnio`, `medianaPorAnio` y `umbralesPercentil`. Su cobertura es
   cuántas publicaciones traen ese número — 816 de 823, no 823 —. El corte
   `percentil` lee `percentil_citacion`, que es como se llama el campo. */
const NUMERICO = { citas: 'citas', fwci: 'fwci', percentil: 'percentil_citacion' };

export function cobertura(pubs_sel, clave) {
  const n = pubs_sel.length;
  const pct = cub => (n ? Math.round(1000 * cub / n) / 10 : null);
  const campo = NUMERICO[clave];
  if (campo) {
    const cub = pubs_sel.filter(p => typeof p[campo] === 'number').length;
    return { n, cubiertas: cub, pct: pct(cub) };
  }
  const saca = EXTRAE[clave] || CAMPOS[clave];
  // Sin extractor NO se afirma cobertura. Devolver el total publicaría un
  // 100 % inventado, y un sello que miente es peor que ningún sello.
  if (!saca) return { n, cubiertas: null, pct: null };
  let cub = 0;
  // `CAMPOS.cuartil` devuelve `['Sin dato declarado']` en vez de `[]` para
  // que el gráfico "parte de un total" (proporcional()) muestre el 100 % real
  // del recorte en vez de desaparecer las publicaciones sin percentil — mismo
  // criterio que `02_indicators.py` (R-01: la lista de barras SÍ trae el
  // bucket, la cobertura publicada NO lo cuenta). Por eso el sello, que mide
  // cobertura y no reparto, sigue excluyéndolo aquí.
  for (const p of pubs_sel) {
    const v = saca(p);
    if (v.length && !(v.length === 1 && v[0] === 'Sin dato declarado')) cub++;
  }
  return { n, cubiertas: cub, pct: pct(cub) };
}


/** Suma de un campo numérico, agrupada por año. */
export function sumaPorAnio(pubs_sel, campo) {
  const acc = new Map();
  for (const p of pubs_sel) {
    if (typeof p[campo] !== 'number') continue;
    acc.set(String(p.anio), (acc.get(String(p.anio)) || 0) + p[campo]);
  }
  return [...acc].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([anio, n]) => ({ anio, n }));
}

/** Mediana de un campo numérico, agrupada por año.

    MEDIANA y no media, y no es un detalle: la distribución del FWCI es
    asimétrica —unas pocas publicaciones muy citadas tiran del promedio— y
    sobre el recorte de una facultad o un año la media miente más todavía. */
export function medianaPorAnio(pubs_sel, campo) {
  const grupos = new Map();
  for (const p of pubs_sel) {
    if (typeof p[campo] !== 'number') continue;
    if (!grupos.has(String(p.anio))) grupos.set(String(p.anio), []);
    grupos.get(String(p.anio)).push(p[campo]);
  }
  return [...grupos].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([anio, xs]) => ({ anio, valor: mediana(xs) }));
}

/** Umbrales de percentil de citación. Son ANIDADOS: lo que está en el top 1 %
    está también en el top 5, el 10 y el 25. Se devuelven como tales para que
    el gráfico no invite a sumarlos. */
export function umbralesPercentil(pubs_sel) {
  const v = pubs_sel.map(p => p.percentil_citacion).filter(x => typeof x === 'number');
  return {
    base: v.length,
    datos: [1, 5, 10, 25].map(u => ({ valor: `Top ${u} %`, n: v.filter(x => x <= u).length })),
  };
}
