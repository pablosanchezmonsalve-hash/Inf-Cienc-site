/* vista.js — construcción de HTML, sin DOM.

   TODO lo que hay aquí es una función de datos a cadena. Ni una lectura de
   `document`, ni un `addEventListener`, ni un `localStorage`. Esa disciplina
   es la que permite que el mismo código corra en dos sitios:

     · en el BUILD, bajo Node (src/build/prerender.mjs), para dejar el HTML
       ya escrito en dist/*.html;
     · en el NAVEGADOR (paginas.js), cuando hay que repintar tras un filtro.

   Antes esta lógica vivía dentro de los renderizadores de página, mezclada con
   `innerHTML =`. Separarla no es una preferencia de estilo: es la condición
   para que el sitio tenga contenido sin JavaScript sin mantener dos versiones
   del mismo marcado, que es como esas dos versiones acaban divergiendo.

   La INTERACCIÓN —conmutador de vista, scroll-spy, tooltip, filtros— sigue
   viviendo en paginas.js. Aquí solo se emite el marcado que esa interacción
   después manipula. */

import * as c from './core.js';
import * as X from './explorador.js';

/** La cobertura de ORCID de «Advertencias principales», en metodologia.html.

    Una sola redacción para el pre-renderizado y el navegador: eran dos copias
    de la misma cuenta. Y dice fichas, no formas de firma —las 829 son fichas ya
    consolidadas— y cuántos identificadores son de verdad distintos: 268 fichas
    con ORCID son 250 ORCID, porque 17 figuran en más de una ficha a la espera
    de revisión humana (D-44, D-711). */
export function coberturaOrcid(autores) {
  const con = autores.filter(a => a.orcid);
  const distintos = new Set(con.map(a => a.orcid)).size;
  const compartidos = X.orcidCompartidos(autores).size;
  return `${c.nf.format(con.length)} de ${c.nf.format(autores.length)} fichas de autor con ORCID`
    + (compartidos
      ? ` —${c.nf.format(distintos)} identificadores distintos: ${c.nf.format(compartidos)}`
        + ` figuran en más de una ficha y esperan revisión humana—`
      : '');
}

/* La mediana del FWCI frente a su promedio es el dato que más fácilmente se
   malinterpreta: se explicita en portada, no solo en el módulo. Las cifras
   salen de kpis.json; el comentario anterior citaba las de la carga de julio.
   Con las publicaciones se dice además cuánto pesa la de mayor FWCI: en esta
   carga, sin ella el promedio pasa de 1,14 a 0,95 y cruza el promedio mundial,
   y quien cite el promedio sin la nota comunica una conclusión que los datos no
   sostienen (auditoría de fiabilidad del 2026-09-29, recomendación 1). */
export function extremoFwci(pubs) {
  // Sobre la base de I-03 (D-817): con métricas y de investigación.
  const con = (pubs || []).filter(p => X.enBaseImpacto(p) && typeof p.fwci === 'number');
  if (con.length < 2) return null;
  const mayor = con.reduce((m, p) => (p.fwci > m.fwci ? p : m));
  const suma = con.reduce((s, p) => s + p.fwci, 0);
  return { fwci: mayor.fwci, citas: mayor.citas, sinEl: (suma - mayor.fwci) / (con.length - 1) };
}

/* La columna «Observado» de las reglas llega del auditor en Python, con punto
   decimal («64.2 %»). Se muestra con coma, como el resto del informe; solo los
   porcentajes, para no tocar identificadores como «2-s2.0-…» (recomendación 4
   de la auditoría de fiabilidad). */
export function observado(texto) {
  return c.escapar(texto).replace(/(\d)\.(\d+)(?=\s?%)/g, '$1,$2');
}

export function lectura(kpisLista, pubs) {
  const fwci = kpisLista.find(k => k.codigo === 'I-03');
  if (!fwci) return '';
  const ext = extremoFwci(pubs);
  const cruza = ext && (fwci.valor >= 1) !== (ext.sinEl >= 1);
  const extremo = ext ? ` Una sola publicación, con FWCI ${c.num(ext.fwci, 2)}, pesa de forma
    decisiva: sin ella, el promedio sería ${c.num(ext.sinEl, 2)}${cruza
      ? `, ${ext.sinEl < 1 ? 'por debajo' : 'por encima'} del promedio mundial` : ''}.` : '';
  return `<div class="modulo modulo-lectura">
    <h2>Cómo leer estas cifras</h2>
    <p>El FWCI compara las citas recibidas con las esperadas para
    publicaciones del mismo campo, año y tipo documental; <strong>el valor 1,00
    corresponde al promedio mundial</strong>. En este informe, el promedio de
    los FWCI individuales es ${c.num(fwci.valor, 2)} y la mediana,
    ${c.num(fwci.mediana, 2)}. La diferencia entre ambos valores indica una
    distribución asimétrica: unas pocas publicaciones muy citadas elevan el
    promedio; por ello, el informe destaca la mediana.${extremo}</p>
    <p class="nota">Cada indicador declara la base sobre la que se calcula. No
    todas las publicaciones tienen métricas, por lo que el denominador varía
    según el indicador.</p>
  </div>`;
}

/** Las tres cifras de Fuentes externas. Una sola redacción para el
    pre-renderizado y el navegador. El pre-renderizado tenía la suya, pedía
    `resumen.total_autores` —que el artefacto no trae— y publicaba «NaN ·
    Autores UFT»: una cifra de atribución por persona que la propia página dice
    que no se publica. */
export function kpisFuentesExternas(meta, resumen) {
  return `<article class="kpi"><div class="valor">${c.nf.format(resumen.total_publicaciones)}</div>
      <div class="etiqueta">Publicaciones fuera de Scopus</div></article>
    <article class="kpi"><div class="valor">${c.nf.format(resumen.atribuciones_retenidas)}</div>
      <div class="etiqueta">Atribuciones obra-persona en revisión</div>
      <div class="secundario">no se publican hasta confirmarse</div></article>
    <article class="kpi"><div class="valor">${c.nf.format(meta.universo_scopus_dois)}</div>
      <div class="etiqueta">DOIs en universo Scopus</div></article>`;
}

/** Qué cubre el listado de fuentes externas, dicho con sus propias cifras
    (auditoría integral, 2026-09-30). Sin esto la página no decía que casi
    todas sus obras no declaran año —no pueden situarse en la ventana del
    informe— ni que una de las fuentes que nombra no aporta ninguna obra, y su
    total se leía como comparable con el de Producción ampliada, que sí filtra
    por ventana. */
export function alcanceFuentesExternas(meta, resumen, pubs = []) {
  const e = c.escapar;
  const total = pubs.length || resumen.total_publicaciones || 0;
  const sinAnio = pubs.filter(p => !String(p.anio || '').trim()).length;
  const ids = { 'Facultad de Medicina y Salud': 'facmed', 'Repositorio institucional DSpace': 'dspace',
    'Autoarchivo de biblioteca': 'autoarchivo' };
  const vacias = (meta.fuentes || []).filter(f => ids[f] && !(resumen.por_fuente || {})[ids[f]]);
  const frases = [];
  if (sinAnio) {
    frases.push(`${c.nf.format(sinAnio)} de las ${c.nf.format(total)} obras no declaran año, así que no
      pueden situarse en la ventana del informe: este listado no es comparable con el total de
      <a href="produccion-ampliada.html">Producción ampliada</a>, que cuenta solo lo publicado en la ventana.`);
  }
  if (vacias.length) {
    frases.push(`${vacias.map(f => `«${e(f)}»`).join(' y ')} no ${vacias.length === 1 ? 'aporta' : 'aportan'}
      obras a esta compilación del listado.`);
  }
  const noObras = resumen.excluidas_no_obra || 0;
  if (noObras) {
    frases.push(noObras === 1
      ? 'Se excluyó un registro que la fuente lista y no es una obra: una fe de erratas del editor.'
      : `Se excluyeron ${c.nf.format(noObras)} registros que la fuente lista y no son obras, como las fe de erratas del editor.`);
  }
  return frases.length ? `<p class="nota alcance-fuentes">${frases.join(' ')}</p>` : '';
}

/* ═══════════════════════════════════════════════ descarga de datos ════ */

/** Las columnas del CSV de publicaciones. Una sola lista para la exportación
    del listado y para la página de descarga, que además las enumera: si una
    cambia, la otra no puede quedarse describiendo el archivo anterior. */
export const COLUMNAS_CSV = ['eid', 'anio', 'titulo', 'fuente', 'tipo', 'doi', 'citas',
  'fwci', 'percentil_citacion', 'n_paises'];

/** Recuadro de descarga. El botón NO va aquí: lo pone `paginas.js`, porque
    el CSV se genera en el navegador y sin JavaScript sería un botón que no
    hace nada (el criterio de D-121). Sin guion queda el camino del listado. */
export function datosCsv(meta) {
  const n = meta.denominadores.universo_total;
  return `<p>Todas las publicaciones del universo, <b>${c.nf.format(n)}</b>, en CSV: una fila
    por publicación con las columnas ${COLUMNAS_CSV.map(k => `<code>${k}</code>`).join(', ')}.${
    meta.web_of_science ? ' En las exclusivas de Web of Science, <code>eid</code> lleva su UT.' : ''}
    El archivo lleva en su cabecera las fuentes, la ventana y la fecha de corte.</p>
    <p id="csv-accion"></p>
    <p class="nota">Para descargar solo un recorte, fíltrelo en
      <a href="publicaciones.html">Publicaciones</a> y use «Exportar CSV».</p>`;
}

/** Cómo hacer llegar una solicitud de corrección (D-744). Hasta el 2026-09-28
    el canal era un hueco declarado (D-193): «la vía institucional no está
    definida». El responsable y el correo salen de `institucion.json`. */
export function canalCorrecciones(inst) {
  if (!inst) return '';
  const r = inst.responsable;
  return `<p class="nota-destacada"><b>Cómo enviar una solicitud</b>Escriba a
    <a href="mailto:${c.escapar(r.contacto)}">${c.escapar(r.contacto)}</a>, indicando la ficha
    (su dirección en este sitio) y qué dato considera erróneo. Responde por el informe
    ${c.escapar(r.persona)}, ${c.escapar(r.unidad)}, ${c.escapar(r.institucion)}. La solicitud
    entra en la cola de revisión humana descrita arriba.</p>`;
}

/** Condiciones y procedencia. Solo lo que se puede comprobar: ni una licencia
    que falta confirmar con Elsevier (docs/DATA_LICENSE.md §5) ni un sello de
    conformidad. `notaUniverso` es la nota de P-01, que declara los duplicados
    pendientes de revisión (D-593). */
export function datosCondiciones(meta, notaUniverso, inst = null) {
  // Condición de uso de lo que se descarga (D-745): antes de ella, la CC BY 4.0
  // aprobada en julio no se declaraba aquí porque dependía de Elsevier.
  const uso = inst ? `<li><b>Uso exclusivo.</b> © ${c.escapar(inst.derechos.anio)} ${c.escapar(inst.derechos.titular)}.
      ${c.escapar(inst.derechos.aviso)} Solicitudes de autorización:
      <a href="mailto:${c.escapar(inst.responsable.contacto)}">${c.escapar(inst.responsable.contacto)}</a>.</li>` : '';
  return `<ul class="datos-condiciones">
    ${uso}
    <li>Las exportaciones originales de Scopus y SciVal <b>no se publican</b>: el sitio sirve
      datos derivados de ellos.</li>
    <li>Qué métricas derivadas de Elsevier permite publicar la licencia institucional
      <b>está pendiente de confirmar</b> con la unidad que administra la suscripción.</li>
    <li>Citas y métricas de SciVal al <b>${c.escapar(meta.fecha_corte_citas)}</b>. La exportación
      de Scopus no declara fecha de corte: sus indicadores se leen a la fecha de la
      exportación, el <b>${c.escapar(meta.exports.Scopus.fecha_export)}</b>.</li>
    <li>Universo de ${c.nf.format(meta.denominadores.universo_total)} publicaciones, ventana
      ${meta.ventana.inicio}–${meta.ventana.fin}, compilación del ${c.escapar(meta.fecha_build)}.
      ${notaUniverso ? c.escapar(notaUniverso) : ''}</li>
    <li>La producción fuera de Scopus viene de fuentes institucionales y abiertas, no de
      Elsevier: su procedencia va en su propia fila del inventario.</li>
  </ul>`;
}

