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
   viviendo en paginas.js. Aquí sólo se emite el marcado que esa interacción
   después manipula. */

import * as c from './core.js';

/* El FWCI mediano (0,41) frente a la media (0,87) es el dato que más fácilmente
   se malinterpreta: se explicita en portada, no sólo en el módulo. */
export function lectura(kpisLista) {
  const fwci = kpisLista.find(k => k.codigo === 'I-03');
  if (!fwci) return '';
  return `<div class="modulo modulo-lectura">
    <h2>Cómo leer estas cifras</h2>
    <p>El FWCI compara las citas recibidas con las esperadas para
    publicaciones del mismo campo, año y tipo: <strong>1,0 es el promedio
    mundial</strong>. Aquí la media es ${c.num(fwci.valor, 2)} y la mediana
    ${c.num(fwci.mediana, 2)}. La diferencia entre ambas indica una
    distribución asimétrica: unas pocas publicaciones muy citadas elevan el
    promedio.</p>
    ${c.nota(fwci.nota)}
    <p class="nota">Cada indicador declara sobre cuántas publicaciones se
    calcula. No todas las publicaciones tienen métricas: el denominador
    cambia según el indicador.</p>
  </div>`;
}

/** Banda de cierre de la portada: la salida a las secciones.

    Se genera en vez de escribirse en el HTML para que no pueda divergir de
    PAGINAS: si mañana se añade una sección, aparece aquí sola. Va sobre el
    suelo de énfasis, que sólo admite tipografía y enlaces. */
export function cierrePortada() {
  const salidas = c.PAGINAS.filter(([href]) =>
    ['produccion.html', 'impacto.html', 'colaboracion.html', 'tematica.html'].includes(href));
  return `
    <div class="banda-titulo">
      <h2>Cada indicador declara su propio denominador.</h2>
      <p>Las cifras de este informe no se miden todas sobre el mismo conjunto,
      y por eso dos de ellas pueden diferir sin contradecirse. Cada gráfico
      lleva pegada su fuente, su fecha de corte y sobre cuántos casos está
      medido.</p>
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
     catálogo es la única página donde los dieciocho se ven juntos, así que es
     donde se eligen: en una sección sólo están los suyos, y elegir «un gráfico
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
          ${r.confiabilidad ? `<br><span class="nota">confiabilidad ${c.escapar(r.confiabilidad)}</span>` : ''}
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
    sitio (hoy sólo Medicina). PD-02 es lo que OpenAlex atribuye a la
    institución y un humano confirmó caso por caso (V2-26). PD-03 es lo
    que sus propios autores autoarchivaron en el repositorio institucional,
    con la Facultad o Escuela que biblioteca les asignó — cubre TODAS las
    Facultades a la vez, pero esa unidad viene en bruto: sólo se agrega por
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
    <p class="nota">Todavía no hay ninguna fuente de producción fuera de
    Scopus: ni una Facultad con listado propio en
    <code>config/sources.yml</code>, ni <code>internal/openalex_cobertura.csv</code>
    (V2-26), ni <code>data/enriched/autoarchivo_produccion.json</code>, ni
    <code>internal/obras_externas_cobertura.csv</code>. Esta
    sección aparece vacía a propósito: el dato es opcional, no un indicador
    que debiera existir.</p>`;
  }

  const kpi = (valor, etiqueta, secundario) => `
    <div class="kpi">
      <span class="valor">${c.nf.format(valor)}</span>
      <span class="etiqueta">${c.escapar(etiqueta)}</span>
      ${secundario ? `<span class="secundario">${c.escapar(secundario)}</span>` : ''}
    </div>`;

  // Fila «Facultad · año · N», compartida por las tablas de PD-01 y PD-03
  // (las dos únicas fuentes que agregan a este nivel; PD-02 no tiene
  // Facultad y usa su propia fila, sólo año).
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
        `por las Facultades participantes, ${resumen.duplicados_colapsados_por_doi} duplicados de la fuente ya colapsados`),
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
    declarado en <code>config/sources.yml</code>.</p>`;

  const pd02HTML = hayPD02 ? (() => {
    const r = oa.resumen;
    const kpisHTML = [
      kpi(r.total_evaluados, 'Candidatos evaluados por OpenAlex',
        'obras que OpenAlex atribuye a la institución y el universo Scopus no tiene (V2-26)'),
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
      <h2>Confirmada por revisión de cobertura OpenAlex (V2-26)</h2>
      <div class="kpis" data-n="4">${kpisHTML}</div>
      ${c.nota(oa.nota)}
      <h3>Por año, dentro de la ventana ${ventana.inicio}-${ventana.fin}</h3>
      ${tabla}
      ${notaExtra}
      ${c.sello(oa.procedencia)}
      <p class="nota">En esta subsección, «Cobertura» es el porcentaje de lo
      confirmado que cae dentro de la ventana ${ventana.inicio}-${ventana.fin}.
      Revisión caso por caso en
      <code>internal/revision_cobertura_openalex.html</code>.</p>`;
  })() : `
    <h2>Confirmada por revisión de cobertura OpenAlex (V2-26)</h2>
    <p class="nota">Falta <code>internal/openalex_cobertura.csv</code>: correr
    <code>src/enrich/openalex_cobertura.py</code>.</p>`;

  const pd03HTML = hayPD03 ? (() => {
    const r = aa.resumen;
    const kpisHTML = [
      kpi(r.total_leido, 'Registros autoarchivados',
        `${r.duplicados_colapsados_por_doi} duplicados de la fuente ya colapsados`),
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
      — sólo unidades con relación escuela→Facultad validada</h3>
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
    <p class="nota">Falta <code>data/enriched/autoarchivo_produccion.json</code>:
    correr <code>src/enrich/autoarchivo_produccion.py</code>.</p>`;

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
      Revisión caso por caso en
      <code>internal/revision_obras_externas.html</code>.</p>`;
  })() : `
    <h2>Confirmada en repositorios de datos y acceso abierto</h2>
    <p class="nota">Falta <code>internal/obras_externas_cobertura.csv</code>:
    correr <code>src/enrich/obras_externas.py</code>.</p>`;

  return `${totalHTML}${pd01HTML}${pd02HTML}${pd03HTML}${pd04HTML}`;
}

