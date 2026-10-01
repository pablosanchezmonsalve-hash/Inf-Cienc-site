/* vista_comparacion.js — la página «Comparación entre bases» (D-814, D-825).

   Marcado puro, sin DOM, como vista.js y vista_wos.js: lo usan el navegador
   (paginas.js) y el pre-renderizado (prerender.mjs) con el mismo
   `comparacion_lentes.json`.

   Compara las dos bases COMO BASES: qué obras indexa cada una, de qué tipo son
   las que solo una indexa, cuánto difieren las citas de la misma obra y dónde
   no coinciden el año o el tipo. Ninguna cifra combina las dos en un valor
   único: las citas de cada base se leen lado a lado (D-792). La única cifra
   que usa ambas es la unión, que cuenta obras distintas y no mide nada de
   ellas. */

import * as c from './core.js';
import { siglasIndices } from './vista_wos.js';

const e = c.escapar;

/* Las figuras, en orden de lectura. `cod` es la clave de su lectura en
   docs/LECTURAS.md: la compuerta de 04_glossary.py exige una por figura. */
export const FIGURAS_CL = [
  { cod: 'CL-01', titulo: 'Qué obras indexa cada base', forma: 'barrasH' },
  { cod: 'CL-01-anio', titulo: 'Cobertura por año de publicación', forma: 'tabla' },
  { cod: 'CL-02-scopus', titulo: 'Tipo documental de lo que solo indexa Scopus', forma: 'barrasH' },
  { cod: 'CL-02-wos', titulo: 'Tipo documental de lo que solo indexa Web of Science', forma: 'barrasH' },
  { cod: 'CL-02-indices', titulo: 'Índice de Web of Science de lo que solo indexa esa base', forma: 'barrasH', multi: true },
  { cod: 'CL-02-idiomas', titulo: 'Idioma de lo que indexa solo cada base', forma: 'tabla' },
  { cod: 'CL-03', titulo: 'Citas de una misma obra en las dos bases', forma: 'barrasH' },
  { cod: 'CL-04', titulo: 'Conflictos de tipo documental entre bases', forma: 'tabla' },
];

export const ANCHO_PAPEL = 680;

/** Los datos de barras de una figura. */
function datosDe(cod, i) {
  const c1 = i['CL-01'], c2 = i['CL-02'], c3 = i['CL-03'];
  switch (cod) {
    case 'CL-01': return [
      { valor: 'Solo en Scopus', n: c1.solo_scopus },
      { valor: 'En ambas bases', n: c1.ambas },
      { valor: 'Solo en Web of Science', n: c1.solo_wos }];
    case 'CL-02-scopus': return c2.solo_scopus.tipos;
    case 'CL-02-wos': return c2.solo_wos.tipos;
    case 'CL-02-indices': return siglasIndices(c2.solo_wos.indices || []).filas;
    case 'CL-03': return [
      { valor: 'Más citas en SciVal', n: c3.mas_en_scival },
      { valor: 'Las mismas citas', n: c3.iguales },
      { valor: 'Más citas en Web of Science', n: c3.mas_en_wos }];
    default: return [];
  }
}

function dibujar(f, i, ancho) {
  return c.barrasH(datosDe(f.cod, i), { titulo: f.titulo, trama: !!f.multi, ...(ancho ? { ancho } : {}) });
}

/** Redibuja al ancho de su tarjeta las figuras que no estén a escala 1:1. */
export function ajustarGraficos(zona, datos, { ancho: forzado } = {}) {
  if (!zona || !datos || !datos.disponible) return 0;
  let hechos = 0;
  for (const caja of zona.querySelectorAll('.grafico[data-lienzo]')) {
    const ancho = forzado || caja.clientWidth;
    const vb = caja.querySelector('svg.chart')?.viewBox.baseVal.width;
    if (!ancho || !vb || Math.abs(vb - ancho) <= 8) continue;
    const f = FIGURAS_CL.find(x => x.cod === caja.dataset.lienzo);
    if (!f) continue;
    caja.innerHTML = dibujar(f, datos.indicadores, ancho);
    hechos++;
  }
  return hechos;
}

const nf = (n) => (n === null || n === undefined ? '—' : c.nf.format(n));
const dec = (n, d = 1) => (n === null || n === undefined ? '—' : c.num(n, d));