/** Inventario de los archivos que sirve el sitio. Las filas llegan medidas
    desde el pre-renderizado —registros y bytes reales de dist/data—; aquí solo
    se escriben. Los JSON se enlazan y no llevan botón de descarga: la política
    de exportación declara solo CSV (config/publication.yml). */
export function datosInventario(filas, noListados) {
  const peso = b => b < 1024 ? `${c.nf.format(b)} B` : `${c.nf.format(Math.round(b / 1024))} KB`;
  return `<div class="tabla-envoltura tabla-datos tabla-inventario"><table>
    <caption class="solo-lectores">Archivos de datos que sirve el sitio</caption>
    <thead><tr><th scope="col">Archivo</th><th scope="col">Qué contiene</th>
      <th scope="col" class="num">Registros</th><th scope="col" class="num">Tamaño</th>
      <th scope="col">Procedencia</th></tr></thead>
    <tbody>${filas.map(f => `<tr>
      <td>${f.ruta ? `<a href="${c.escapar(f.ruta)}">${c.escapar(f.archivo)}</a>` : `<code>${c.escapar(f.archivo)}</code>`}</td>
      <td>${c.escapar(f.describe)}${f.nota ? `<br><span class="nota">${c.escapar(f.nota)}</span>` : ''}</td>
      <td class="num">${c.nf.format(f.registros)}<br><span class="nota">${c.escapar(f.unidad)}</span></td>
      <td class="num">${peso(f.bytes)}</td>
      <td>${c.escapar(f.procedencia)}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="nota">No se listan, porque son textos o manifiestos de la interfaz y no datos:
    ${noListados.map(n => `<code>data/${c.escapar(n.archivo)}</code> (${c.escapar(n.motivo)})`).join(', ')}.</p>`;
}

/** Las partes del informe (`core.js`): las usan el índice, la portada, el
    folio y los enlaces de los objetivos. */
export const PARTES_INFORME = c.PARTES_INFORME;
export const partesInforme = c.partesInforme;

/** Los objetivos del informe (`docs/OBJETIVOS.md`, vía `ejes.json`).

    Los presenta la Introducción, que abre el informe, porque un informe que no
    declara qué se propone medir deja que cada lector lo decida. Cada objetivo
    específico enlaza a la sección que lo cumple, y «Fuera de alcance» dice lo
    que el informe no hace, con el mismo peso. */
const DESTINO_OBJETIVO = PARTES_INFORME;
export function objetivos(o, { titulo = 'Objetivos del informe', id = '' } = {}) {
  if (!o) return '';
  const e = c.escapar;
  return `<section class="objetivos modulo"${id ? ` id="${e(id)}"` : ''} aria-labelledby="objetivos-titulo">
    <h2 id="objetivos-titulo">${e(titulo)}</h2>
    <p class="objetivos-general"><b>Objetivo general.</b> ${e(o.general)}</p>
    <h3>Objetivos específicos</h3>
    <ol class="objetivos-lista">${o.especificos.map(x => {
      const [href, nombre] = DESTINO_OBJETIVO[x.eje] || ['#', x.eje];
      return `<li><a href="${href}"><b>${e(nombre)}.</b></a> ${e(x.texto)}</li>`;
    }).join('')}</ol>
    <p class="objetivos-fuera"><b>Fuera de alcance.</b> ${e(o.fuera_de_alcance)}</p>
  </section>`;
}

/** Los objetivos en la portada, en una línea (D-771). Completos —específicos
    y fuera de alcance— los trae la Introducción; repetirlos enteros sobre el
    explorador ponía 250 palabras entre el titular y la síntesis, que es lo
    primero que busca quien lee solo la portada. */
export function objetivosBreve(o) {
  if (!o) return '';
  const e = c.escapar;
  return `<section class="objetivos objetivos-breve" aria-label="Objetivo del informe">
    <p><b>Objetivo del informe.</b> ${e(o.general)}
      <a href="introduccion.html#intro-objetivos">Objetivos específicos y alcance →</a></p>
  </section>`;
}

/* ═══════════════════ El informe descargado: portada, ficha e introducción ══
   D-749. Todo archivo descargado —el PDF completo, el de cada sección y lo que
   imprime el botón «Descargar informe»— abre con dos hojas:

     · la PORTADA, solo con lo que identifica el documento: institución, unidad,
       título, periodo, qué contiene, quién lo elabora, fuentes y fecha;
     · la FICHA DEL INFORME, con lo que hace falta para fecharlo, citarlo y
       usarlo: fechas de los datos, bases de cálculo, versión, huella, cómo
       citar, derechos y uso responsable.

   Antes la hoja 1 del PDF lo traía todo junto y la impresión desde el
   navegador no traía portada. Un solo marcado para las dos vías: el sitio lo
   pinta en cada página, oculto en pantalla (`.solo-papel`), y el generador del
   PDF lo vuelve a pintar con lo que solo él sabe —la huella de los datos y la
   versión del código—. La maqueta vive en app.css. */

/** «2026-09-28» → «28 de septiembre de 2026». Vive en `core.js`, que también
    la usa el análisis de resultados. */
export const fechaLarga = c.fechaLarga;

/** Qué contiene el archivo: una sección, el informe entero o, con una
    selección de gráficos, solo las secciones que tienen alguno de los elegidos
    —«todas las secciones» sería falso—. */
function contenidoInforme(seccion, seleccion) {
  if (seccion) return `Sección: ${seccion}`;
  return seleccion ? 'Informe con una selección de gráficos'
    : 'Informe completo: todas las secciones';
}

/** El rótulo que identifica el informe en el folio de cada hoja. Con el
    nombre completo de la institución y no su sigla: el Manual de Marca reserva
    «UFT» a los textos internos que la requieran (p. 38, D-752). */
export function etiquetaInforme(meta) {
  return [meta.titulo_plataforma, meta.institucion].filter(Boolean).join(' · ');
}

/** Los colores de marca del informe como variables CSS (D-752), desde
    `institucion.json` —es decir, desde `config/institution.yml`—. La hoja de
    estilo de papel las usa con un valor de reserva, así que sin
    configuración el informe sale en negro y gris. */
export function marcaCSS(inst) {
  const col = (inst && inst.marca && inst.marca.colores) || {};
  const decl = Object.entries({ tinta: col.tinta, acento: col.acento, suave: col.suave })
    .filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v || ''))
    .map(([k, v]) => `--manual-${k}: ${v};`);
  return decl.length ? `:root { ${decl.join(' ')} }\n` : '';
}

/** La portada. `seccion` es el nombre de la sección que contiene el archivo,
    o `null` en el informe completo; `alcance` y `seleccion` son las frases que
    la propia página escribe con el recorte (`#recorte-impreso`,
    `#seleccion-impresa`), para que la portada no redacte por segunda vez lo
    que ya está escrito. */
export function portadaInforme({ meta, inst, intro, seccion = null, alcance = '', seleccion = '', emision = '' }) {
  const e = c.escapar;
  const v = meta.ventana || {};
  const r = inst && inst.responsable;
  const d = inst && inst.derechos;
  /* El logo de la Dirección, cuando exista su archivo (D-752): el manual pide
     el de la división y lo trae solo como imagen, que no se redibuja. El logo
     ya lleva el nombre de la institución y de la unidad, así que en su lugar
     no se repiten en texto. */
  const logo = inst && inst.marca && inst.marca.logo;
  const dato = (rotulo, valor, attr = '') =>
    `<div class="pi-dato"><dt>${e(rotulo)}</dt><dd${attr}>${valor}</dd></div>`;
  return `<section class="portada-informe solo-papel" data-portada aria-label="Portada del informe">
    <header class="pi-cabeza">${logo ? `
      <img class="pi-logo" src="${e(logo)}" alt="${e(inst.marca.logo_alt || meta.institucion || '')}">` : `
      <p class="pi-institucion">${e(meta.institucion || '')}</p>
      ${r ? `<p class="pi-unidad">${e(r.unidad)}</p>` : ''}`}
    </header>
    <div class="pi-centro">
      <h1 class="pi-titulo">${e(meta.titulo_plataforma || 'Informe bibliométrico')}</h1>
      ${intro && intro.subtitulo ? `<p class="pi-subtitulo">${e(intro.subtitulo)}</p>` : ''}
      <p class="pi-periodo">${e(String(v.inicio ?? ''))}–${e(String(v.fin ?? ''))}</p>
      <p class="pi-edicion">${e(contenidoInforme(seccion, seleccion))}</p>
      <p class="pi-alcance" data-portada-alcance>${e(alcance)}</p>
      <p class="pi-seleccion" data-portada-seleccion>${e(seleccion)}</p>
    </div>
    <footer class="pi-pie">
      <dl class="pi-datos">
        ${r ? dato('Elaborado por', `${e(r.persona)}<br>${e(r.unidad)}, ${e(r.institucion)}`) : ''}
        ${r ? dato('Contacto', e(r.contacto)) : ''}
        ${dato('Fuentes de los datos', e((meta.fuentes || []).join(' · ')))}
        ${dato(SELLO_PORTADA, e(fechaLarga(emision)), ' data-portada-emision')}
      </dl>
      ${d ? `<p class="pi-derechos">© ${e(d.anio)} ${e(d.titular)} · ${e(d.aviso_corto || d.aviso)}</p>` : ''}
    </footer>
  </section>`;
}

/** El rótulo por el que el generador reconoce la portada en la hoja 1 de cada
    PDF: se declara junto a la maqueta que lo imprime para que la comprobación
    y lo comprobado no puedan separarse. */
export const SELLO_PORTADA = 'Fecha de emisión';

/** La ficha del informe, en la hoja que sigue a la portada. `huella` y
    `codigo` solo los conoce el generador del PDF; sin ellos, sus filas no se
    imprimen en vez de inventarse. */
