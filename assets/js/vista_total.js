/* vista_total.js — la página «Total de publicaciones» (T-33, D-835).

   Marcado puro, sin DOM, como vista_comparacion.js: lo usan el navegador
   (paginas.js) y el pre-renderizado (prerender.mjs) con el mismo
   `total_publicaciones.json`.

   Cuenta las obras distintas de las dos bases juntas: las de Scopus y SciVal y
   las que solo indexa Web of Science. Es la única página que suma las dos
   bases, y solo suma OBRAS: ninguna cita ni métrica de una base se combina con
   las de la otra (D-814). El lente Scopus, en las demás páginas, cuenta solo lo
   de Scopus y SciVal. */

import * as c from './core.js';

const e = c.escapar;

/* Las figuras, en orden de lectura. `cod` es la clave de su lectura en
   docs/LECTURAS.md: la compuerta de 04_glossary.py exige una por figura. */
export const FIGURAS_PT = [
  { cod: 'PT-01', titulo: 'De qué base viene cada obra', forma: 'proporcional' },
  { cod: 'PT-02', titulo: 'Obras por año de publicación', forma: 'barrasV' },
  { cod: 'PT-02-anio', titulo: 'Obras por año y base', forma: 'tabla' },
  { cod: 'PT-03', titulo: 'Tipo documental', forma: 'barrasH' },
  { cod: 'PT-04', titulo: 'Obras que solo indexa Web of Science', forma: 'tabla' },
];

export const ANCHO_PAPEL = 680;

const nf = (n) => (n === null || n === undefined ? '—' : c.nf.format(n));
const dec = (n, d = 1) => (n === null || n === undefined ? '—' : c.num(n, d));
const pct = (n, t) => (t ? dec((100 * n) / t) : '—');

function datosDe(cod, i) {
  const p1 = i['PT-01'];
  switch (cod) {
    case 'PT-01': return [
      { valor: 'Solo en Scopus', n: p1.solo_scopus },
      { valor: 'En las dos bases', n: p1.ambas },
      { valor: 'Solo en Web of Science', n: p1.solo_wos }];
    case 'PT-02': return i['PT-02'].por_anio.map(r => ({ anio: r.anio, n: r.total }));
    case 'PT-03': return i['PT-03'].tipos.map(t => ({ valor: t.valor, n: t.n }));
    default: return [];
  }
}

function dibujar(f, i, ancho) {
  const op = { titulo: f.titulo, ...(ancho ? { ancho } : {}) };
  if (f.forma === 'proporcional') return c.proporcional(datosDe(f.cod, i), op);
  if (f.forma === 'barrasV') return c.barrasV(datosDe(f.cod, i), op);
  return c.barrasH(datosDe(f.cod, i), op);
}

/** Redibuja al ancho de su tarjeta las figuras que no estén a escala 1:1. */
export function ajustarGraficos(zona, datos, { ancho: forzado } = {}) {
  if (!zona || !datos || !datos.disponible) return 0;
  let hechos = 0;
  for (const caja of zona.querySelectorAll('.grafico[data-lienzo]')) {
    const ancho = forzado || caja.clientWidth;
    const vb = caja.querySelector('svg.chart')?.viewBox.baseVal.width;
    if (!ancho || !vb || Math.abs(vb - ancho) <= 8) continue;
    const f = FIGURAS_PT.find(x => x.cod === caja.dataset.lienzo);
    // barrasV acota su propio ancho al número de años: redibujarla al de la
    // tarjeta la volvería a acotar, así que no se toca.
    if (!f || f.forma === 'barrasV') continue;
    caja.innerHTML = dibujar(f, datos.indicadores, ancho);
    hechos++;
  }
  return hechos;
}