function tabla(f, i) {
  if (f.cod === 'CL-01-anio') {
    const filas = i['CL-01'].por_anio;
    return `<div class="tabla-envoltura tabla-datos"><table>
      <thead><tr><th scope="col">Año</th><th scope="col" class="num">Solo en Scopus</th>
        <th scope="col" class="num">En ambas</th><th scope="col" class="num">Solo en Web of Science</th>
        <th scope="col" class="num">Unión</th><th scope="col" class="num">En ambas (% de la unión)</th></tr></thead>
      <tbody>${filas.map(r => {
        const t = r.solo_scopus + r.ambas + r.solo_wos;
        return `<tr><td>${c.anio(r.anio)}</td><td class="num">${nf(r.solo_scopus)}</td>
          <td class="num">${nf(r.ambas)}</td><td class="num">${nf(r.solo_wos)}</td>
          <td class="num">${nf(t)}</td><td class="num">${t ? `${dec(100 * r.ambas / t)} %` : '—'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }
  if (f.cod === 'CL-02-idiomas') {
    const s = i['CL-02'].solo_scopus.idiomas, w = i['CL-02'].solo_wos.idiomas;
    const claves = [...new Set([...s, ...w].map(x => x.valor))];
    const de = (lista, k) => (lista.find(x => x.valor === k) || { n: 0 }).n;
    claves.sort((a, b) => (de(s, b) + de(w, b)) - (de(s, a) + de(w, a)) || a.localeCompare(b, 'es'));
    return `<div class="tabla-envoltura tabla-datos"><table>
      <thead><tr><th scope="col">Idioma</th><th scope="col" class="num">Solo en Scopus</th>
        <th scope="col" class="num">Solo en Web of Science</th></tr></thead>
      <tbody>${claves.map(k => `<tr><td>${e(k)}</td><td class="num">${nf(de(s, k))}</td>
        <td class="num">${nf(de(w, k))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (f.cod === 'CL-04') {
    const c4 = i['CL-04'];
    if (!c4.pares_tipo.length) return '<p class="vacio">Ningún conflicto de tipo documental que no sea de nomenclatura.</p>';
    return `<div class="tabla-envoltura tabla-datos"><table>
      <thead><tr><th scope="col">Tipo en Scopus</th><th scope="col">Tipo en Web of Science</th>
        <th scope="col" class="num">Obras</th></tr></thead>
      <tbody>${c4.pares_tipo.map(r => `<tr><td>${e(r.scopus)}</td><td>${e(r.wos)}</td>
        <td class="num">${nf(r.n)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  return '';
}

/* Lo que cada figura dice en una frase, con sus cifras. Descriptivo: ni
   «mejor» ni «peor» cobertura, solo cuánto y de qué. */
function resumen(cod, i) {
  const c1 = i['CL-01'], c2 = i['CL-02'], c3 = i['CL-03'], c4 = i['CL-04'];
  switch (cod) {
    case 'CL-01': return `De las ${nf(c1.union)} obras de la unión, ${nf(c1.ambas)} están en las dos bases,
      ${nf(c1.solo_scopus)} solo en Scopus y ${nf(c1.solo_wos)} solo en Web of Science. El
      ${dec(c1.pct_scopus_en_wos)} % del lente Scopus/SciVal está también en Web of Science, y el
      ${dec(c1.pct_wos_en_scopus)} % del lente Web of Science está también en Scopus.`
      + (c1.wos_en_revision === 1 ? ' Otro registro de Web of Science espera revisión para saber si es la'
        + ' misma obra que una de Scopus: no entra en ningún grupo.'
        : c1.wos_en_revision ? ` Otros ${nf(c1.wos_en_revision)} registros de Web of Science esperan revisión
      para saber si son la misma obra que una de Scopus: no entran en ningún grupo.` : '');
    case 'CL-02-wos': {
      const g = c1.por_grupo.solo_wos;
      return `De las ${nf(c1.solo_wos)} obras que solo indexa Web of Science, ${nf(g.investigacion)} son de
        investigación y ${nf(g.otros)} otros documentos.`
        + (c2.solo_wos_citas.con_dato ? ` En Web of Science, ${nf(c2.solo_wos_citas.sin_citas)} de ellas
        no tienen citas y la mediana es ${dec(c2.solo_wos_citas.mediana)}.` : '');
    }
    case 'CL-02-scopus': {
      const g = c1.por_grupo.solo_scopus;
      return `De las ${nf(c1.solo_scopus)} obras que solo indexa Scopus, ${nf(g.investigacion)} son de
        investigación y ${nf(g.otros)} otros documentos.`;
    }
    case 'CL-03': return c3.pares ? `Sobre ${nf(c3.pares)} obras de investigación presentes en las dos
      bases con un solo registro en cada una. Mediana de citas: ${dec(c3.mediana_scival)} en SciVal y
      ${dec(c3.mediana_wos)} en Web of Science, cada una en su base; la mediana de la diferencia por obra
      (SciVal menos WoS) es ${dec(c3.mediana_diferencia)}. Correlación de rangos entre las dos:
      ${c3.correlacion_rangos === null ? '—' : c.num(c3.correlacion_rangos, 2)}.`
      + (c3.excluidos_no_uno_a_uno ? ` Quedan fuera ${nf(c3.excluidos_no_uno_a_uno)} registros de obras
      con más de un registro en Web of Science: compararlos exigiría elegir uno.` : '')
      : 'No hay obras presentes en las dos bases con citas en ambas.';
    case 'CL-04': return `${nf(c4.conflictos_anio)} obras tienen un año distinto en cada base y
      ${nf(c4.conflictos_tipo)} un tipo documental distinto. De estas, ${nf(c4.solo_nomenclatura)} son
      solo de nomenclatura —el mismo tipo con otro nombre— y ${nf(c4.tipo_distinto)} son tipos distintos;
      ${nf(c4.cambian_grupo)} cambian el grupo documental, y con él si la obra entra a la base de impacto
      de cada lente.`;
    default: return '';
  }
}

function figura(f, datos, lecturas) {
  const i = datos.indicadores;
  const cuerpo = f.forma === 'tabla' ? tabla(f, i)
    : `<div class="grafico" data-lienzo="${e(f.cod)}">${dibujar(f, i)}</div>`;
  const clave = f.cod === 'CL-02-indices' ? siglasIndices(i['CL-02'].solo_wos.indices || []).clave : [];
  const l = (lecturas || {})[f.cod];
  const ind = f.cod.slice(0, 5);
  const txt = resumen(f.cod, i);
  return `<section class="corte" id="${e(f.cod)}" data-corte="${e(f.cod)}">
    <header class="corte-cab"><h3>${e(f.titulo)}</h3></header>
    ${cuerpo}
    ${f.multi ? '<p class="leyenda-trama nota-figura">Barras rayadas: no son partes de un total y no suman.</p>' : ''}
    ${clave.length ? `<p class="nota-figura">${clave.map(([s, n]) => `<b>${e(s)}</b>: ${e(n)}`).join(' · ')}.</p>` : ''}
    ${txt ? `<p class="nota-figura">${e(txt.replace(/\s+/g, ' ').trim())}</p>` : ''}
    ${l ? `<p class="lectura-grafico"><b>Qué muestra</b> ${e(l.muestra)}</p>` : ''}
    ${i[ind] && i[ind].advertencia ? `<p class="nota-anexo"><a href="metodologia.html#ind-${e(ind)}">Nota
      metodológica en el anexo · ${e(ind)}</a></p>` : ''}
  </section>`;
}

const BLOQUES = [
  ['cobertura', 'Cobertura y solapamiento', ['CL-01', 'CL-01-anio']],
  ['exclusivas', 'Qué indexa solo cada base', ['CL-02-scopus', 'CL-02-wos', 'CL-02-indices', 'CL-02-idiomas']],
  ['citas', 'Citas de una misma obra', ['CL-03']],
  ['conflictos', 'Conflictos de año y de tipo', ['CL-04']],
];

/** La página entera. */
export function comparacion(datos, lecturas = {}) {
  if (!datos || !datos.disponible) {
    return `<p class="nota">Esta compilación no incluye Web of Science: no hay dos bases que comparar.</p>`;
  }
  const f = datos.fuentes || {};
  const fecha = (x) => (x ? c.fechaLarga(x) : 'sin fecha declarada');
  const ficha = `<dl class="ficha-datos ficha-lente">
    <div><dt>Scopus · SciVal</dt><dd>Citas de SciVal al ${e(fecha(f['Scopus · SciVal']))}.</dd></div>
    <div><dt>Web of Science</dt><dd>Export del ${e(fecha(f['Web of Science']))}; las citas son las de ese día.</dd></div>
    <div><dt>Regla</dt><dd>Ninguna cifra de esta página combina las dos bases en un valor único. La unión
      cuenta obras distintas; las citas de cada base se leen lado a lado.</dd></div>
  </dl>`;
  const porCod = Object.fromEntries(FIGURAS_CL.map(x => [x.cod, x]));
  const bloques = BLOQUES.map(([id, titulo, cods]) => `<section class="modulo bloque-lente" aria-labelledby="cl-${id}">
    <header><div class="modulo-id"><h2 id="cl-${id}">${e(titulo)}</h2></div></header>
    <div class="cortes-lente">${cods.map(k => figura(porCod[k], datos, lecturas)).join('')}</div>
  </section>`).join('');
  return ficha + bloques;
}