export function fichaInforme({ meta, inst, intro, seccion = null, alcance = '', seleccion = '',
                               emision = '', huella = null, codigo = null, filtra = false }) {
  const e = c.escapar;
  const v = meta.ventana || {};
  const r = inst && inst.responsable;
  const d = inst && inst.derechos;
  const ci = inst && inst.cita;
  const den = meta.denominadores || {};
  const fila = (rotulo, valor, attr = '') =>
    `<div class="fi-fila"><dt>${e(rotulo)}</dt><dd${attr}>${valor}</dd></div>`;
  /* Las bases son del UNIVERSO institucional, y sobre un recorte engañan: bajo
     «46 de 823 publicaciones» se leerían como el suelo del informe. El alcance
     ya declara sobre cuántas descansa, y cada cifra declara la suya dentro. */
  const bases = filtra ? [] : [
    [den.universo_total, 'en el universo'],
    [den.con_metricas, 'con métricas normalizadas'],
    [den.base_impacto, 'en la base de impacto'],
    [den.con_autoria_detallada, 'con autoría detallada'],
    [den.con_area_tematica, 'con área temática'],
  ].filter(([n]) => n !== undefined && n !== null);
  const grupo = (titulo, cuerpo) => `<div class="fi-grupo"><h3>${e(titulo)}</h3>${cuerpo}</div>`;
  return `<section class="ficha-informe solo-papel" data-ficha aria-labelledby="ficha-informe-titulo">
    <h2 id="ficha-informe-titulo">Ficha del informe</h2>
    ${grupo('Identificación', `<dl class="fi-tabla">
      ${fila('Título', e(meta.titulo_plataforma || ''))}
      ${fila('Institución', e(meta.institucion || ''))}
      ${r ? fila('Unidad responsable', e(r.unidad)) : ''}
      ${r ? fila('Responsable', e(r.persona)) : ''}
      ${r ? fila('Contacto', e(r.contacto)) : ''}
      ${fila('Contenido', e(contenidoInforme(seccion, seleccion)))}
      ${fila('Alcance', e(alcance), ' data-portada-alcance')}
      ${seleccion ? fila('Selección', e(seleccion), ' data-portada-seleccion') : ''}
    </dl>`)}
    ${grupo('Datos', `<dl class="fi-tabla">
      ${fila('Fuentes', e((meta.fuentes || []).join(' · ')))}
      ${fila('Periodo', `Publicaciones de ${e(String(v.inicio ?? ''))} a ${e(String(v.fin ?? ''))}`)}
      ${Object.entries(meta.exports || {}).map(([f, x]) =>
        fila(`Exportación de ${f}`, e(fechaLarga(x.fecha_export) || '—'))).join('')}
      ${fila('Citas actualizadas al', e(fechaLarga(meta.fecha_corte_citas) || '—'))}
      ${bases.length ? fila('Bases de cálculo', bases.map(([n, q]) =>
        `<b>${e(c.nf.format(n))}</b> ${e(q)}`).join(' · ')) : ''}
    </dl>
    ${bases.length ? '<p class="fi-nota">Cada indicador declara su propia base, y no es la misma para todos.</p>' : ''}`)}
    ${grupo('Edición', `<dl class="fi-tabla">
      ${fila('Emitido el', e(fechaLarga(emision) || emision), ' data-ficha-emision')}
      ${fila('Datos compilados el', e(fechaLarga(meta.fecha_build) || meta.fecha_build || ''))}
      ${codigo ? fila('Versión del código', e(codigo)) : ''}
      ${huella ? fila('Huella de los datos', `SHA-256 ${e(huella.slice(0, 16))}`) : ''}
    </dl>
    ${huella && intro ? `<p class="fi-nota">${e(intro.huella)}</p>` : ''}`)}
    ${ci ? grupo('Cómo citar', `<p class="fi-cita">${e(ci.autor)} (${e(ci.anio)}).
      <i>${e(ci.titulo)}</i>${seccion ? ` [Sección: ${e(seccion)}]` : ''}${
        filtra ? ` [${e(alcance.replace(/\.$/, ''))}]` : ''}.
      ${e(ci.editor)}.</p>`) : ''}
    ${d ? grupo('Derechos y condiciones de uso', `<p>© ${e(d.anio)} ${e(d.titular)}. ${e(d.aviso)}${
      r ? ` Solicitudes de autorización o de corrección: ${e(r.contacto)}.` : ''}</p>`) : ''}
    ${intro ? grupo('Uso responsable', `<p>${e(intro.uso_responsable)}</p>`) : ''}
  </section>`;
}

/** El folio de cada hoja impresa (D-750): el informe y la sección a la
    izquierda, «Hoja N de M» a la derecha. Es CSS de páginas —`@page` con
    cajas de margen, que Chromium implementa desde la versión 131—, así que lo
    imprimen igual el botón del navegador y el generador del PDF, y la portada
    sale sin folio. La maqueta y el contador viven en app.css; aquí solo va el
    texto, que depende de la página.

    Con `partes` escribe una página con nombre por sección: en el informe
    completo, cada hoja dice de qué sección es. */
export function folioCSS(etiqueta, partes = null) {
  const cadena = (s) => `"${String(s).replace(/["\\]/g, '\\$&').replace(/\s+/g, ' ')}"`;
  // La regla general cubre las hojas que no son de ninguna sección: la ficha y
  // el índice del informe completo.
  const reglas = [`@page { @bottom-left { content: ${cadena(etiqueta)}; } }`,
    ...(partes || []).map(([clave, nombre]) =>
      `[data-parte="${clave}"] { page: parte-${clave}; }\n`
      + `@page parte-${clave} { @bottom-left { content: ${cadena(`${etiqueta} · ${nombre}`)}; } }`)];
  /* La portada se vuelve a declarar sin folio DESPUÉS: Chromium no da más peso
     a una página con nombre que a la regla general, así que la de esta hoja,
     escrita tras app.css, le ponía folio a la portada. Medido en el PDF. */
  return [...reglas, '@page portada { @bottom-left { content: none; } @bottom-right { content: none; } }']
    .join('\n');
}

/** La Introducción del informe (D-748): por qué existe, qué se propone, sobre
    qué datos, cómo está organizado y cómo se lee cada cifra y cada gráfico.

    Casi nada de lo que dice se escribe aquí: los textos vienen de
    `docs/INTRODUCCION.md`, los objetivos de `docs/OBJETIVOS.md`, las fuentes y
    sus fechas de `config/sources.yml`, el universo de `meta.json`, la fuente
    de cada indicador del anexo metodológico y «Qué muestra» cada figura de
    `docs/LECTURAS.md`. La lista de figuras (`guia`) sale de los mismos
    registros que las dibujan, así que una figura nueva entra sola. */
export function introduccion({ intro, objetivos: obj, meta, inst, corpus, lecturas, guia, cifras, fuentePorCodigo }) {
  if (!intro) return '';
  const e = c.escapar;
  const v = meta.ventana || {};
  const den = meta.denominadores || {};
  const ids = (inst && inst.identificadores) || {};
  const lect = lecturas || {};
  const fuenteDe = fuentePorCodigo || {};
  let n = 0;
  const bloque = (id, titulo, cuerpo, clase = '') => `<section class="intro-bloque${clase}" aria-labelledby="${id}">
    <h2 id="${id}">${++n}. ${e(titulo)}</h2>${cuerpo}</section>`;

  const identificadores = [
    ids.scopus_af_id && `identificador de afiliación en Scopus ${e(ids.scopus_af_id)}`,
    ids.ror && `ROR ${e(ids.ror)}`,
  ].filter(Boolean).join(' · ');
  // Las que se cruzan por EID. Web of Science se suma aparte, por DOI (D-794).
  const nombres = (meta.fuentes || []).filter((f) => f !== 'Web of Science').join(' y ');
  const union = {
    union: `la unión de las exportaciones de ${e(nombres)}`,
    interseccion: `las publicaciones presentes en las exportaciones de ${e(nombres)}`,
  }[corpus && corpus.estrategia_universo] || `las exportaciones de ${e(nombres)}`;
  const quienCorta = (intro.fuentes || []).find((f) => f.fecha_corte && f.fecha_corte === meta.fecha_corte_citas);

  const presentacion = bloque('intro-presentacion', 'Presentación',
    intro.presentacion.map((p) => `<p>${e(p)}</p>`).join(''));

  const objetivosHtml = obj ? objetivos(obj, { titulo: `${++n}. Objetivos del informe`, id: 'intro-objetivos' }) : '';

  const alcance = bloque('intro-alcance', 'Alcance y fuentes de los datos', `
    <dl class="intro-alcance">
      <div><dt>Institución</dt><dd>${e(meta.institucion || '')}${identificadores ? ` (${identificadores})` : ''}.</dd></div>
      <div><dt>Periodo</dt><dd>Publicaciones con año de publicación entre ${e(String(v.inicio ?? ''))}
        y ${e(String(v.fin ?? ''))}. Lo publicado después de ${e(String(v.fin ?? ''))} no está incluido.</dd></div>
      <div><dt>Universo</dt><dd>${e(c.nf.format(den.universo_total ?? 0))} publicaciones: ${union},
        cruzadas por su identificador de Scopus (EID).${meta.web_of_science ? ` Incluye
        ${e(c.nf.format(meta.web_of_science.solo_wos))} indexadas solo en Web of Science, cruzadas por DOI.` : ''}</dd></div>
      <div><dt>Citas</dt><dd>Contabilizadas hasta el ${e(fechaLarga(meta.fecha_corte_citas))}${
        quienCorta ? `, fecha de corte que declara ${e(quienCorta.nombre)}` : ''}.</dd></div>
    </dl>
    <h3>Fuentes de los datos</h3>
    <dl class="intro-fuentes">${(intro.fuentes || []).map((f) => `
      <div><dt>${e(f.nombre)}</dt><dd>
        <p class="intro-fuente-dato">${e(f.acceso)} · exportada el ${e(fechaLarga(f.fecha_export) || '—')} ·
          ${e(c.nf.format(f.n_registros_leido ?? 0))} registros · ${f.fecha_corte
            ? `citas al ${e(fechaLarga(f.fecha_corte))}` : 'la exportación no declara fecha de corte'}</p>
        <p>${e(f.aporta)}</p></dd></div>`).join('')}
    </dl>
    <p class="nota">${e(intro.fuentes_complementarias || '')}</p>`);

  const estructura = bloque('intro-estructura', 'Estructura del informe', `
    <ol class="intro-partes">${(intro.partes || []).map((p) => {
      const [href, nombre] = PARTES_INFORME[p.clave] || ['#', p.clave];
      return `<li><a href="${href}"><b>${e(nombre)}.</b></a> ${e(p.texto)}</li>`;
    }).join('')}</ol>`);

  /* La fuente de una figura es la del indicador cuyos datos dibuja, tal como la
     declara el anexo metodológico. */
  const fuente = (cods) => [...new Set((cods || [])
    .flatMap((k) => String(fuenteDe[k] || '').split(' · ')).filter(Boolean))].join(' · ') || '—';
  const tablaFiguras = (figuras) => `<div class="tabla-envoltura"><table class="tabla-guia">
    <thead><tr><th scope="col">Gráfico</th>
      <th scope="col">Qué muestra</th><th scope="col">Fuente</th></tr></thead>
    <tbody>${figuras.map((f) => {
      const l = lect[f.clave] || {};
      return `<tr><td>${e(f.titulo || l.titulo || f.clave)}</td>
        <td>${e(l.muestra || '—')}</td><td>${e(fuente(f.fuentes))}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  const guiaHtml = bloque('intro-guia', 'Guía de lectura de los gráficos', `
    <p>Qué muestra cada cifra y cada gráfico del informe, sección por sección. La misma
      frase acompaña a la figura en su sección; cuando el indicador tiene una advertencia,
      la figura remite a su fila del anexo de indicadores.</p>
    <h3>Cifras del tablero</h3>
    <p class="nota">Abren el panorama general y cada sección de resultados, calculadas sobre
      el recorte del informe.</p>
    <div class="tabla-envoltura"><table class="tabla-guia tabla-guia-cifras">
      <thead><tr><th scope="col">Cifra</th><th scope="col">Qué muestra</th>
        <th scope="col">Base de cálculo</th></tr></thead>
      <tbody>${(cifras || []).map((f) => `<tr><td>${e(f.etiqueta)}</td>
        <td>${e((lect[f.clave] || {}).muestra || '—')}</td><td>${e(f.base)}</td></tr>`).join('')}</tbody>
    </table></div>
    ${(guia || []).map((g) => `<h3>${e((PARTES_INFORME[g.parte] || [])[1] || g.parte)}</h3>
      ${tablaFiguras(g.figuras)}`).join('')}`, ' intro-guia');

  const claves = bloque('intro-lectura', 'Cómo leer las cifras', `
    <ul class="intro-claves">${(intro.lectura_cifras || []).map((x) =>
      `<li><b>${e(x.titulo)}</b> ${e(x.texto)}</li>`).join('')}</ul>`);

  const uso = bloque('intro-uso', 'Uso responsable de los indicadores',
    `<p>${e(intro.uso_responsable)}</p>`);

  return presentacion + objetivosHtml + alcance + estructura + guiaHtml + claves + uso;
}

