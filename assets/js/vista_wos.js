/* vista_wos.js — la página del lente Web of Science (D-814, D-821).

   Marcado puro, sin DOM, como vista.js: lo usan el navegador (paginas.js) y el
   pre-renderizado (src/build/prerender.mjs) con el mismo `lente_wos.json`.

   QUÉ MUESTRA Y QUÉ NO
   El análisis con los datos de Web of Science solamente. Ninguna cifra de esta
   página se pone junto a una de Scopus/SciVal ni se combina con ella: la
   comparación entre lentes es otra cosa (fase 3) y tiene su propio método. Por
   eso aquí no hay filtros: el explorador recorta publications.json, que es el
   lente Scopus/SciVal, y aplicarlo a esta página mezclaría las dos bases.

   La base se declara una vez, arriba (fuente, export, corpus y base de
   impacto), y cada figura dice sobre qué se cuenta. Como en el resto del
   informe, la figura lleva su «Qué muestra» (docs/LECTURAS.md) y la remisión a
   su nota metodológica en el anexo (D-754), no un sello propio. */

import * as c from './core.js';

const e = c.escapar;

/* Las figuras del lente, en orden de lectura. `cod` es la clave de su lectura
   en docs/LECTURAS.md: la compuerta de 04_glossary.py lee esta tabla y exige
   una lectura para cada una, igual que con los cortes del explorador. */
export const FIGURAS_WOS = [
  { cod: 'W-P02', bloque: 'produccion', titulo: 'Producción anual', forma: 'barrasV', x: 'anio', y: 'n' },
  { cod: 'W-P03', bloque: 'produccion', titulo: 'Tipo documental', forma: 'barrasH' },
  { cod: 'W-P09', bloque: 'produccion', titulo: 'Índice de Web of Science', forma: 'barrasH', multi: true },
  { cod: 'W-P08', bloque: 'produccion', titulo: 'Idioma', forma: 'barrasH' },
  { cod: 'W-I09', bloque: 'impacto', titulo: 'Mediana de citas por año de publicación', forma: 'barrasV', x: 'anio', y: 'valor', dec: 1 },
  { cod: 'W-I08', bloque: 'impacto', titulo: 'Distribución de citas', forma: 'barrasV', x: 'valor', y: 'n' },
  { cod: 'W-I07', bloque: 'impacto', titulo: 'Publicaciones más citadas', forma: 'tabla' },
  { cod: 'W-I10', bloque: 'impacto', titulo: 'Publicaciones altamente citadas (ESI)', forma: 'tabla' },
  { cod: 'W-C03', bloque: 'colaboracion', titulo: 'Países en las direcciones', forma: 'barrasH', multi: true },
  { cod: 'W-C04', bloque: 'colaboracion', titulo: 'Organizaciones colaboradoras', forma: 'barrasH', multi: true },
  { cod: 'W-T01', bloque: 'tematica', titulo: 'Categorías de Web of Science', forma: 'barrasH', multi: true },
  { cod: 'W-T02', bloque: 'tematica', titulo: 'Áreas de investigación', forma: 'barrasH', multi: true },
  { cod: 'W-T06', bloque: 'tematica', titulo: 'Palabras clave de autor más frecuentes', forma: 'barrasH' },
  { cod: 'W-A01', bloque: 'acceso', titulo: 'Vías de acceso abierto', forma: 'barrasH', multi: true },
];

/* Las cifras de cabecera, con la clave de su lectura. Se declaran igual que
   las figuras, así que la compuerta también les exige una. */
export const CIFRAS_WOS = [
  { cod: 'W-P01', etiqueta: 'Registros en el lente' },
  { cod: 'W-I01', etiqueta: 'Citas en Web of Science' },
  { cod: 'W-I02', etiqueta: 'Citas por publicación' },
  { cod: 'W-C01', etiqueta: 'Colaboración internacional' },
  { cod: 'W-I10', etiqueta: 'Altamente citados (ESI)' },
  { cod: 'W-X03', etiqueta: 'Declaran financiamiento' },
];

/* El ancho de la hoja impresa, el mismo que usa el explorador
   (vista_explorador.js → ANCHO_PAPEL). */
export const ANCHO_PAPEL = 680;

const BLOQUES = [
  ['produccion', 'Producción'],
  ['impacto', 'Impacto'],
  ['colaboracion', 'Colaboración'],
  ['tematica', 'Áreas temáticas'],
  ['acceso', 'Acceso abierto y financiamiento'],
];

/* Sobre qué se cuenta cada figura, en una frase: la base de impacto o el
   corpus entero, con su número. */
function base(x, d) {
  return x.denominador === 'wos_base_impacto'
    ? `Sobre las ${c.nf.format(d.wos_base_impacto)} obras de investigación del lente.`
    : `Sobre los ${c.nf.format(d.wos_lente_total)} registros del lente.`;
}

function lectura(cod, lecturas) {
  const l = (lecturas || {})[cod];
  return l ? `<p class="lectura-grafico"><b>Qué muestra</b> ${e(l.muestra)}</p>` : '';
}