/** La lista de procedencia de metodologia.html: fuentes, ventana temporal,
    fecha de corte de citas, export de origen y build. Vivía inline en
    paginas.js — se saca aquí por lo mismo que el resto del archivo: para que
    el prerenderizado no tenga una segunda copia del marcado. */
export function procedencia(meta) {
  return `
    <ul>
      <li>Fuentes: ${meta.fuentes.join(', ')}</li>
      <li>Ventana temporal: ${meta.ventana.inicio}–${meta.ventana.fin}</li>
      <li>Citas actualizadas al: <strong>${meta.fecha_corte_citas}</strong></li>
      <li>Export de origen: ${meta.fecha_export}</li>
      <li>Publicaciones: ${c.nf.format(meta.denominadores.universo_total)} ·
          con métricas: ${c.nf.format(meta.denominadores.con_metricas)} ·
          con autoría detallada: ${c.nf.format(meta.denominadores.con_autoria_detallada)}</li>
      <li>Build: ${meta.fecha_build}</li>
    </ul>`;
}

/** Estado de la auditoría de datos (V2-27): la misma tabla de 30 reglas que
    `docs/VALIDATION_REPORT.md`, publicada donde el sitio se ve. Antes vivía
    sólo en el repositorio — un informe que se declara riguroso y no deja
    ver su propia auditoría le pide al lector que confíe sin poder
    comprobar. El resumen va siempre visible; la tabla completa entra en
    `<details>` para no imponerse sobre el resto de la página. */
export function validacion(v) {
  const filas = v.reglas.map(r => `<tr class="${r.resultado === 'FALLA' ? 'val-falla' : ''}">
      <td class="mono">${c.escapar(r.regla)}</td>
      <td>${c.escapar(r.severidad)}</td>
      <td>${c.escapar(r.descripcion)}</td>
      <td>${r.resultado === 'FALLA' ? '<strong>FALLA</strong>' : 'Pasa'}</td>
      <td>${c.escapar(r.observado)}</td>
    </tr>`).join('');

  return `
    <p class="val-resumen">
      <strong>${c.nf.format(v.reglas_evaluadas)}</strong> reglas evaluadas ·
      <strong>${c.nf.format(v.pasan)}</strong> pasan ·
      <strong>${c.nf.format(v.fallan)}</strong> falla${v.fallan === 1 ? '' : 'n'} ·
      <strong>${c.nf.format(v.bloqueantes_fallando)}</strong> bloqueante${v.bloqueantes_fallando === 1 ? '' : 's'} fallando.
      Es la compuerta que el propio build no deja pasar si alguna regla bloqueante falla.
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
  return entradas.map(e => `
    <section class="modulo" id="${e.slug}">
      <h2>${c.escapar(e.termino)}</h2>
      <p>${c.escapar(e.corto)}</p>
      ${e.extendido ? `<p class="nota">${c.escapar(e.extendido)}</p>` : ''}
    </section>`).join('');
}