/** Banda de cierre de la portada: la salida a las secciones.

    Se genera en vez de escribirse en el HTML para que no pueda divergir de
    PAGINAS: si mañana se añade una sección, aparece aquí sola. Va sobre el
    suelo de énfasis, que solo admite tipografía y enlaces. */
export function cierrePortada() {
  const salidas = c.PAGINAS.filter(([href]) =>
    ['produccion.html', 'impacto.html', 'colaboracion.html', 'tematica.html'].includes(href));
  return `
    <div class="banda-titulo">
      <h2>Cada indicador declara su propio denominador.</h2>
      <p>Las cifras de este informe no se miden todas sobre el mismo conjunto,
      y por eso dos de ellas pueden diferir sin contradecirse. Cada gráfico
      lleva pegada su fuente, la fecha que esa fuente declara y sobre cuántos
      casos está medido.</p>
    </div>
    <div class="banda-salidas">${salidas.map(([href, txt]) => `
      <a href="${href}"><strong>${c.escapar(txt)}</strong><span>Ver la sección →</span></a>`).join('')}
    </div>`;
}

/* ------------------------------------------------------------ catálogo */

/** El catálogo completo de indicadores: los 40 evaluados, no los 27 que se
    publican.

    POR QUÉ EXISTE
    El sitio mostraba 27 indicadores y no decía nada de los otros 13. Para un
    lector, «no está» tiene al menos tres lecturas incompatibles: no se midió,
    se midió y salió mal, o no se puede medir sin inventar el dato. Publicar el
    criterio es lo que separa un informe de una selección de cifras favorables.

    Es una tabla y no tarjetas a propósito: cuarenta entradas que se comparan
    entre sí se leen en columnas. Y va sin JavaScript —se pre-renderiza— porque
    es justo el contenido que alguien va a querer citar o archivar. */
export function catalogo(cat, graficos = {}) {
  const { indicadores, resumen, categorias, etiquetas_estado: est } = cat;
  /* Los códigos que además se dibujan como gráfico en alguna sección. El
     catálogo es la única página donde los veintiuno se ven juntos, así que es
     donde se eligen: en una sección solo están los suyos, y elegir «un gráfico
     independiente de la sección» exige verlos todos a la vez. */
  const esGrafico = (cod) => Object.prototype.hasOwnProperty.call(graficos, cod);

  const resumenHTML = Object.entries(est)
    .filter(([e]) => resumen[e])
    .map(([e, [etq, detalle]]) => `
      <div class="kpi">
        <span class="valor">${resumen[e]}</span>
        <span class="etiqueta">${c.escapar(etq)}</span>
        <span class="secundario">${c.escapar(detalle)}</span>
      </div>`).join('');

  const fila = (r) => {
    const den = r.denominador
      ? `${c.escapar(r.denominador)}<br><span class="nota">${c.nf.format(r.denominador_valor)}</span>`
      : '<span class="sin-dato-txt">No aplica</span>';
    // El porqué de no publicarse va en su propia fila y no en una celda: es
    // prosa, y meterla en una columna la haría ilegible en las cuarenta.
    const motivo = [r.razon, r.estado !== 'publicado' ? r.advertencia : null]
      .filter(Boolean).join(' ');
    const extra = (motivo || r.que_falta) ? `
      <tr class="cat-motivo">
        <td colspan="7">
          ${motivo ? `<strong>Por qué:</strong> ${c.escapar(motivo)}` : ''}
          ${r.que_falta ? `<br><strong>Qué falta:</strong> ${c.escapar(r.que_falta)}` : ''}
        </td>
      </tr>` : '';
    return `
      <tr id="${r.codigo}">
        <td class="col-marca">${esGrafico(r.codigo)
          ? `<label class="solo-lectores" for="g-${r.codigo}">Incluir ${c.escapar(r.nombre)} en la selección</label>
             <input type="checkbox" class="chk-grafico" id="g-${r.codigo}" data-cod="${r.codigo}">`
          : ''}</td>
        <td><span class="codigo">${r.codigo}</span></td>
        <td>
          <strong>${c.escapar(r.nombre)}</strong>
          ${r.definicion ? `<br><span class="nota">${c.escapar(r.definicion)}</span>` : ''}
        </td>
        <td>${r.fuente ? c.escapar(r.fuente)
          : '<span class="sin-dato-txt">No se calcula</span>'}</td>
        <td>${den}</td>
        <td>${r.cobertura ? c.escapar(r.cobertura) : '—'}</td>
        <td><span class="estado" data-e="${r.estado}">${c.escapar(r.estado_etiqueta)}</span>
          ${r.confiabilidad ? `<br><span class="nota"><a href="metodologia.html#confiabilidad">confiabilidad
            ${c.escapar(r.confiabilidad)}</a></span>` : ''}
        </td>
      </tr>${extra}`;
  };

  const secciones = Object.entries(categorias).map(([clave, etiqueta]) => {
    const filas = indicadores.filter(r => r.categoria === clave);
    if (!filas.length) return '';
    return `
    <section class="modulo" id="cat-${clave}" tabindex="-1">
      <header><div class="modulo-id"><h2>${c.escapar(etiqueta)}</h2>
        <span class="codigo">${filas.length}</span></div></header>
      <div class="tabla-envoltura tabla-datos tabla-catalogo">
        <table>
          <thead><tr>
            <th scope="col"><span class="solo-lectores">Seleccionar</span></th>
            <th scope="col">Cód.</th><th scope="col">Indicador y definición</th>
            <th scope="col">Fuente</th><th scope="col">Denominador</th>
            <th scope="col">Cobertura medida</th><th scope="col">Estado</th>
          </tr></thead>
          <tbody>${filas.map(fila).join('')}</tbody>
        </table>
      </div>
    </section>`;
  }).join('');

  const indice = Object.entries(categorias).map(([clave, etiqueta]) =>
    `<li><a href="#cat-${clave}"><span class="rail-txt">${c.escapar(etiqueta)}</span></a></li>`).join('');

  /* La barra de la selección. Vive arriba y no al final: se marca mientras se
     recorre la tabla, y un botón al pie obligaría a volver. Sin JavaScript
     queda un texto que explica para qué son las casillas, que es más honesto
     que un control muerto. */
  const barra = `
    <div class="acciones-tabla acciones-graficos" id="acciones-graficos">
      <span id="estado-graficos">Ningún gráfico seleccionado</span>
      <a class="boton" id="ver-seleccion" href="index.html" hidden>Ver el informe con estos gráficos →</a>
      <button type="button" class="boton" id="limpiar-graficos" hidden>Quitar la selección</button>
    </div>
    <p class="nota" id="orden-graficos" hidden></p>`;

  return `
    <div class="kpis" data-n="${Object.values(resumen).filter(Boolean).length}">${resumenHTML}</div>
    ${barra}
    <p class="nota">Las coberturas están <strong>medidas sobre los datos</strong>,
    no estimadas: salen de <code>indicator_feasibility.csv</code>, que se
    regenera en cada build. Un indicador diferido está verificado como
    calculable; uno no calculable no lo está, y aproximarlo sería inventar la
    métrica.</p>
    <div class="disposicion">
      <nav class="rail" aria-label="Categorías del catálogo">
        <p class="rail-titulo">En esta página</p><ol>${indice}</ol></nav>
      <div>${secciones}</div>
    </div>`;
}

/** Producción ampliada: tres fuentes, de naturaleza distinta, de producción
    fuera del corpus indexado en Scopus — nunca mezcladas en los gráficos
    de producción/impacto del resto del sitio, y por eso viven en su propia
    página con su propio marcado, no reutilizando `RENDER`/`kpiCarta` de
    los indicadores Scopus/SciVal.

    PD-01 es lo que cada Facultad declara editorialmente en su propio
    sitio (hoy solo Medicina). PD-02 es lo que OpenAlex atribuye a la
    institución y un humano confirmó caso por caso. PD-03 es lo
    que sus propios autores autoarchivaron en el repositorio institucional,
    con la Facultad o Escuela que biblioteca les asignó — cubre TODAS las
    Facultades a la vez, pero esa unidad viene en bruto: solo se agrega por
    Facultad cuando la relación está validada institucionalmente
    (`config/matching_rules.yml`); el resto se cuenta aparte, por unidad
    declarada, nunca forzado a una Facultad sin validar. Ninguna de las
    tres declara Facultad de la misma forma que otra, así que cada una va
    en su propia subsección, no mezclada en la tabla de otra.

    Los párrafos de transparencia (fuera de ventana / sin año / pendientes
    de revisión / sin Facultad validada) se componen aquí desde los datos —
    nunca una cifra escrita a mano — porque ocultarlos habría sido tan
    engañoso como mezclarlos en un gráfico Scopus. */