function tabla(f, i) {
  if (f.cod === 'PT-02-anio') {
    return `<div class="tabla-envoltura tabla-datos"><table>
      <thead><tr><th scope="col">Año</th><th scope="col" class="num">Solo en Scopus</th>
        <th scope="col" class="num">En las dos bases</th><th scope="col" class="num">Solo en Web of Science</th>
        <th scope="col" class="num">Total</th></tr></thead>
      <tbody>${i['PT-02'].por_anio.map(r => `<tr><td>${c.anio(r.anio)}</td><td class="num">${nf(r.solo_scopus)}</td>
        <td class="num">${nf(r.ambas)}</td><td class="num">${nf(r.solo_wos)}</td>
        <td class="num">${nf(r.total)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (f.cod === 'PT-04') {
    const filas = i['PT-04'].filas;
    if (!filas.length) return '<p class="vacio">Ninguna obra está solo en Web of Science.</p>';
    return `<div class="tabla-envoltura tabla-datos"><table>
      <thead><tr><th scope="col">Año</th><th scope="col">Título</th><th scope="col">Tipo</th>
        <th scope="col">Fuente</th><th scope="col">UT · DOI</th></tr></thead>
      <tbody>${filas.map(r => `<tr><td>${c.anio(r.anio)}</td><td>${c.celda(r.titulo)}</td>
        <td>${c.celda(r.tipo)}</td><td>${c.celda(r.fuente)}</td>
        <td><span class="mono">${e(r.ut)}</span>${r.doi ? `<br><span class="mono">${e(r.doi)}</span>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  return '';
}

/* Lo que cada figura dice en una frase, con sus cifras. Descriptivo: cuántas
   y de qué base, nunca cuál base «cubre mejor». */
function resumen(cod, i) {
  const p1 = i['PT-01'], p3 = i['PT-03'];
  switch (cod) {
    case 'PT-01': return `${nf(p1.total)} obras distintas: ${nf(p1.solo_scopus)} solo en Scopus
      (${pct(p1.solo_scopus, p1.total)} %), ${nf(p1.ambas)} en las dos bases (${pct(p1.ambas, p1.total)} %) y
      ${nf(p1.solo_wos)} solo en Web of Science (${pct(p1.solo_wos, p1.total)} %). Scopus indexa
      ${nf(p1.en_scopus)} y Web of Science ${nf(p1.en_wos)}.`
      + (p1.wos_en_revision === 1 ? ' Otro registro de Web of Science espera revisión para saber si es la misma'
        + ' obra que una de Scopus: no se cuenta.'
        : p1.wos_en_revision ? ` Otros ${nf(p1.wos_en_revision)} registros de Web of Science esperan revisión
      para saber si son la misma obra que una de Scopus: no se cuentan.` : '');
    case 'PT-02': {
      const a = i['PT-02'].por_anio;
      if (!a.length) return '';
      const max = a.reduce((m, r) => (r.total > m.total ? r : m), a[0]);
      return `De ${nf(a[0].total)} obras en ${c.anio(a[0].anio)} a ${nf(a[a.length - 1].total)} en
        ${c.anio(a[a.length - 1].anio)}; el año con más obras es ${c.anio(max.anio)} (${nf(max.total)}).`;
    }
    case 'PT-03': {
      const g = p3.por_grupo;
      return `${nf(g.investigacion)} obras de investigación y ${nf(g.otros)} otros documentos (cartas, notas,
        editoriales, reseñas, resúmenes de congreso).`
        + (p1.solo_wos_sin_par_scopus ? ` ${nf(p1.solo_wos_sin_par_scopus)} de las que solo indexa Web of Science
        son de tipos que Scopus no indexa como documento.` : '');
    }
    case 'PT-04': return `${nf(p1.solo_wos)} obras que el lente Scopus no cuenta. Sus citas se leen en el lente
      Web of Science.`;
    default: return '';
  }
}

function figura(f, datos, lecturas) {
  const i = datos.indicadores;
  const cuerpo = f.forma === 'tabla' ? tabla(f, i)
    : `<div class="grafico" data-lienzo="${e(f.cod)}">${dibujar(f, i)}</div>`;
  const l = (lecturas || {})[f.cod];
  const ind = f.cod.slice(0, 5);
  const txt = resumen(f.cod, i);
  return `<section class="corte" id="${e(f.cod)}" data-corte="${e(f.cod)}">
    <header class="corte-cab"><h3>${e(f.titulo)}</h3></header>
    ${cuerpo}
    ${txt ? `<p class="nota-figura">${e(txt.replace(/\s+/g, ' ').trim())}</p>` : ''}
    ${l ? `<p class="lectura-grafico"><b>Qué muestra</b> ${e(l.muestra)}</p>` : ''}
    ${i[ind] && i[ind].advertencia ? `<p class="nota-anexo"><a href="metodologia.html#ind-${e(ind)}">Nota
      metodológica en el anexo · ${e(ind)}</a></p>` : ''}
  </section>`;
}

const BLOQUES = [
  ['bases', 'Cuántas obras y de qué base', ['PT-01', 'PT-02', 'PT-02-anio']],
  ['tipos', 'Qué tipo de obras', ['PT-03']],
  ['solo-wos', 'Lo que solo indexa Web of Science', ['PT-04']],
];

/** La página entera. */
export function total(datos, lecturas = {}) {
  if (!datos || !datos.disponible) {
    return `<p class="nota">Esta compilación no incluye Web of Science: el total de publicaciones es el
      universo de Scopus y SciVal que describen las demás páginas.</p>`;
  }
  const f = datos.fuentes || {};
  const p1 = datos.indicadores['PT-01'];
  const fecha = (x) => (x ? c.fechaLarga(x) : 'sin fecha declarada');
  const fuera = p1.opcion_sin_par === 'solo_lente_wos' && p1.solo_lente_wos;
  const ficha = `<dl class="ficha-datos ficha-lente">
    <div><dt>Total</dt><dd>${nf(p1.total)} obras distintas: ${nf(p1.en_scopus)} en Scopus y SciVal, y
      ${nf(p1.solo_wos)} que solo indexa Web of Science.</dd></div>
    <div><dt>Fuentes</dt><dd>Exportación de Scopus y SciVal del ${e(fecha(f['Scopus · SciVal']))}; de Web of
      Science, del ${e(fecha(f['Web of Science']))}. Las obras de las dos bases se cruzan por DOI o por revisión humana.</dd></div>
    <div><dt>Regla</dt><dd>Esta página cuenta obras y nada más: las citas y las métricas de cada base se
      leen en su lente y nunca se suman. Las demás páginas del informe describen solo lo de Scopus y SciVal.</dd></div>
    ${fuera ? `<div><dt>Fuera del total</dt><dd>${nf(p1.solo_lente_wos)} obras de tipos que Scopus no indexa
      (resúmenes de congreso, reseñas) se cuentan solo en el lente Web of Science.</dd></div>` : ''}
    <div><dt>Identificador</dt><dd>Las obras que solo indexa Web of Science se identifican por su UT, el
      identificador de Clarivate, cuyos términos de publicación están pendientes de confirmar.</dd></div>
  </dl>`;
  const porCod = Object.fromEntries(FIGURAS_PT.map(x => [x.cod, x]));
  const bloques = BLOQUES.map(([id, titulo, cods]) => `<section class="modulo bloque-lente" aria-labelledby="pt-${id}">
    <header><div class="modulo-id"><h2 id="pt-${id}">${e(titulo)}</h2></div></header>
    <div class="cortes-lente">${cods.map(k => figura(porCod[k], datos, lecturas)).join('')}</div>
  </section>`).join('');
  return ficha + bloques;
}