function notaAnexo(cod, x) {
  return x.advertencia
    ? `<p class="nota-anexo"><a href="metodologia.html#ind-${e(cod)}">Nota
      metodológica en el anexo · ${e(cod)}</a></p>` : '';
}

function tablaObras(filas, vacio) {
  if (!filas || !filas.length) return `<p class="vacio">${e(vacio)}</p>`;
  return `<div class="tabla-envoltura tabla-datos"><table>
    <thead><tr><th scope="col" class="num">#</th><th scope="col">Título</th>
      <th scope="col">Fuente</th><th scope="col" class="num">Año</th>
      <th scope="col" class="num">Citas en WoS</th></tr></thead>
    <tbody>${filas.map((p, i) => `<tr><td class="num">${i + 1}</td>
      <td>${p.doi ? `<a href="https://doi.org/${e(p.doi)}" rel="noopener">${e(p.titulo)}</a>` : e(p.titulo)}</td>
      <td>${c.celda(p.fuente)}</td><td class="num">${c.anio(p.anio)}</td>
      <td class="num">${p.citas === null || p.citas === undefined ? '—' : c.nf.format(p.citas)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/* Los índices de WoS tienen nombres de producto largos («Science Citation
   Index Expanded (SCI-EXPANDED)») que la columna de etiquetas corta por la
   mitad. Se dibujan por su sigla —la que el propio nombre trae entre
   paréntesis— y la clave completa va debajo de la figura. */
const SIGLA_INDICE = /\(([^()]+)\)\s*$/;
export function siglasIndices(datos) {
  const clave = [];
  const filas = datos.map(r => {
    const m = String(r.valor).match(SIGLA_INDICE);
    if (!m) return r;
    clave.push([m[1], String(r.valor).replace(SIGLA_INDICE, '').trim()]);
    return { ...r, valor: m[1] };
  });
  return { filas, clave };
}

/** El SVG de una figura de barras, al ancho pedido (o al de diseño). */
function dibujar(f, x, ancho) {
  if (f.forma === 'barrasV') {
    const datos = (x.datos || []).filter(r => r[f.y] !== null && r[f.y] !== undefined);
    return c.barrasV(datos, { etiquetaX: f.x, etiquetaY: f.y, decimales: f.dec || 0, titulo: f.titulo,
      ...(ancho ? { ancho } : {}) });
  }
  const filas = f.cod === 'W-P09' ? siglasIndices(x.datos || []).filas : (x.datos || []);
  return c.barrasH(filas, { titulo: f.titulo, trama: !!f.multi, ...(ancho ? { ancho } : {}) });
}

/** Redibuja al ancho de su tarjeta las figuras que no estén a escala 1:1,
    como `ajustarGraficos()` del explorador: un lienzo de 680 dentro de una
    columna de 390 reduce el texto a la mitad. Devuelve cuántas rehizo. */
export function ajustarGraficos(zona, datos, { ancho: forzado } = {}) {
  if (!zona || !datos || !datos.disponible) return 0;
  let hechos = 0;
  for (const caja of zona.querySelectorAll('.grafico[data-lienzo]')) {
    const ancho = forzado || caja.clientWidth;
    const vb = caja.querySelector('svg.chart')?.viewBox.baseVal.width;
    if (!ancho || !vb || Math.abs(vb - ancho) <= 8) continue;
    const f = FIGURAS_WOS.find(x => x.cod === caja.dataset.lienzo);
    const x = f && datos.indicadores[f.cod];
    if (!x) continue;
    caja.innerHTML = dibujar(f, x, ancho);
    hechos++;
  }
  return hechos;
}

function figura(f, ind, d, lecturas) {
  const x = ind[f.cod];
  if (!x) return '';
  let cuerpo;
  let claveSiglas = '';
  if (f.forma === 'tabla') {
    cuerpo = tablaObras(x.filas, f.cod === 'W-I10'
      ? 'Ningún registro del lente lleva la marca de altamente citado.'
      : 'Ninguna obra de investigación con citas en el lente.');
  } else {
    cuerpo = dibujar(f, x);
    if (f.cod === 'W-P09') {
      const { clave } = siglasIndices(x.datos || []);
      claveSiglas = clave.length ? `<p class="nota-figura">${clave.map(([s, n]) =>
        `<b>${e(s)}</b>: ${e(n)}`).join(' · ')}.</p>` : '';
    }
  }
  const tope = x.total && x.datos && x.total > x.datos.length
    ? `<p class="nota-figura">Se muestran los ${c.nf.format(x.datos.length)} más frecuentes de
      ${c.nf.format(x.total)}.</p>` : '';
  return `<section class="corte" id="${e(f.cod)}" data-corte="${e(f.cod)}">
    <header class="corte-cab"><h3>${e(f.titulo)}</h3></header>
    <div class="grafico"${f.forma === 'tabla' ? '' : ` data-lienzo="${e(f.cod)}"`}>${cuerpo}</div>
    ${f.multi ? '<p class="leyenda-trama nota-figura">Barras rayadas: no son partes de un total y no suman.</p>' : ''}
    ${claveSiglas}
    ${tope}
    <p class="nota-figura">${e(base(x, d))}</p>
    ${lectura(f.cod, lecturas)}
    ${notaAnexo(f.cod, x)}
  </section>`;
}

function kpi(valor, etiqueta, secundario) {
  return `<article class="kpi"><div class="valor">${valor}</div>
    <div class="etiqueta">${e(etiqueta)}</div>
    ${secundario ? `<div class="secundario">${e(secundario)}</div>` : ''}</article>`;
}

/** La página entera. `datos` es lente_wos.json; `lecturas`, el mapa de
    lecturas.json. */
export function lenteWos(datos, lecturas = {}) {
  if (!datos || !datos.disponible) {
    return `<p class="nota">Esta compilación no incluye el lente Web of Science.
      ${datos && datos.motivo ? e(datos.motivo) : ''}</p>`;
  }
  const d = datos.denominadores;
  const i = datos.indicadores;
  const comp = datos.composicion;
  const f = datos.fuente || {};
  const fecha = f.fecha_export ? c.fechaLarga(f.fecha_export) : 'sin fecha declarada';

  const ficha = `<dl class="ficha-datos ficha-lente">
    <div><dt>Base</dt><dd>${e(f.nombre || 'Web of Science Core Collection')}</dd></div>
    <div><dt>Export</dt><dd>${e(fecha)}. Web of Science no declara fecha de corte:
      las citas son las de ese día.</dd></div>
    <div><dt>Corpus del lente</dt><dd>${c.nf.format(d.wos_lente_total)} registros:
      ${c.nf.format(comp.misma_obra_que_scopus)} también en Scopus,
      ${c.nf.format(comp.solo_wos)} solo en Web of Science
      ${comp.en_revision ? `y ${c.nf.format(comp.en_revision)} cuya correspondencia con Scopus espera revisión` : ''}.</dd></div>
    <div><dt>Base de impacto</dt><dd>${c.nf.format(d.wos_base_impacto)} obras de investigación;
      ${c.nf.format(i['W-P01'].desglose.otros)} otros documentos (cartas, editoriales,
      resúmenes de congreso, reseñas) cuentan en la producción y no en el impacto.</dd></div>
  </dl>`;

  const c01 = i['W-C01'];
  const kpis = `<div class="kpis" data-n="6">
    ${kpi(c.nf.format(i['W-P01'].valor), 'Registros en el lente', 'Producción en Web of Science')}
    ${kpi(c.nf.format(i['W-I01'].valor), 'Citas en Web of Science', `Sobre ${c.nf.format(d.wos_base_impacto)} obras de investigación`)}
    ${kpi(c.num(i['W-I02'].valor, 2), 'Citas por publicación',
      i['W-I02'].mediana === null ? '' : `Mediana ${c.num(i['W-I02'].mediana, 1)}`)}
    ${kpi(c01.valor === null ? '—' : `${c.num(c01.valor, 1)} %`, 'Colaboración internacional',
      `${c.nf.format(c01.n)} de ${c.nf.format(c01.base)} registros con país`)}
    ${kpi(c.nf.format(i['W-I10'].valor), 'Altamente citados (ESI)', 'Marca de Essential Science Indicators')}
    ${kpi(c.nf.format(i['W-X03'].valor), 'Declaran financiamiento',
      i['W-X03'].pct === null ? '' : `${c.num(i['W-X03'].pct, 1)} % del lente; no equivale a financiadas`)}
  </div>
  <dl class="ficha-datos lecturas-cifras">${CIFRAS_WOS.filter(k => (lecturas || {})[k.cod]).map(k =>
    `<div><dt>${e(k.etiqueta)}</dt><dd>${e(lecturas[k.cod].muestra)}</dd></div>`).join('')}</dl>`;

  const bloques = BLOQUES.map(([clave, titulo]) => {
    const figs = FIGURAS_WOS.filter(x => x.bloque === clave).map(x => figura(x, i, d, lecturas)).join('');
    const extra = clave === 'acceso'
      ? `<p class="nota">El ranking de financiadores no se publica: Web of Science trae
        sus nombres sin unificar, y contarlos así repartiría un mismo financiador en
        varias filas. ${notaAnexo('W-X03', i['W-X03'])}</p>` : '';
    return `<section class="modulo bloque-lente" aria-labelledby="wos-${clave}">
      <header><div class="modulo-id"><h2 id="wos-${clave}">${e(titulo)}</h2></div></header>
      <div class="cortes-lente">${figs}</div>${extra}
    </section>`;
  }).join('');

  const noCalc = (datos.no_calculables || []).length ? `<section class="modulo">
    <header><div class="modulo-id"><h2>Lo que este lente no puede calcular</h2></div></header>
    <ul class="lista-no-calculables">${datos.no_calculables.map(n => `<li><b>${e(n.nombre)}.</b>
      ${e(n.razon)} Lo destrabaría: ${e(n.que_falta)}</li>`).join('')}</ul>
    <p class="nota">Se declaran en vez de estimarse: ninguno se aproxima con otra métrica.</p>
  </section>` : '';

  return ficha + kpis + bloques + noCalc;
}