export function produccionDeclarada(datos) {
  const { resumen, por_facultad_anio: filas, fuera_de_ventana_o_sin_anio: extra,
          ventana, procedencia: proc, nota, fuentes,
          openalex_cobertura: oa, autoarchivo_produccion: aa,
          obras_externas: oe, total_fuera_de_scopus: total } = datos;

  const hayPD01 = !!(fuentes && fuentes.length);
  const hayPD02 = !!(oa && oa.disponible);
  const hayPD03 = !!(aa && aa.disponible);
  const hayPD04 = !!(oe && oe.disponible);

  if (!hayPD01 && !hayPD02 && !hayPD03 && !hayPD04) {
    return `
    <p class="nota">Esta compilación no trae ninguna fuente de producción
    fuera de Scopus: ni listados propios de las Facultades, ni obras
    confirmadas en OpenAlex o en repositorios abiertos, ni el inventario de
    autoarchivo. La sección aparece vacía a propósito: el dato es opcional,
    no un indicador que debiera existir.</p>`;
  }

  const kpi = (valor, etiqueta, secundario) => `
    <div class="kpi">
      <span class="valor">${c.nf.format(valor)}</span>
      <span class="etiqueta">${c.escapar(etiqueta)}</span>
      ${secundario ? `<span class="secundario">${c.escapar(secundario)}</span>` : ''}
    </div>`;

  // Fila «Facultad · año · N», compartida por las tablas de PD-01 y PD-03
  // (las dos únicas fuentes que agregan a este nivel; PD-02 no tiene
  // Facultad y usa su propia fila, solo año).
  const filaFacultadAnio = (r) => `
    <tr><td>${c.escapar(r.facultad)}</td><td>${r.anio}</td>
      <td>${c.nf.format(r.n)}</td></tr>`;

  const totalHTML = total ? `
    <div class="kpis">${kpi(
      total.en_ventana, `Producción total fuera de Scopus, ${ventana.inicio}-${ventana.fin}`,
      `${c.nf.format(total.pd01_en_ventana)} declaradas por las Facultades + `
      + `${c.nf.format(total.pd02_en_ventana)} confirmadas por revisión de cobertura OpenAlex + `
      + `${c.nf.format(total.pd03_en_ventana)} autoarchivadas en el repositorio institucional + `
      + `${c.nf.format(total.pd04_en_ventana || 0)} confirmadas en repositorios de datos y acceso abierto`
      + (total.duplicados_entre_fuentes
        ? `, menos ${c.nf.format(total.duplicados_entre_fuentes)} repetidas entre esas fuentes`
        : ''))}</div>
    <p class="nota">Suma de las cuatro fuentes de abajo, sin contar dos veces la
    misma obra: se unen por DOI y lo que aparece en más de una se resta las
    veces que se repite.</p>` : '';

  const pd01HTML = hayPD01 ? (() => {
    const kpisHTML = [
      kpi(resumen.total_leido, 'Registros declarados',
        `por las Facultades participantes, ${resumen.duplicados_colapsados_por_doi} duplicados de la fuente ya colapsados`
        + (resumen.excluidos_no_obra
          ? ` y ${c.nf.format(resumen.excluidos_no_obra)} ${resumen.excluidos_no_obra === 1 ? 'registro excluido' : 'registros excluidos'} por no ser una obra (fe de erratas)`
          : '')),
      kpi(resumen.en_universo_scopus, 'Ya en el universo Scopus',
        'divulgación: ya se cuentan en el resto del sitio, no se repiten aquí'),
      kpi(resumen.fuera_del_universo, 'Fuera del universo Scopus',
        'el conjunto que este corpus paralelo aporta de nuevo'),
      kpi(resumen.en_ventana, `En la ventana ${ventana.inicio}-${ventana.fin}`,
        'la cifra que entra al total combinado de arriba'),
    ].join('');

    const tabla = filas.length ? `
      <div class="tabla-envoltura tabla-datos">
        <table>
          <thead><tr><th scope="col">Facultad</th><th scope="col">Año</th>
            <th scope="col">Publicaciones declaradas</th></tr></thead>
          <tbody>${filas.map(filaFacultadAnio).join('')}</tbody>
        </table>
      </div>` : `
      <p class="nota">Ninguna publicación declarada cae dentro de la ventana
      ${ventana.inicio}-${ventana.fin}. Ver la nota de transparencia abajo:
      no significa que no haya datos, sino que los que hay quedan fuera de
      esta ventana o sin año declarado.</p>`;

    const notaExtra = (extra || []).filter(e => e.fuera_de_ventana || e.sin_anio)
      .map(e => {
        const partes = [];
        if (e.fuera_de_ventana) partes.push(`${c.nf.format(e.fuera_de_ventana)} fuera de la ventana ${ventana.inicio}-${ventana.fin}`);
        if (e.sin_anio) partes.push(`${c.nf.format(e.sin_anio)} sin año declarado`);
        return `${c.escapar(e.facultad)}: ${partes.join(', ')}`;
      }).join('; ');

    return `
      <h2>Declarada por las Facultades</h2>
      <div class="kpis" data-n="4">${kpisHTML}</div>
      ${c.nota(nota)}
      <h3>Por Facultad y año, dentro de la ventana ${ventana.inicio}-${ventana.fin}</h3>
      ${tabla}
      ${notaExtra ? `<p class="nota">Registros declarados adicionales que
      quedan fuera de esta tabla, sin descartarse: ${notaExtra}.</p>` : ''}
      ${c.sello(proc)}
      <p class="nota">En esta subsección, «Cobertura» es el porcentaje de lo
      declarado que cae dentro de la ventana ${ventana.inicio}-${ventana.fin}
      — no el sentido habitual del sello en el resto del sitio (porcentaje de
      publicaciones con un dato poblado).</p>`;
  })() : `
    <h2>Declarada por las Facultades</h2>
    <p class="nota">Ninguna Facultad tiene, por ahora, un listado propio
    declarado como fuente.</p>`;

  const pd02HTML = hayPD02 ? (() => {
    const r = oa.resumen;
    const kpisHTML = [
      kpi(r.total_evaluados, 'Candidatos evaluados por OpenAlex',
        'obras que OpenAlex atribuye a la institución y el universo Scopus no tiene'),
      kpi(r.confirmadas, 'Confirmadas con revisión humana',
        'caso por caso, antes de contarse — nunca automáticamente'),
      kpi(r.en_ventana, `En la ventana ${ventana.inicio}-${ventana.fin}`,
        'la cifra que entra al total combinado de arriba'),
      kpi(r.pendientes_revision_humana, 'Pendientes de revisión',
        'todavía sin decidir: NO se cuentan como producción confirmada'),
    ].join('');

    const filaAnio = (f) => `<tr><td>${f.anio}</td><td>${c.nf.format(f.n)}</td></tr>`;
    const tabla = oa.por_anio.length ? `
      <div class="tabla-envoltura tabla-datos">
        <table>
          <thead><tr><th scope="col">Año</th>
            <th scope="col">Publicaciones confirmadas</th></tr></thead>
          <tbody>${oa.por_anio.map(filaAnio).join('')}</tbody>
        </table>
      </div>` : `
      <p class="nota">Ninguna confirmación cae dentro de la ventana
      ${ventana.inicio}-${ventana.fin} todavía.</p>`;

    const notaExtra = (r.fuera_de_ventana || r.sin_anio) ? `
      <p class="nota">Además, ${c.nf.format(r.fuera_de_ventana)} confirmadas
      fuera de la ventana ${ventana.inicio}-${ventana.fin} y
      ${c.nf.format(r.sin_anio)} sin año declarado, sin descartarse.</p>` : '';

    return `
      <h2>Confirmada por revisión de cobertura OpenAlex</h2>
      <div class="kpis" data-n="4">${kpisHTML}</div>
      ${c.nota(oa.nota)}
      <h3>Por año, dentro de la ventana ${ventana.inicio}-${ventana.fin}</h3>
      ${tabla}
      ${notaExtra}
      ${c.sello(oa.procedencia)}
      <p class="nota">En esta subsección, «Cobertura» es el porcentaje de lo
      confirmado que cae dentro de la ventana ${ventana.inicio}-${ventana.fin}.
      Cada obra se confirma por revisión humana, caso por caso.</p>`;
  })() : `
    <h2>Confirmada por revisión de cobertura OpenAlex</h2>
    <p class="nota">Sin obras en esta compilación: la revisión de cobertura en
    OpenAlex aún no se ha ejecutado, y nada se cuenta sin ella.</p>`;

  const pd03HTML = hayPD03 ? (() => {
    const r = aa.resumen;
    const kpisHTML = [
      kpi(r.total_leido, 'Registros autoarchivados',
        `${r.duplicados_colapsados_por_doi} duplicados de la fuente ya colapsados`
        + (r.excluidos_no_obra
          ? ` y ${c.nf.format(r.excluidos_no_obra)} ${r.excluidos_no_obra === 1 ? 'registro excluido' : 'registros excluidos'} por no ser una obra`
          : '')),
      kpi(r.fuera_del_universo, 'Fuera del universo Scopus',
        'el conjunto que este corpus paralelo aporta de nuevo'),
      kpi(r.en_ventana_con_facultad, `Con Facultad validada, en la ventana ${ventana.inicio}-${ventana.fin}`,
        'la cifra que entra al total combinado de arriba'),
      kpi(r.en_ventana_sin_facultad, 'Sin Facultad validada, misma ventana',
        'unidad declarada en bruto: NO se cuenta por Facultad, ver la lista abajo'),
    ].join('');

    const tabla = aa.por_facultad_anio.length ? `
      <div class="tabla-envoltura tabla-datos">
        <table>
          <thead><tr><th scope="col">Facultad</th><th scope="col">Año</th>
            <th scope="col">Publicaciones autoarchivadas</th></tr></thead>
          <tbody>${aa.por_facultad_anio.map(filaFacultadAnio).join('')}</tbody>
        </table>
      </div>` : `
      <p class="nota">Ninguna publicación con Facultad validada cae dentro
      de la ventana ${ventana.inicio}-${ventana.fin}.</p>`;

    const filaUnidad = (u) => `<tr><td>${c.escapar(u.unidad_declarada)}</td><td>${c.nf.format(u.n)}</td></tr>`;
    const tablaSinMapeo = (aa.unidades_sin_mapeo || []).length ? `
      <div class="tabla-envoltura tabla-datos">
        <table>
          <thead><tr><th scope="col">Unidad declarada (en bruto)</th>
            <th scope="col">Publicaciones, en ventana</th></tr></thead>
          <tbody>${aa.unidades_sin_mapeo.map(filaUnidad).join('')}</tbody>
        </table>
      </div>` : '';

    const notaExtra = (r.fuera_de_ventana || r.sin_anio) ? `
      <p class="nota">Además, ${c.nf.format(r.fuera_de_ventana)} fuera de la
      ventana ${ventana.inicio}-${ventana.fin} y ${c.nf.format(r.sin_anio)}
      sin año declarado, sin descartarse.</p>` : '';

    return `
      <h2>Autoarchivada en el repositorio institucional</h2>
      <div class="kpis" data-n="4">${kpisHTML}</div>
      ${c.nota(aa.nota)}
      <h3>Por Facultad y año, dentro de la ventana ${ventana.inicio}-${ventana.fin}
      — solo unidades con relación escuela→Facultad validada</h3>
      ${tabla}
      ${notaExtra}
      ${c.sello(aa.procedencia)}
      <h3>Por unidad declarada, sin Facultad validada institucionalmente</h3>
      <p class="nota">Estas ${c.nf.format(r.en_ventana_sin_facultad)} publicaciones,
      dentro de la misma ventana, están fuera de Scopus tanto como las de
      arriba — pero la Facultad o Escuela que biblioteca les asignó no tiene
      hoy una relación validada a nivel de Facultad
      (<code>config/matching_rules.yml</code>). Se cuentan aquí, por su
      propia unidad, en vez de adivinar a qué Facultad pertenecen.</p>
      ${tablaSinMapeo}
      <p class="nota">En esta subsección, «Cobertura» es el porcentaje de lo
      autoarchivado con Facultad validada que cae dentro de la ventana
      ${ventana.inicio}-${ventana.fin} — no el sentido habitual del sello en
      el resto del sitio.</p>`;
  })() : `
    <h2>Autoarchivada en el repositorio institucional</h2>
    <p class="nota">Sin obras en esta compilación: el inventario de autoarchivo
    no se procesó.</p>`;

  const pd04HTML = hayPD04 ? (() => {
    const r = oe.resumen;
    // Estas frases se leen con cifras de una sola obra tan a menudo como con
    // cifras grandes —una cola recién revisada tiene uno o dos casos—, y
    // «1 confirmadas» delata que el número lo escribió una plantilla.
    const pl = (n, sing, plur) => `${c.nf.format(n)} ${n === 1 ? sing : plur}`;
    const kpisHTML = [
      kpi(r.total_evaluados, 'Candidatos en repositorios externos',
        'obras que DataCite, Europe PMC o Zenodo atribuyen a la institución y el universo Scopus no tiene'),
      kpi(r.confirmadas, 'Confirmadas con revisión humana',
        'caso por caso, antes de contarse — nunca automáticamente'),
      kpi(r.en_ventana, `Obras en la ventana ${ventana.inicio}-${ventana.fin}`,
        r.corroboradas_entre_fuentes
          ? `la cifra que entra al total combinado; ${pl(r.corroboradas_entre_fuentes, 'llegaba', 'llegaban')} por más de una fuente y se cuenta una vez`
          : 'la cifra que entra al total combinado de arriba'),
      kpi(r.pendientes_revision_humana, 'Pendientes de revisión',
        'todavía sin decidir: NO se cuentan como producción confirmada'),
    ].join('');

    const filaAnio = (f) => `<tr><td>${f.anio}</td><td>${c.nf.format(f.n)}</td></tr>`;
    const tabla = oe.por_anio.length ? `
      <div class="tabla-envoltura tabla-datos">
        <table>
          <thead><tr><th scope="col">Año</th>
            <th scope="col">Obras confirmadas</th></tr></thead>
          <tbody>${oe.por_anio.map(filaAnio).join('')}</tbody>
        </table>
      </div>` : `
      <p class="nota">Ninguna confirmación cae dentro de la ventana
      ${ventana.inicio}-${ventana.fin} todavía.</p>`;

    // Por fuente se cuentan APORTES, no obras: una obra corroborada por dos
    // repositorios aparece en los dos. Sumar esta columna da más que el
    // recuento de arriba, y decirlo aquí evita que alguien lea la diferencia
    // como un error de cuadratura.
    const nombreFuente = { datacite: 'DataCite', europepmc: 'Europe PMC', zenodo: 'Zenodo' };
    const filaFuente = (f) => `<tr><td>${c.escapar(nombreFuente[f.fuente] || f.fuente)}</td>
      <td>${c.nf.format(f.n)}</td></tr>`;
    const tablaFuente = (oe.por_fuente || []).length ? `
      <h3>Qué aportó cada repositorio, dentro de la misma ventana</h3>
      <p class="nota">Aportes, no obras: una obra que dos repositorios traen
      cuenta en los dos. Por eso esta columna suma más que
      ${c.nf.format(r.en_ventana)} — la diferencia ${r.corroboradas_entre_fuentes === 1
        ? 'es 1 obra corroborada'
        : `son las ${c.nf.format(r.corroboradas_entre_fuentes)} obras corroboradas`}.</p>
      <div class="tabla-envoltura tabla-datos">
        <table>
          <thead><tr><th scope="col">Repositorio</th>
            <th scope="col">Aportes confirmados</th></tr></thead>
          <tbody>${oe.por_fuente.map(filaFuente).join('')}</tbody>
        </table>
      </div>` : '';

    const extras = [];
    if (r.fuera_de_ventana) extras.push(`${pl(r.fuera_de_ventana, 'confirmada', 'confirmadas')} fuera de la ventana ${ventana.inicio}-${ventana.fin}`);
    if (r.sin_anio) extras.push(`${c.nf.format(r.sin_anio)} sin año declarado`);
    if (r.sin_doi_en_ventana) extras.push(`${pl(r.sin_doi_en_ventana, 'sin DOI, que no se puede colapsar por clave y se cuenta como un registro propio', 'sin DOI, que no se pueden colapsar por clave y se cuentan una por registro')}`);
    if (r.descartadas_por_ser_otra_version) extras.push(`${pl(r.descartadas_por_ser_otra_version, 'descartada', 'descartadas')} por ser otra versión de una obra ya contada`);
    const notaExtra = extras.length ? `
      <p class="nota">Además, ${extras.join('; ')}. Nada de esto se descarta en
      silencio.</p>` : '';

    return `
      <h2>Confirmada en repositorios de datos y acceso abierto</h2>
      <div class="kpis" data-n="4">${kpisHTML}</div>
      ${c.nota(oe.nota)}
      <h3>Por año, dentro de la ventana ${ventana.inicio}-${ventana.fin}</h3>
      ${tabla}
      ${notaExtra}
      ${c.sello(oe.procedencia)}
      ${tablaFuente}
      <p class="nota">En esta subsección, «Cobertura» es el porcentaje de lo
      confirmado que cae dentro de la ventana ${ventana.inicio}-${ventana.fin}.
      Cada obra se confirma por revisión humana, caso por caso.</p>`;
  })() : `
    <h2>Confirmada en repositorios de datos y acceso abierto</h2>
    <p class="nota">Sin obras en esta compilación: la búsqueda en DataCite,
    Europe PMC y Zenodo aún no se ha revisado, y nada se cuenta sin revisión
    humana.</p>`;

  return `${totalHTML}${pd01HTML}${pd02HTML}${pd03HTML}${pd04HTML}`;
}

/** Ficha técnica de metodologia.html: con qué datos se construyó esta carga.
    Sale entera de meta.json y validacion.json. Sustituye a la lista de
    procedencia, que daba una sola fecha de corte y se leía como si cubriera
    también a Scopus. Cada cifra lleva al lado la advertencia que la matiza:
    X-04 junto a las citas, la nota de P-01 junto al universo. Sin sello,
    firma ni hash: certificarían algo que el sitio no comprueba. */
export function fichaTecnica(meta, val, notaUniverso) {
  const fila = (e, v, nota) => `<div><dt>${c.escapar(e)}</dt><dd>${v}${
    nota ? `<span class="nota">${nota}</span>` : ''}</dd></div>`;
  const regla = (cod) => val.reglas.find(r => r.regla === cod);
  const fallan = val.reglas.filter(r => r.resultado === 'FALLA');
  const x04 = fallan.find(r => r.regla === 'X-04');
  const v10 = regla('V-10');
  const bloqueantes = val.reglas.filter(r => r.severidad === 'bloqueante').length;
  const scopus = (meta.exports || {}).Scopus;
  const d = meta.denominadores;
  return `
    <h4>Fuentes y fechas</h4>
    <dl class="ficha-datos">
      ${fila('Institución', c.escapar(meta.institucion))}
      ${meta.scopus_affiliation_id
        ? fila('Scopus Affiliation ID', `<span class="mono">${c.escapar(meta.scopus_affiliation_id)}</span>`) : ''}
      ${fila('Fuentes', c.escapar(meta.fuentes.join(' · ')))}
      ${fila('Ventana', `${meta.ventana.inicio}–${meta.ventana.fin}`)}
      ${fila('Exportación de SciVal', c.escapar(meta.fecha_export))}
      ${fila('Citas y métricas de SciVal al', c.escapar(meta.fecha_corte_citas), x04
        ? `Scopus no suma las mismas citas que SciVal; la regla <span class="mono">X-04</span> falla: ${observado(x04.observado)}.` : '')}
      ${scopus ? fila('Exportación de Scopus', c.escapar(scopus.fecha_export)) : ''}
      ${scopus ? fila('Corte de Scopus', scopus.fecha_corte ? c.escapar(scopus.fecha_corte) : 'La exportación no lo declara',
        scopus.fecha_corte ? '' : 'Los indicadores que salen de Scopus se leen a la fecha de su exportación.') : ''}
      ${fila('Compilación de los datos', c.escapar(meta.fecha_build))}
    </dl>
    <h4>Denominadores</h4>
    <dl class="ficha-datos">
      ${fila('Universo', `${c.nf.format(d.universo_total)} publicaciones`,
        notaUniverso ? c.escapar(notaUniverso) : '')}
      ${fila('Con métricas', c.nf.format(d.con_metricas))}
      ${typeof d.base_impacto === 'number' ? fila('Base de impacto', c.nf.format(d.base_impacto),
        'Publicaciones de investigación con métricas: la base de las citas, el FWCI, los percentiles y los cuartiles.') : ''}
      ${fila('Con autoría detallada', c.nf.format(d.con_autoria_detallada))}
      ${fila('Con área temática', c.nf.format(d.con_area_tematica))}
      ${v10 ? fila('Campos bajo el umbral de la auditoría', observado(v10.observado),
        `Regla V-10 · ${c.escapar(v10.descripcion)}.`) : ''}
    </dl>
    <p class="nota">Los denominadores son los declarados en la configuración
      del informe, no un recuento campo a campo: la cobertura real de cada campo va en
      la tabla «Calidad y cobertura de los datos».</p>
    <h4>Umbrales de lectura</h4>
    <dl class="ficha-datos">
      ${fila('Cobertura mínima sin advertencia', `${c.num(meta.cobertura_minima_sin_advertencia * 100)} %`)}
      ${fila('Mínimo interpretable de un recorte por unidad', `${c.nf.format(meta.n_minimo_interpretable_unidad)} publicaciones`)}
    </dl>
    <h4>Auditoría de datos</h4>
    <dl class="ficha-datos">
      ${fila('Reglas evaluadas', `${c.nf.format(val.reglas_evaluadas)} · ${c.nf.format(val.pasan)} pasan · ${
        c.nf.format(val.fallan)} falla${val.fallan === 1 ? '' : 'n'}`)}
      ${fallan.length ? fila('Fallan', fallan.map(r => `<span class="mono">${c.escapar(r.regla)}</span>`).join(', ')) : ''}
      ${fila('Bloqueantes', `${c.nf.format(bloqueantes)} reglas · ${c.nf.format(val.bloqueantes_fallando)} fallando`)}
    </dl>
    <p class="nota">Cada valor se lee al construir el sitio de <code>meta.json</code> y
      <code>validacion.json</code>, los mismos archivos que lista
      <a href="datos.html">Descarga de datos</a>.
      <a href="#validacion-datos">Ver las ${c.nf.format(val.reglas_evaluadas)} reglas →</a></p>`;
}

/** Estado de la auditoría de datos (V2-27): la misma tabla de 30 reglas que
    `docs/VALIDATION_REPORT.md`, publicada donde el sitio se ve. Antes vivía
    solo en el repositorio — un informe que se declara riguroso y no deja
    ver su propia auditoría le pide al lector que confíe sin poder
    comprobar. El resumen va siempre visible; la tabla completa entra en
    `<details>` para no imponerse sobre el resto de la página. */
export function validacion(v) {
  const filas = v.reglas.map(r => `<tr class="${r.resultado === 'FALLA' ? 'val-falla' : ''}">
      <td class="mono">${c.escapar(r.regla)}</td>
      <td>${c.escapar(r.severidad)}</td>
      <td>${c.escapar(r.descripcion)}</td>
      <td>${r.resultado === 'FALLA' ? '<strong>FALLA</strong>' : 'Pasa'}</td>
      <td>${observado(r.observado)}</td>
    </tr>`).join('');

  return `
    <p class="val-resumen">
      <strong>${c.nf.format(v.reglas_evaluadas)}</strong> reglas evaluadas ·
      <strong>${c.nf.format(v.pasan)}</strong> pasan ·
      <strong>${c.nf.format(v.fallan)}</strong> falla${v.fallan === 1 ? '' : 'n'} ·
      <strong>${c.nf.format(v.bloqueantes_fallando)}</strong> bloqueante${v.bloqueantes_fallando === 1 ? '' : 's'} fallando.
      Es la compuerta que la propia compilación no deja pasar si alguna regla bloqueante falla.
    </p>
    <details class="metodo">
      <summary>Ver las ${c.nf.format(v.reglas_evaluadas)} reglas, una por una</summary>
      <div class="metodo-cuerpo">
        <div class="tabla-envoltura"><table class="tabla-validacion">
          <thead><tr><th scope="col">Regla</th><th scope="col">Severidad</th>
            <th scope="col">Descripción</th><th scope="col">Resultado</th>
            <th scope="col">Observado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>
      </div>
    </details>`;
}

/** El glosario completo de metodologia.html, una sección por término con
    `id="{slug}"`. Es el destino de todo enlace `#slug` que apunte a una
    definición —desde el tooltip de ayuda contextual o desde otra página,
    como «Cómo se lee esta red →» en colaboracion.html— y por eso tiene que
    pre-renderizarse: sin JavaScript, esos enlaces aterrizaban en un
    contenedor vacío y el ancla no existía. */
export function glosario(entradas) {
  // Una lista de definiciones y no un h2 por término: el glosario comparte
  // banda con la ficha técnica y quince encabezados partían la página. El id
  // sigue en cada entrada, así que los enlaces `#slug` no cambian.
  return `<dl class="glosario">${entradas.map(e => `
    <div class="glosario-entrada" id="${e.slug}">
      <dt>${c.escapar(e.termino)}</dt>
      <dd><p>${c.escapar(e.corto)}</p>${e.extendido ? `<p class="nota">${c.escapar(e.extendido)}</p>` : ''}</dd>
    </div>`).join('')}</dl>`;
}

/* ══════════════════════════════════════ anexo metodológico (D-712)

   Cuatro bloques de metodologia.html que el informe no llevaba: cómo se formó
   el corpus, con qué calidad llegan sus datos, la fórmula de cada indicador
   publicado y las referencias que lo sustentan. Ninguno trae cifras escritas a
   mano: salen de metodologia.json —que el build lee de config/ y docs/—, de
   validacion.json y de los mismos publications.json y authors.json que se
   descargan. Metodología va entera al PDF, así que el anexo viaja solo. */

const ETIQUETA_DENOMINADOR = {
  universo_total: 'Universo',
  con_metricas: 'Con métricas',
  base_impacto: 'Base de impacto',
  con_autoria_detallada: 'Con autoría detallada',
  con_area_tematica: 'Con área temática',
};

/* Con un decimal; lo que no llega a una décima pero no es cero se dice así, y
   no «0,0 %», que se lee como nada: cinco citas de catorce mil no son cero. */
const pct1 = (n, total) => {
  if (!total) return '—';
  const p = (100 * n) / total;
  return n > 0 && p < 0.05 ? '&lt;&nbsp;0,1 %' : `${c.num(p, 1)} %`;
};

/* Una regla de la auditoría dicha en una línea, con su texto y su resultado
   tal como los publica validacion.json. Si la regla no se evaluó en esta
   carga se dice, en vez de omitirla: la fila afirma que se comprobó algo. */
function reglaEnLinea(val, cod) {
  const r = (val.reglas || []).find(x => x.regla === cod);
  if (!r) return `<li><span class="mono">${c.escapar(cod)}</span> no se evaluó en esta carga</li>`;
  const falla = r.resultado === 'FALLA';
  return `<li${falla ? ' class="val-falla"' : ''}><span class="mono">${c.escapar(cod)}</span> `
    + `${c.escapar(r.descripcion)}: <strong>${falla ? 'falla' : 'pasa'}</strong>`
    + ` <span class="nota">(${observado(r.observado)})</span></li>`;
}

/* Las reglas que cita el anexo. prerender.mjs comprueba que todas existan en
   validacion.json: una que se renombre en la auditoría no puede dejar la fila
   diciendo «no se evaluó» sin que el build lo note. */
export const REGLAS_ANEXO = ['E-04', 'E-08', 'E-02', 'X-01', 'I-01', 'I-04', 'I-05',
  'D-01', 'D-02', 'D-03', 'P-01', 'V-01', 'V-03', 'V-07', 'X-04', 'E-09'];

const ESTRATEGIA = {
  union: 'El universo es la unión de las dos: una publicación que trae una sola fuente se conserva, marcada, en vez de excluirse.',
  interseccion: 'El universo es la intersección de las dos: solo entran las publicaciones que traen ambas fuentes.',
  scopus: 'El universo es el de Scopus; SciVal aporta las métricas de las publicaciones que comparten.',
  scival: 'El universo es el de SciVal; Scopus aporta la autoría de las publicaciones que comparten.',
};

/** «Cómo se formó el corpus»: los pasos, cada uno con las reglas de la
    auditoría que lo comprueban en esta carga. Qué dice cada exportación de sí mismo
    —ventana, filtros, registros— viene de config/sources.yml vía
    metodologia.json; nada de eso se reescribe aquí. */
export function corpusAnexo(corpus, val, meta) {
  const e = c.escapar;
  const fuente = f => `<li><strong>${e(f.nombre)}</strong>, en ${e(String(f.formato).toUpperCase())},
      exportada el ${e(fechaLarga(f.fecha_export))}${f.fecha_corte ? ` con datos al ${e(fechaLarga(f.fecha_corte))}` : ', sin fecha de corte declarada'}.
      Ventana declarada: «${e(f.ventana_declarada)}». Filtros: «${e(f.filtros_aplicados || 'ninguno declarado')}».
      ${f.n_registros_declarado !== null && f.n_registros_declarado !== undefined
        ? `${c.nf.format(f.n_registros_declarado)} registros declarados, ${c.nf.format(f.n_registros_leido)} leídos.`
        : `${c.nf.format(f.n_registros_leido)} registros leídos; la exportación no declara cuántos trae.`}
      ${(f.advertencias_del_export || []).length
        ? `<span class="nota">La propia exportación advierte: ${f.advertencias_del_export.map(a => `«${e(a)}»`).join(' y ')}.</span>` : ''}</li>`;
  const pasos = [
    ['Exportar', `<ul class="lista-compacta">${corpus.fuentes.map(fuente).join('')}</ul>`, ['E-08', 'E-04']],
    ['Unir', `Las dos fuentes se cruzan por el EID, el identificador que Scopus asigna a cada publicación.
      ${e(ESTRATEGIA[corpus.estrategia_universo] || `Estrategia declarada: ${corpus.estrategia_universo}.`)}`,
      ['E-02', 'X-01']],
    ...(corpus.fuentes.some(f => /web of science/i.test(f.nombre)) ? [['Sumar Web of Science',
      `Cada registro de Web of Science se cruza por DOI con el universo. Si coincide, es la misma
      publicación y no se suma. Si no, se suma como exclusiva de Web of Science cuando su año está en
      la ventana y su afiliación nombra a la institución; sin métricas de SciVal, autoría detallada
      ni área temática. Los casos dudosos, como un título y año idénticos sin DOI común, los revisa
      una persona antes de contarse. Las citas de Web of Science no se suman a las de Scopus.`,
      ['W-03', 'W-04', 'W-05', 'W-06']]] : []),
    ['Atribuir a la institución', `Dos métodos independientes: el identificador de afiliación de la
      institución en Scopus (<span class="mono">${e(meta.scopus_affiliation_id)}</span>), que contiene la exportación
      de SciVal, y su nombre en la afiliación de cada autor, que contiene la de Scopus. Toda publicación
      requiere al menos uno, y cualquier desacuerdo entre ambos lo revisa una persona.`,
      ['I-01', 'I-04', 'I-05']],
    ['Marcar duplicados', `Un duplicado probable se marca y queda a la espera de revisión humana: no
      se fusiona automáticamente (D-08). Mientras no se resuelva, cada registro se contabiliza.`,
      ['D-01', 'D-02', 'D-03', 'P-01']],
    ['Contar', `Cada publicación se contabiliza una vez en las cifras de la institución. En las
      distribuciones por unidad académica y por autor se contabiliza completa en cada una —conteo
      completo—, por lo que esas distribuciones no suman el total.`, ['V-01', 'V-03']],
    ['Tomar las métricas', `Las citas, el FWCI y los percentiles son los que SciVal asigna a cada
      publicación, al ${e(fechaLarga(meta.fecha_corte_citas))}, sin recalcularlos. A partir de ellos se
      agregan los indicadores.`,
      ['V-07', 'X-04']],
  ];
  return `<div class="tabla-envoltura"><table class="tabla-anexo tabla-corpus">
      <caption class="solo-lectores">Pasos con que se formó el corpus y reglas que los comprueban</caption>
      <colgroup><col class="c-paso"><col><col class="c-comp"></colgroup>
      <thead><tr><th scope="col">Paso</th><th scope="col">Qué se hace</th>
        <th scope="col">Qué se comprueba en esta carga</th></tr></thead>
      <tbody>${pasos.map(([paso, que, reglas], i) => `<tr>
        <th scope="row">${i + 1}. ${e(paso)}</th>
        <td>${que}</td>
        <td><ul class="lista-reglas">${reglas.map(r => reglaEnLinea(val, r)).join('')}</ul></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="nota">Cada regla está, con las demás, en la <a href="#validacion-datos">auditoría de datos</a>.</p>`;
}

/** Los tipos documentales del universo, con su parte de las publicaciones y
    de las citas. */
export function tiposAnexo(tipos, corpus) {
  const n = tipos.reduce((s, t) => s + t.n, 0);
  const citas = tipos.reduce((s, t) => s + t.citas, 0);
  const scival = corpus.fuentes.find(f => /scival/i.test(f.nombre));
  // Tipología común (D-817): los datos la traen desde la carga que sigue al
  // 2026-10-01. Sin ella, el anexo describe el criterio anterior (D-720).
  const conGrupo = tipos.some(t => t.grupo);
  const GRUPO = { investigacion: 'Investigación', otros: 'Otros documentos' };
  const excluidas = corpus.excluidos_no_obra;
  const intro = conGrupo
    ? `<p>Rige una tipología común a Scopus/SciVal y Web of Science. Las <b>obras de investigación</b>
    —artículo, revisión, capítulo, libro, artículo de congreso o de datos— son la base de los indicadores
    de impacto. Los <b>otros documentos</b> —carta, nota, editorial, reseña, resumen de congreso— cuentan
    en la producción y no en el impacto. Las fe de erratas y los avisos de retractación no son obras: no
    se cuentan${typeof excluidas === 'number' && excluidas
      ? ` (${c.nf.format(excluidas)} ${excluidas === 1 ? 'excluida' : 'excluidas'} en esta carga)` : ''}.
    El FWCI compara además cada publicación con las de su mismo tipo, año y campo.</p>`
    : `<p>Se incluyen todos los tipos documentales que contienen las exportaciones${scival && scival.filtros_aplicados
      ? ` —la de SciVal lo declara: «${c.escapar(scival.filtros_aplicados)}»—` : ''}, y ninguno se excluye
    posteriormente. Todos se contabilizan en los denominadores de las cifras principales, incluidas las
    citas por publicación. El FWCI, en cambio, compara cada publicación con las de su mismo tipo, año y campo.</p>`;
  return `${intro}
    <div class="tabla-envoltura"><table class="tabla-anexo">
      <caption class="solo-lectores">Publicaciones y citas por tipo documental</caption>
      <thead><tr><th scope="col">Tipo documental</th>${conGrupo ? '<th scope="col">Grupo</th>' : ''}
        <th scope="col" class="num">Publicaciones</th>
        <th scope="col" class="num">% del universo</th><th scope="col" class="num">Citas</th>
        <th scope="col" class="num">% de las citas</th></tr></thead>
      <tbody>${tipos.map(t => `<tr><td>${c.escapar(t.tipo)}</td>${conGrupo
          ? `<td>${c.escapar(GRUPO[t.grupo] || 'Sin grupo')}</td>` : ''}
        <td class="num">${c.nf.format(t.n)}</td><td class="num">${pct1(t.n, n)}</td>
        <td class="num">${c.nf.format(t.citas)}</td><td class="num">${pct1(t.citas, citas)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><th scope="row"${conGrupo ? ' colspan="2"' : ''}>Total</th><td class="num">${c.nf.format(n)}</td><td class="num">100 %</td>
        <td class="num">${c.nf.format(citas)}</td><td class="num">100 %</td></tr></tfoot>
    </table></div>
    <p class="nota">El tipo es el que declara la fuente, como en el filtro «Tipo documental» y en la
    figura P-03. Las citas son las de SciVal al corte, sin normalizar${conGrupo
      ? '; la tabla las muestra para todos los tipos, y los indicadores de impacto suman solo las de investigación' : ''}.</p>`;
}

/* Qué campo de cada publicación usa qué indicador. Solo los que no están
   completos en todas las cargas o que la lectura necesita; los que siempre
   vienen —año, tipo, fuente— no aportan nada a esta tabla. */
const CAMPOS_ANEXO = [
  ['doi', 'DOI', 'I-07 (enlace a la publicación)'],
  ['metricas', 'Citas y FWCI', 'I-01 a I-04, I-07 a I-09, AU-02, AU-03'],
  ['percentil_citacion', 'Percentil de citación', 'I-05'],
  ['sjr_percentil', 'Percentil SJR de la revista', 'R-01'],
  ['open_access', 'Vía de acceso abierto', 'A-01',
    'La ausencia no significa acceso cerrado: la fuente no declara vía.'],
  ['asjc', 'Área ASJC', 'T-01'],
  ['qs_area', 'Área QS', 'T-05'],
  ['ods', 'Objetivo de Desarrollo Sostenible', 'T-04'],
  ['paises', 'Países', 'C-01, C-03'],
  ['instituciones', 'Instituciones', 'C-04'],
  ['autores_uft', 'Firmas de la institución', 'P-06, P-07, C-05, AU-01, AU-02, AU-03, AU-05, AU-06'],
];

/** «Calidad y cobertura de los datos»: la completitud de cada campo y las
    inconsistencias de la fuente que el informe no corrige. Las cuentas son de
    X.calidadDatos(); lo que ya comprueba la auditoría se cita con su regla. */
export function calidadAnexo(q, val, corpus, meta) {
  const e = c.escapar;
  const filas = CAMPOS_ANEXO.map(([k, campo, usan, nota]) => {
    let aviso = nota || '';
    if (k === 'autores_uft' && q.campos.autores_uft < q.n) {
      const faltan = q.n - q.campos.autores_uft;
      aviso = `${c.nf.format(faltan)} publicaci${faltan === 1 ? 'ón no nombra' : 'ones no nombran'} ninguna
        firma de la institución con forma de persona. Siguen en el universo; la auditoría documenta por
        qué (reglas E-09 e I-01).`;
    }
    return `<tr><td>${e(campo)}${aviso ? `<span class="nota">${aviso}</span>` : ''}</td>
      <td class="num">${c.nf.format(q.campos[k])}</td><td class="num">${pct1(q.campos[k], q.n)}</td>
      <td>${e(usan).replace(/[A-Z]{1,2}-\d{2}/g, m => `<span class="cod">${m}</span>`)}</td></tr>`;
  }).join('');

  const scival = corpus.fuentes.find(f => /scival/i.test(f.nombre)) || {};
  const truncadoAviso = (scival.advertencias_del_export || []).find(a => /institution/i.test(a));
  const items = [];
  if (q.doiMalFormados) {
    items.push(`<li><strong>DOI mal formado: ${c.nf.format(q.doiMalFormados)}.</strong> No tiene la forma
      que fija la norma del DOI (prefijo <span class="mono">10.</span> y registro, una barra y un sufijo).
      Se publica como lo trae la fuente, sin corregirlo a mano; ningún indicador lo usa para contar.</li>`);
  }
  if (q.sinPaisPropio.n) {
    const pp = c.num((100 * q.sinPaisPropio.nacionales) / q.n, 1);
    items.push(`<li><strong>Lista de países sin ${e(corpus.pais)}: ${c.nf.format(q.sinPaisPropio.n)}.</strong>
      Son publicaciones de la institución, así que ${e(corpus.pais)} tendría que figurar.
      ${q.sinPaisPropio.nacionales ? `La fuente marca ${q.sinPaisPropio.nacionales === q.sinPaisPropio.n ? 'todas' : c.nf.format(q.sinPaisPropio.nacionales)}
      como nacionales —con un solo país— y así las cuenta C-01; si ${e(corpus.pais)} figurara serían
      internacionales, y la colaboración internacional subiría como máximo ${pp} puntos.` : ''}</li>`);
  }
  if (q.institucionesTruncadas.length) {
    const faltan = q.institucionesTruncadas.reduce((s, t) => s + t.declaradas - t.listadas, 0);
    const k = q.institucionesTruncadas.length;
    items.push(`<li><strong>Lista de instituciones truncada: ${c.nf.format(k)}.</strong>
      ${k === 1 ? `Declara ${c.nf.format(q.institucionesTruncadas[0].declaradas)} instituciones y lista
      ${c.nf.format(q.institucionesTruncadas[0].listadas)}` : `Declaran más instituciones de las que listan`}${
      truncadoAviso ? `; la exportación de SciVal lo advierte («${e(truncadoAviso)}»)` : ''}.
      C-04 no cuenta ${faltan === 1 ? 'la que falta' : `las ${c.nf.format(faltan)} que faltan`}.</li>`);
  }
  if (q.orcid.compartidos) {
    items.push(`<li><strong>ORCID en más de una ficha de autor: ${c.nf.format(q.orcid.compartidos)}.</strong>
      Los comparten ${c.nf.format(q.orcid.fichasCompartidas)} fichas, así que las
      ${c.nf.format(q.orcid.fichas)} fichas con ORCID son ${c.nf.format(q.orcid.distintos)} identificadores
      distintos. Compartirlo no fusiona fichas: el caso espera revisión humana y cada ficha lo advierte.</li>`);
  }
  return `<div class="tabla-envoltura"><table class="tabla-anexo tabla-calidad">
      <caption class="solo-lectores">Publicaciones con dato en cada campo</caption>
      <thead><tr><th scope="col">Campo</th><th scope="col" class="num">Con dato</th>
        <th scope="col" class="num">% de ${c.nf.format(q.n)}</th><th scope="col">Lo usan</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
    <p class="nota">La unidad académica no está en la tabla porque no se mide sobre publicaciones sino
    sobre pares autor × publicación: su cobertura está en las advertencias principales y en la regla
    <span class="mono">V-10</span>. Cuando el campo de una figura cubre menos del
    ${c.num(meta.cobertura_minima_sin_advertencia * 100)} % de las publicaciones que se miran, lo declara
    la advertencia de su indicador en el anexo.</p>
    <h4>Inconsistencias de la fuente que el informe no corrige</h4>
    <p>Se cuentan y se declaran; ninguna se corrige a mano (D-08).</p>
    <ul class="lista-calidad">${items.join('')}
      ${['D-02', 'P-01', 'X-04'].map(r => reglaEnLinea(val, r)).join('')}
    </ul>
    <p class="nota">Las cuentas de arriba se hacen al construir el sitio sobre
    <code>publications.json</code> y <code>authors.json</code>, los archivos de
    <a href="datos.html">Descarga de datos</a>: cualquiera puede repetirlas.</p>`;
}

/** El catálogo de los indicadores publicados, con su fórmula. La definición y
    el cálculo salen de docs/INDICATORS.md; nombre, base y cautela, de
    config/indicators.yml (04_glossary.py los junta en metodologia.json). */
/* `notas` son las notas de cada figura (`vista_explorador.notasDeFiguras`):
   desde D-754 no van pegadas a la figura sino aquí, en la fila de su
   indicador, a la que la figura remite. */
export function indicadoresAnexo(indicadores, categorias, meta, notas = {}) {
  const e = c.escapar;
  const orden = Object.keys(categorias || {});
  const grupos = new Map();
  for (const i of indicadores) {
    if (!grupos.has(i.categoria)) grupos.set(i.categoria, []);
    grupos.get(i.categoria).push(i);
  }
  const claves = [...grupos.keys()].sort((a, b) =>
    (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99));
  const base = (d) => (d ? `${e(ETIQUETA_DENOMINADOR[d] || d)}${meta.denominadores && meta.denominadores[d] !== undefined
    ? ` · ${c.nf.format(meta.denominadores[d])}` : ''}` : '—');
  return claves.map(k => `<section class="modulo anexo-grupo" aria-labelledby="anexo-${e(k)}">
      <h3 id="anexo-${e(k)}">${e((categorias || {})[k] || k)}</h3>
      <div class="tabla-envoltura"><table class="tabla-anexo tabla-indicadores">
        <colgroup><col class="c-cod"><col><col class="c-calc"><col class="c-base"><col class="c-fuente"></colgroup>
        <thead><tr><th scope="col">Código</th><th scope="col">Indicador</th>
          <th scope="col">Cálculo</th><th scope="col">Base</th><th scope="col">Fuente</th></tr></thead>
        <tbody>${grupos.get(k).map(i => `<tr id="ind-${e(i.codigo)}">
          <td class="mono">${e(i.codigo)}</td>
          <td><strong>${e(i.nombre)}</strong><br>${e(i.definicion)}${i.advertencia
            ? `<span class="nota"><b>Advertencia.</b> ${e(i.advertencia)}</span>` : ''}${
            (notas[i.codigo] || []).map((n) => `<span class="nota"><b>Nota de la figura.</b> ${e(n)}</span>`).join('')}</td>
          <td><code>${e(i.logica)}</code></td>
          <td>${base(i.denominador)}</td>
          <td>${e(i.fuente)}${i.confiabilidad ? `<span class="nota">Confiabilidad
            <a href="#confiabilidad">${e(i.confiabilidad)}</a>${i.nota_confiabilidad
              ? `. ${e(i.nota_confiabilidad)}` : ''}</span>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>`).join('');
}

/** La definición de la confiabilidad alta/media/baja (D-721), leída de
    docs/INDICATORS.md §2 bis por el build. Va encima del catálogo de
    indicadores: la etiqueta de cada fila remite a esta tabla. */
export function confiabilidadAnexo(niveles) {
  const e = c.escapar;
  return `<div class="tabla-envoltura"><table class="tabla-anexo tabla-confiabilidad">
      <caption class="solo-lectores">Qué significa cada nivel de confiabilidad</caption>
      <thead><tr><th scope="col">Nivel</th><th scope="col">Cobertura del dato</th>
        <th scope="col">Cómo se calcula</th><th scope="col">Qué lo desestabiliza</th></tr></thead>
      <tbody>${niveles.map(n => `<tr><th scope="row">${e(n.nivel.charAt(0).toUpperCase() + n.nivel.slice(1))}</th>
        <td>${e(n.cobertura)}</td><td>${e(n.calculo)}</td><td>${e(n.desestabiliza)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="nota">Cada indicador toma el nivel del más débil de los tres rasgos. Describe cuánto
    se puede apoyar una lectura en la cifra, no la calidad de lo que mide.</p>`;
}

/** Las referencias en APA 7, agrupadas por lo que sustentan y en orden
    alfabético dentro de cada grupo, como pide la norma. La cursiva llega en
    tramos desde el build (REFERENCIAS.md no se interpreta como Markdown). */
export function referenciasAnexo(referencias) {
  const e = c.escapar;
  const plano = r => r.cita.map(t => t.texto).join('');
  const grupos = new Map();
  for (const r of referencias) {
    if (!grupos.has(r.categoria)) grupos.set(r.categoria, []);
    grupos.get(r.categoria).push(r);
  }
  return [...grupos].map(([cat, refs]) => `<section class="modulo referencias-grupo">
      <h3>${e(cat)}</h3>
      <ul class="referencias">${[...refs].sort((a, b) => plano(a).localeCompare(plano(b), 'es')).map(r => `
        <li id="ref-${e(r.clave)}"><p class="referencia">${r.cita.map(t =>
          (t.cursiva ? `<i>${e(t.texto)}</i>` : e(t.texto))).join('')}${r.enlace
          ? ` <a href="${e(r.enlace)}" target="_blank" rel="noopener">${e(r.enlace)}</a>` : ''}</p>
          <p class="nota"><strong>Sustenta:</strong> ${e(r.sustenta)}</p></li>`).join('')}
      </ul>
    </section>`).join('');
}
