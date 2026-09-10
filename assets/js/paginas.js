/* paginas.js — renderizadores por página.
   Se despacha según data-pagina en <body>. */

import * as c from './core.js';
import * as v from './vista.js';
import * as X from './explorador.js';
import * as VX from './vista_explorador.js';
import * as anim from './animar.js';
import { montarHeatmap } from './visualizations/heatmap.js';
import { montarTreemap, construirArbol } from './visualizations/treemap.js';

/* ============================================================== portada */

/* El pre-renderizador ya dejó este HTML escrito en el archivo. Repintarlo
   destruiría un LCP que ya ocurrió y volvería a pagar el coste de dibujar
   veinte SVG. Si el marcado está, sólo se enganchan los comportamientos. */
const yaPintado = el => el && el.dataset.prerender === '1';

/* La portada es un EXPLORADOR: el lector elige un recorte y las cifras y los
   gráficos se recalculan sobre él, aquí, sin volver al servidor.

   El HTML llega pre-renderizado con el recorte VACÍO —el informe completo—, así
   que sin JavaScript se ve el informe entero. Esta función no reescribe nada
   hasta que alguien toca un filtro: engancha el comportamiento y se aparta. */
async function portada() {
  montarDescargaInforme();      // no se espera: es un añadido, no la portada
  return montarExplorador(null);
}

/** El bloque de descarga del informe completo.

    Existe porque el botón «Descargar informe» resuelve una cosa y no la otra:
    da la página que se está mirando, con sus filtros, y no el informe entero
    con sus seis secciones, su índice y sus hojas numeradas. Eso sólo lo compone
    `make informe`, y hasta ahora había que tener el proyecto instalado para
    conseguirlo.

    Se dibuja SÓLO si existe `data/informe.json`, el manifiesto que deja la
    corrida que generó los PDF. Sin manifiesto no hay bloque: enlaces escritos
    a mano en el HTML apuntarían a archivos que pueden no estar, o que están y
    son de otra carga de datos, y un informe que contradice al sitio del que
    cuelga es peor que no ofrecerlo.

    Por la misma razón compara la fecha de build del manifiesto con la del
    sitio y lo dice cuando no coinciden, en vez de callarlo. */
/** Escribe la lectura de una figura que no vive en un `.corte`.

    Las figuras bento se montan desde `paginas.js` y no pasan por
    `vista_explorador.js`, así que no reciben su `bloqueLectura()`. El texto es
    el mismo y el registro también; lo único distinto es quién lo coloca. */
function ponerLectura(id, textos, clave) {
  const el = document.getElementById(id);
  const l = (textos?.lecturas || {})[clave];
  if (!el || !l) return;
  el.innerHTML = `<b>Qué muestra</b> ${c.escapar(l.muestra)}`;
  el.hidden = false;
}

async function montarDescargaInforme() {
  const caja = document.getElementById('informe-pdf');
  if (!caja) return;
  let inf, meta;
  try {
    [inf, meta] = await Promise.all([c.cargar('informe.json'), c.cargar('meta.json')]);
  } catch { return; }                    // no se generó: no se ofrece
  if (!inf?.archivos?.length) return;

  const viejo = inf.build && meta.fecha_build && inf.build !== meta.fecha_build;
  caja.innerHTML = `
    <h2>El informe completo, en PDF</h2>
    <p class="informe-pdf-intro">Las seis secciones con sus gráficos explicados,
      hojas numeradas e índice. ${c.nf.format(inf.hojas)} hojas en
      ${inf.archivos.length} archivos, uno por sección.
      El botón «Descargar informe» de arriba hace otra cosa: da la página que
      está viendo, con los filtros que tenga puestos.</p>
    ${viejo ? `<p class="nota-destacada"><b>Informe de una carga anterior.</b>
      Se compuso con los datos del ${c.escapar(inf.build)} y el sitio sirve los
      del ${c.escapar(meta.fecha_build)}. Las cifras del PDF pueden no coincidir
      con las de esta página.</p>` : ''}
    <ul class="informe-pdf-lista">${inf.archivos.map(a => `
      <li><a href="${c.escapar(a.archivo)}" download>${c.escapar(a.nombre)}</a>
        <span class="informe-pdf-dato">${a.hojas} ${a.hojas === 1 ? 'hoja' : 'hojas'}
          · ${c.nf.format(a.kb)} KB</span></li>`).join('')}
    </ul>`;
  caja.hidden = false;
}

/* Las secciones son el mismo explorador con OTROS cortes. Se comparte la
   función entera en vez de duplicarla: filtros, estado, URL y navegación son
   idénticos, y lo único que cambia es qué se dibuja con el recorte. */
async function seccion() {
  const clave = document.getElementById('contenido')?.dataset.seccion;
  return montarExplorador(clave || null);
}

/* Estado del recorte en la barra de vigencia, en sus dos formas: el badge de
   pantalla y la línea que se imprime. La barra pertenece al cromo aux
   (core.js) y existe en todas las páginas; éste es el único sitio donde se
   enciende el badge `.recorte-vivo`. En cualquier otra página queda oculto por
   su atributo hidden. Un vistazo a la parte superior debe bastar para saber
   que hay un recorte activo, sin bajar a los controles. */
function actualizarRecorteVivo(publicaciones, sel) {
  const n = X.recorte(publicaciones, sel).length;
  const total = publicaciones.length;
  const activo = X.hayRecorte(sel);

  const badge = document.getElementById('recorte-vivo');
  if (badge) {
    badge.hidden = !activo;
    if (activo) {
      badge.innerHTML = `Recorte <b>${c.nf.format(n)}</b> de ${c.nf.format(total)} publicaciones`;
    }
  }

  /* La misma declaración, para el informe que se descarga. `estado()` ya
     escribe en la página la frase obligatoria «N de M · qué filtros», pero es
     un bloque de pantalla: trae el botón «Ver todo» y el enlace al listado,
     que en una hoja de papel no llevan a ninguna parte. La hoja de impresión
     lo retira y esta línea ocupa su lugar, con la misma información y sin los
     controles.

     Mismo origen que la pantalla: la descripción sale de `X.describir(sel)`,
     no de un segundo texto escrito aquí, y la redacción de `c.fraseRecorte()`,
     que es la que el cromo deja pre-renderizada. */
  const papel = document.getElementById('recorte-impreso');
  if (papel) papel.textContent = c.fraseRecorte(n, total, X.describir(sel));
}

/* Selector de año en la barra de vigencia. Al elegir un año se filtra el
   explorador de la página de inmediato (mismo recorte que tocar el chip de
   año en los controles). Se rellena con los años reales del corpus y se
   preselecciona el año activo, si lo hay; en una página sin explorador nunca
   se llama y el select queda oculto.

   El `<select>` es un elemento estable de la barra común, así que el escucha
   se engancha UNA vez y el contenido se redibuja en cada repintado — volver a
   engancharlo a cada `pintar` acumularía manejadores. `actual()` devuelve el
   recorte vigente en cada momento y `cambiar(s)` lo sustituye y repinta. */
function montarSelectorAnio(publicaciones, actual, cambiar) {
  const env = document.getElementById('recorte-anio-env');
  const selAnio = document.getElementById('recorte-anio');
  if (!env || !selAnio) return;
  selAnio.addEventListener('change', () => {
    const v = selAnio.value;
    const s = { ...actual(), anio: undefined };
    if (v) s.anio = [v];
    cambiar(s);
  });
  redibujarSelectorAnio(publicaciones, actual(), selAnio, env);
}

/* Refresca las opciones del selector y el valor activo tras un repintado. */
function redibujarSelectorAnio(publicaciones, sel, selAnio, env) {
  if (!selAnio || !env) return;
  const años = X.facetas(publicaciones, sel, 'anio');
  const lista = [...años.keys()]
    .filter(a => a !== 'Sin dato declarado')
    .sort((a, b) => Number(b) - Number(a));
  if (lista.length < 2) { env.hidden = true; return; }
  env.hidden = false;
  const activo = (sel.anio || [])[0] || '';
  selAnio.innerHTML = '<option value="">Todo el periodo</option>'
    + lista.map(a => `<option value="${a}"${a === activo ? ' selected' : ''}>${a}</option>`).join('');
}

/* Mini-foco de la portada: unos atajos de un toque para entrar al explorador
   con un recorte ya aplicado, sin pasar por los filtros. No duplica los
   controles: son entradas rápidas, no un segundo panel de filtrado. Si hay un
   recorte activo, la misma fila ofrece «Ver todo» para deshacerlo.

   El clic se delega en el contenedor estático `#minifoco`, así que el escucha
   se engancha una vez y la fila se redibuja en cada repintado. */
function montarMiniFoco(publicaciones, actual, cambiar, claveSeccion) {
  const cont = document.getElementById('minifoco');
  if (!cont || claveSeccion) return;
  cont.addEventListener('click', e => {
    const b = e.target.closest('.foco-boton');
    if (!b) return;
    const f = b.dataset.foco;
    const s = { ...actual(), anio: undefined };
    if (f !== 'todo') s.anio = [f.split(':')[1]];
    cambiar(s);
  });
  redibujarMiniFoco(publicaciones, actual(), cont);
}

/* Refresca los botones del mini-foco tras un repintado. */
function redibujarMiniFoco(publicaciones, sel, cont) {
  if (!cont) return;
  const años = X.facetas(publicaciones, sel, 'anio');
  const ultimo = [...años.keys()]
    .filter(a => a !== 'Sin dato declarado')
    .sort((a, b) => Number(b) - Number(a))[0];
  const activo = X.hayRecorte(sel);
  const botones = [];
  if (ultimo) botones.push(
    `<button type="button" class="foco-boton" data-foco="anio:${ultimo}">Publicaciones ${ultimo}</button>`);
  if (activo) botones.push(
    `<button type="button" class="foco-boton foco-limpiar" data-foco="todo">Ver todo</button>`);
  cont.innerHTML = botones.length
    ? `<div class="minifoco-bar"><span class="minifoco-titulo">Exploración rápida</span>${
        botones.join('')}</div>` : '';
}

async function montarExplorador(claveSeccion) {
  const cabecera = document.getElementById('titular');
  const zonas = {
    estado: document.getElementById('estado-recorte'),
    controles: document.getElementById('controles'),
    cifras: document.getElementById('cifras'),
    cortes: document.getElementById('cortes'),
    // Sólo existen en produccion.html (Bento Grid). El resto de las
    // secciones no tiene estos contenedores y quedan en null — se
    // comprueban antes de usarlos, igual que zonas.diferidos.
    heatmap: document.getElementById('heatmap-contenedor'),
    treemap: document.getElementById('treemap-contenedor'),
  };
  if (!zonas.cifras) return;

  const { publicaciones } = await c.cargar('publications.json');

  // La procedencia de cada indicador. Se carga SIEMPRE, esté la página
  // pre-renderizada o no: al repintar un recorte los sellos se rehacen con él,
  // y sin este mapa saldrían sin fuente ni fecha.
  const metaBase = await c.cargar('meta.json');
  const proc = VX.procedencias(await c.cargar('series.json'), metaBase);
  // Escuela -> facultad (P-07): mismo criterio que agrega el build, para que
  // el gráfico reactivo no mezcle facultades y escuelas sueltas en una
  // misma lista de barras (ver `porFacultad()` en explorador.js).
  const jerarquia = metaBase.jerarquia || {};

  // Persona → unidad académica, sólo para C-05 (red de coautoría): una
  // publicación no trae la unidad por autor individual, así que el corte de
  // colaboración necesita esta tabla aparte. Se carga siempre —barato, un
  // Map de una entrada por entidad— para que funcione igual con o sin
  // pre-renderizado.
  const autores = await c.cargar('authors.json');
  const unidadPorPersona = new Map(
    autores.autores.map(a => [a.nombre, (a.unidades || [])[0]]));
  // El umbral de interpretabilidad, del mismo artefacto y con el mismo valor
  // que aplica la ficha. No se copia aquí: dos umbrales para una misma regla
  // es la forma de que acaben diciendo cosas distintas.
  const umbral = autores.parametros?.n_minimo_interpretable;

  /* Los textos que explican cada gráfico EN EL PAPEL: qué muestra —de
     `docs/LECTURAS.md`, vía `lecturas.json`— y qué cuidado exige —la
     advertencia que el catálogo ya publica en `indicadores.html`—. Se cargan
     siempre, esté la página pre-renderizada o no, porque el botón de descarga
     está en todas y el PDF no puede salir con la mitad de sus figuras
     explicadas. */
  const [{ lecturas }, catalogo] = await Promise.all([
    c.cargar('lecturas.json'), c.cargar('catalogo.json'),
  ]);
  const textos = {
    lecturas,
    advertencias: Object.fromEntries(
      catalogo.indicadores.filter(i => i.advertencia).map(i => [i.codigo, i.advertencia])),
  };

  if (!yaPintado(zonas.cifras)) {
    const meta = await c.cargar('meta.json');
    if (cabecera) {
      cabecera.innerHTML = claveSeccion
        // `tituloDeSeccion` y no un `split()` aquí: el pre-renderizador hace
        // lo mismo, y la regla estaba escrita dos veces y mal las dos.
        ? VX.cabeceraSeccion(claveSeccion, c.tituloDeSeccion(document.title),
            (await c.cargar('ejes.json')).ejes[claveSeccion])
        : VX.cabecera(meta);
    }
    const lectura = document.getElementById('lectura');
    if (lectura) lectura.innerHTML = v.lectura((await c.cargar('kpis.json')).kpis);
    const cierre = document.getElementById('cierre');
    if (cierre) cierre.innerHTML = v.cierrePortada();

    // Los indicadores DIFERIDOS siguen apareciendo. Que un indicador esté
    // verificado y no se publique es información del informe: un hueco se
    // leería como que el fenómeno no existe. No responden al recorte —no se
    // calculan— y por eso van sobre su propio suelo, separados de lo que sí.
    const dif = document.getElementById('diferidos');
    if (dif && claveSeccion) dif.innerHTML = VX.diferidos(catalogo, claveSeccion);
  }

  let sel = X.leerURL();

  function pintar({ nuevaEntrada = false } = {}) {
    const partes = claveSeccion
      ? VX.seccion(publicaciones, sel, claveSeccion, proc, unidadPorPersona, jerarquia,
          metaBase, umbral, textos)
      : VX.explorador(publicaciones, sel, proc, jerarquia, metaBase, umbral, textos);
    // Se comparan los valores ANTES de reemplazar el marcado: la señal de
    // cambio sólo debe encenderse en las cifras que de verdad cambiaron.
    const antes = new Map([...zonas.cifras.querySelectorAll('[data-valor]')]
      .map(e => [e.dataset.valor, e.textContent]));

    zonas.estado.innerHTML = partes.estado;
    zonas.controles.innerHTML = partes.controles;
    zonas.cifras.innerHTML = partes.cifras;
    actualizarRecorteVivo(publicaciones, sel);
    redibujarSelectorAnio(publicaciones, sel,
      document.getElementById('recorte-anio'), document.getElementById('recorte-anio-env'));
    redibujarMiniFoco(publicaciones, sel, document.getElementById('minifoco'));
    // Los cortes se repintan DENTRO de la transición: hay que medir la
    // geometría antes y después del cambio, y el orden sólo se garantiza si el
    // repintado ocurre en medio.
    anim.transicion(zonas.cortes, () => { zonas.cortes.innerHTML = partes.cortes; });

    // El mapa de calor de temáticas (Bento Grid) reacciona al mismo recorte
    // que el resto de la página: mismo criterio, un solo filtro. No lleva
    // pantalla de "sin datos" separada — montarHeatmap() ya la resuelve.
    if (zonas.heatmap) montarHeatmap(zonas.heatmap, X.recorte(publicaciones, sel));

    // El treemap cuenta pares autor×publicación (criterio de
    // 07_hierarchy.py, distinto del resto de la página) — construirArbol()
    // es el mismo cálculo portado a JS, verificado línea a línea contra
    // hierarchy.json sobre el corpus completo antes de usarse aquí (mismo
    // resultado, sin recorte). Se recalcula en TODO pintar(), incluida la
    // limpieza del recorte: si sólo se recalculara cuando hay filtro activo,
    // "Ver todo" habría dejado el treemap congelado en el último filtro.
    if (zonas.treemap) {
      montarTreemap(zonas.treemap,
        construirArbol(X.recorte(publicaciones, sel), jerarquia, metaBase.institucion_corta));
    }


    zonas.cifras.querySelectorAll('[data-valor]').forEach(e => {
      if (antes.size && antes.get(e.dataset.valor) !== e.textContent) e.classList.add('cambia');
    });
    X.escribirURL(sel, !nuevaEntrada);
    if (claveSeccion) scrollSpy(document.getElementById('contenido'));
  }

  // El selector de año de la barra y el mini-foco de la portada no guardan el
  // recorte ellos mismos: aplican un recorte nuevo a través de este cierre,
  // que es el único dueño de `sel` y del repintado. `actual()` siempre devuelve
  // el recorte vigente, así que el handler nunca trabaja con uno anticuado.
  const actual = () => sel;
  const cambiar = nuevo => { sel = nuevo; pintar({ nuevaEntrada: true }); };
  montarSelectorAnio(publicaciones, actual, cambiar);
  montarMiniFoco(publicaciones, actual, cambiar, claveSeccion);

  // Un solo escucha delegado para los chips y para el botón de limpiar: los
  // controles se repintan enteros a cada cambio, así que enganchar escuchas a
  // cada botón los dejaría colgando del marcado anterior.
  document.addEventListener('click', e => {
    // C-05: fijar/soltar un nodo y resaltar sus coautores. Se resuelve sin
    // volver a pedir datos ni repintar `zonas.cortes` —a diferencia de un
    // filtro— porque no cambia el recorte, sólo qué se resalta.
    const nodoRed = e.target.closest('.nodo-red[data-red-nodo]');
    if (nodoRed) { alternarFocoRed(nodoRed); return; }
    const chip = e.target.closest('.chip[data-dim]');
    if (chip) {
      const { dim, valor } = chip.dataset;
      const actual = sel[dim] || [];
      sel = { ...sel, [dim]: actual.includes(valor)
        ? actual.filter(x => x !== valor) : [...actual, valor] };
      pintar({ nuevaEntrada: true });
      // El foco se pierde al reemplazar el marcado; se devuelve al mismo
      // control para que se pueda seguir filtrando con el teclado.
      const vuelta = zonas.controles.querySelector(
        `.chip[data-dim="${CSS.escape(dim)}"][data-valor="${CSS.escape(valor)}"]`);
      if (vuelta) vuelta.focus();
      return;
    }
    if (e.target.closest('#limpiar-recorte')) {
      sel = {};
      pintar({ nuevaEntrada: true });
      zonas.estado.querySelector('.recorte-n')?.scrollIntoView({ block: 'nearest' });
    }
  });

  /* El campo de persona. `change` y no `click`: se elige del autocompletado del
     navegador, con el ratón o con el teclado, y ninguna de las dos vías pasa
     por un clic sobre un elemento nuestro.

     Sólo entra un nombre que exista en el corpus. Un texto a medio escribir
     dejaría la página vacía y con un filtro que nadie puede quitar porque no
     corresponde a nadie; escribir bien un apellido no es responsabilidad del
     lector. El campo se limpia solo: el panel se repinta entero. */
  document.addEventListener('change', e => {
    if (e.target.id !== 'q-autor') return;
    const nombre = e.target.value.trim();
    if (!nombre || !X.publicacionesDe(publicaciones, nombre)) return;
    const puestos = sel.autor || [];
    if (!puestos.includes(nombre)) sel = { ...sel, autor: [...puestos, nombre] };
    pintar({ nuevaEntrada: true });
    zonas.controles.querySelector('#q-autor')?.focus();
  });

  // El conmutador Gráfico ⇄ Tabla se engancha al CONTENEDOR, no a cada corte:
  // los cortes se reemplazan enteros a cada recorte y los escuchas colgados de
  // ellos morirían con el marcado anterior.
  conmutadorVistas(zonas.cortes);
  anim.entradaAlVer(zonas.cortes);
  // El scroll-spy se re-engancha tras cada recorte: los cortes se reemplazan
  // y el observador anterior apuntaba a nodos que ya no están en el documento.
  if (claveSeccion) scrollSpy(document.getElementById('contenido'));

  // El recorte vive en la URL, así que el botón de volver del navegador tiene
  // que deshacer un filtro. Sin esto, volver saca al lector del sitio.
  addEventListener('popstate', () => { sel = X.leerURL(); pintar(); });

  /* Repintar también cuando hay SELECCIÓN de gráficos, aunque no haya recorte
     de datos. `hayRecorte` mira sólo los filtros —y hace bien: una selección no
     restringe el conjunto—, pero el HTML pre-renderizado trae los gráficos de
     la sección entera, así que sin este repintado la página enseñaría los
     dieciocho mientras la hoja declara que son dos. */
  /* La lectura de las dos figuras bento sale del MISMO registro que la de los
     dieciocho cortes, `docs/LECTURAS.md`. Antes no: el mapa de calor llevaba su
     explicación escrita a mano en el HTML y el treemap tenía un párrafo vacío
     que nadie rellenaba nunca —la figura más difícil de leer del sitio, sin una
     frase que dijera qué mide un rectángulo—. Dos mecanismos para lo mismo es
     como divergen: uno pasaba por la compuerta que exige explicación y el otro
     no existía para ella.

     Va FUERA de `pintar()`, y no por elegancia: el repintado se salta en una
     página pre-renderizada sin recorte, así que ahí dentro las dos lecturas no
     aparecían hasta que alguien tocaba un filtro. Medido, no leído. Y además el
     texto no depende del recorte: escribirlo en cada repintado sería reescribir
     lo mismo. */
  ponerLectura('treemap-lectura', textos, 'treemap');
  ponerLectura('heatmap-lectura', textos, 'heatmap');

  if (!yaPintado(zonas.cifras) || X.hayRecorte(sel) || X.graficosDe(sel)) pintar();
}

/* Conmutador Gráfico ⇄ Tabla. Un solo escucha delegado para toda la página:
   con veinte módulos, veinte escuchas serían veinte veces el mismo código. */
function conmutadorVistas(raiz) {
  raiz.addEventListener('click', e => {
    const btn = e.target.closest('.vistas button');
    if (!btn) return;
    // `.corte` es el módulo del explorador. Sin esto el conmutador no
    // encontraba su contenedor y las secciones perdían la vista de tabla, que
    // es la vía equivalente al gráfico y no un extra.
    const modulo = btn.closest('.modulo, .corte');
    modulo.querySelectorAll('.vistas button').forEach(b =>
      b.setAttribute('aria-pressed', String(b === btn)));
    modulo.querySelectorAll(':scope > .vista').forEach(p =>
      p.dataset.activa = String(p.dataset.vista === btn.dataset.vista));
  });
}

/* Scroll-spy del índice lateral: marca el indicador que se está mirando.

   Se toma el que esté más arriba entre los visibles, no el último que entró:
   al desplazarse hacia arriba, «el último que entró» es el de abajo y el
   índice señalaba el módulo equivocado. El margen superior descuenta la
   cabecera para que un módulo cuente como activo cuando su título es visible,
   no cuando su borde toca el borde de la ventana. */
function scrollSpy(raiz) {
  const enlaces = new Map();
  raiz.querySelectorAll('.rail a').forEach(a =>
    enlaces.set(a.getAttribute('href').slice(1), a));
  if (!enlaces.size || !('IntersectionObserver' in window)) return;

  const visibles = new Set();
  const marcar = () => {
    const orden = [...enlaces.keys()].filter(id => visibles.has(id));
    enlaces.forEach((a, id) => {
      const activo = id === orden[0];
      a.classList.toggle('activo', activo);
      if (activo) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  const obs = new IntersectionObserver(entradas => {
    entradas.forEach(en => en.isIntersecting
      ? visibles.add(en.target.id) : visibles.delete(en.target.id));
    marcar();
  }, { rootMargin: '-88px 0px -55% 0px' });
  enlaces.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });
}

/* ========================================================= publicaciones */
const POR_PAGINA = 50;

async function publicaciones() {
  const { publicaciones: pubs } = await c.cargar('publications.json');
  const zonas = {
    estado: document.getElementById('estado-recorte'),
    controles: document.getElementById('controles'),
  };
  let sel = X.leerURL();
  let pagina = 1;
  // Selección por casilla, independiente del recorte de filtros: sobrevive a
  // cambiar de página o de filtro, porque elegir publicaciones de a una para
  // exportarlas es justo el caso en que el lector NO quiere perder lo ya
  // marcado por tocar un chip sin querer. Sólo se limpia a mano.
  const seleccion = new Set();

  function pintar({ nuevaEntrada = false, soloTabla = false } = {}) {
    const res = X.recorte(pubs, sel);

    if (!soloTabla) {
      zonas.estado.innerHTML = VX.estado(res.length, pubs.length, sel);
      actualizarRecorteVivo(pubs, sel);
      // El buscador se repinta con el resto, así que hay que devolverle el
      // foco y el cursor: si no, escribir una letra lo expulsa del campo.
      const antes = document.getElementById('q');
      const tenia = document.activeElement === antes;
      const pos = antes ? antes.selectionStart : null;
      zonas.controles.innerHTML = VX.controles(pubs, sel, { buscador: true });
      if (tenia) {
        const ahora = document.getElementById('q');
        ahora.focus();
        if (pos !== null) ahora.setSelectionRange(pos, pos);
      }
    }
    X.escribirURL(sel, !nuevaEntrada);

    const totalPag = Math.max(1, Math.ceil(res.length / POR_PAGINA));
    pagina = Math.min(pagina, totalPag);
    const pag = res.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
    const cuerpo = document.getElementById('tabla-cuerpo');

    if (!res.length) {
      cuerpo.innerHTML = `<tr><td colspan="7"><div class="vacio">
        <p>Ningún resultado con este recorte.</p></div></td></tr>`;
      document.getElementById('paginacion').innerHTML = '';
      pintarSeleccion();
      return;
    }
    cuerpo.innerHTML = pag.map(p => `<tr>
      <td class="col-marca"><label class="solo-lectores" for="marca-${c.escapar(p.eid)}">Seleccionar «${c.escapar(p.titulo)}»</label>
        <input type="checkbox" class="chk-fila" id="marca-${c.escapar(p.eid)}" data-eid="${c.escapar(p.eid)}" ${seleccion.has(p.eid) ? 'checked' : ''}></td>
      <td>${c.anio(p.anio)}</td>
      <td>${p.doi ? `<a href="https://doi.org/${c.escapar(p.doi)}" target="_blank" rel="noopener">${c.escapar(p.titulo)}</a>`
        : c.escapar(p.titulo)}
        ${p.autores_uft.length
          ? `<br><span class="nota">${c.escapar(p.autores_uft.join(' · '))}</span>`
          // Una celda en blanco no distingue «no hay» de «no se muestra», y
          // aquí sí hay algo que decir: la publicación es institucional —la
          // afiliación la trajo— pero ninguna firma con nombre la sostiene.
          : '<br><span class="sin-dato-txt">Sin autoría UFT nombrada</span>'}</td>
      <td>${c.celda(p.fuente)}</td>
      <td>${c.celda(p.tipo)}</td>
      <td class="num">${p.tiene_metricas ? c.celda(p.citas) : '<span class="sin-dato-txt">Sin métricas</span>'}</td>
      <td class="num">${p.tiene_metricas ? c.celda(p.fwci, 2) : '<span class="sin-dato-txt">Sin métricas</span>'}</td>
    </tr>`).join('');

    document.getElementById('paginacion').innerHTML = totalPag > 1 ? `
      <button class="boton" id="ant" ${pagina === 1 ? 'disabled' : ''}>Anterior</button>
      <span>Página ${pagina} de ${totalPag}</span>
      <button class="boton" id="sig" ${pagina === totalPag ? 'disabled' : ''}>Siguiente</button>` : '';
    const ant = document.getElementById('ant'), sig = document.getElementById('sig');
    if (ant) ant.onclick = () => { pagina--; pintar({ soloTabla: true }); };
    if (sig) sig.onclick = () => { pagina++; pintar({ soloTabla: true }); };
    pintarSeleccion(pag);
  }

  /** Sincroniza la casilla «marcar todo» (indeterminada si sólo parte de la
      página está marcada) y el contador + estado del botón de exportar. */
  function pintarSeleccion(pag) {
    const todo = document.getElementById('marcar-todo');
    if (todo && pag) {
      const marcadas = pag.filter(p => seleccion.has(p.eid)).length;
      todo.checked = pag.length > 0 && marcadas === pag.length;
      todo.indeterminate = marcadas > 0 && marcadas < pag.length;
    }
    const n = seleccion.size;
    document.getElementById('estado-seleccion').textContent =
      n ? `${n} seleccionada${n === 1 ? '' : 's'}` : '';
    document.getElementById('exportar-seleccion').disabled = n === 0;
  }

  // Mismo escucha delegado que el explorador: los controles se repintan
  // enteros y los escuchas colgados de cada chip morirían con el marcado.
  document.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-dim]');
    if (chip) {
      const { dim, valor } = chip.dataset;
      const actual = sel[dim] || [];
      sel = { ...sel, [dim]: actual.includes(valor)
        ? actual.filter(x => x !== valor) : [...actual, valor] };
      pagina = 1; pintar({ nuevaEntrada: true });
      document.querySelector(
        `.chip[data-dim="${CSS.escape(dim)}"][data-valor="${CSS.escape(valor)}"]`)?.focus();
      return;
    }
    if (e.target.closest('#limpiar-recorte')) { sel = {}; pagina = 1; pintar({ nuevaEntrada: true }); }
    if (e.target.id === 'exportar') exportar(X.recorte(pubs, sel));
    if (e.target.id === 'exportar-seleccion') {
      exportar(pubs.filter(p => seleccion.has(p.eid)), { esSeleccion: true });
    }
  });

  document.addEventListener('input', c.debounce(e => {
    if (e.target.id !== 'q') return;
    sel = { ...sel, q: e.target.value || undefined };
    if (!sel.q) delete sel.q;
    pagina = 1; pintar();
  }, 250));

  // 'change', no 'click': una casilla también cambia con teclado (barra
  // espaciadora), y delegar en 'click' se la habría perdido.
  document.addEventListener('change', e => {
    if (e.target.id === 'marcar-todo') {
      const res = X.recorte(pubs, sel);
      const pag = res.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
      pag.forEach(p => e.target.checked ? seleccion.add(p.eid) : seleccion.delete(p.eid));
      pintar({ soloTabla: true });
      return;
    }
    const chk = e.target.closest('.chk-fila');
    if (chk) {
      chk.checked ? seleccion.add(chk.dataset.eid) : seleccion.delete(chk.dataset.eid);
      pintarSeleccion(X.recorte(pubs, sel).slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA));
    }
  });

  addEventListener('popstate', () => { sel = X.leerURL(); pagina = 1; pintar(); });
  pintar();
}

/** La exportación arrastra la procedencia: un CSV sin fecha de corte deja de
    ser interpretable en cuanto sale del sitio. `esSeleccion` distingue en la
    propia cabecera si son las publicaciones marcadas a mano o todo el
    recorte de filtros — quien reabra el CSV meses después necesita saber
    cuál de las dos cosas está mirando, no sólo cuántas filas tiene. */
async function exportar(filas, { esSeleccion = false } = {}) {
  const meta = await c.cargar('meta.json');
  const cab = [
    `# ${meta.institucion} — ${meta.titulo_plataforma}`,
    `# Fuentes: ${meta.fuentes.join(', ')} | Ventana: ${meta.ventana.inicio}-${meta.ventana.fin}`,
    `# Citas actualizadas al ${meta.fecha_corte_citas} | Exportado desde el build ${meta.fecha_build}`,
    `# ${meta.advertencia_global}`,
    esSeleccion
      ? `# Selección manual: ${filas.length} ${filas.length === 1 ? 'publicación marcada' : 'publicaciones marcadas'} una por una, de ${meta.denominadores.universo_total} en total.`
      : `# Subconjunto exportado: ${filas.length} de ${meta.denominadores.universo_total} publicaciones`,
  ].join('\n');
  const cols = ['eid', 'anio', 'titulo', 'fuente', 'tipo', 'doi', 'citas', 'fwci', 'percentil_citacion', 'n_paises'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cab, cols.join(','), ...filas.map(f => cols.map(k => esc(f[k])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `publicaciones${esSeleccion ? '-seleccion' : ''}-${meta.fecha_build}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================ autores */
async function autores() {
  const data = await c.cargar('authors.json');
  const { autores: lista, parametros } = data;
  // `q` puede venir en la URL: es el camino de vuelta desde un informe
  // recortado a una persona hacia su ficha, sin obligar a teclear el nombre
  // otra vez. El resto del estado de esta página no viaja en la dirección.
  let soloInterpretables = true, orden = 'n_publicaciones', asc = false;
  let q = new URLSearchParams(location.search).get('q') || '';

  // El enlace de corrección va AQUÍ y no sólo en metodología: ésta es la página
  // donde alguien se encuentra a sí mismo mal representado, y es el momento en
  // que necesita saber qué puede hacer. `DATA_LICENSE.md` §4 lo exige.
  document.getElementById('aviso-autores').innerHTML = `
    <div class="nota-destacada"><b>Sobre estas cifras</b>${c.escapar(data.advertencia_identidad)}
      <br><a href="metodologia.html#correcciones">¿Su ficha tiene un error? Cómo se corrige →</a></div>`;

  // El umbral estaba escrito en el HTML. Viene de config/publication.yml.
  document.getElementById('etiqueta-umbral').textContent =
    `Mostrar sólo firmas con ${parametros.n_minimo_interpretable} o más publicaciones`;

  function pintar() {
    let f = lista.filter(a => (!soloInterpretables || a.interpretable));
    if (q) {
      const sinTildes = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const n = sinTildes(q);
      // Se busca también entre las variantes fusionadas: quien llega con
      // «Giglio A.» desde Scopus no encontraría nada si sólo se mirara el
      // nombre canónico, y la ficha que busca existe con otro título.
      f = f.filter(a => [a.nombre, ...(a.variantes_consolidadas || [])]
        .some(x => sinTildes(x).includes(n)));
    }
    f.sort((x, y) => (asc ? 1 : -1) * ((x[orden] ?? 0) - (y[orden] ?? 0)) ||
      x.nombre.localeCompare(y.nombre));

    // La columna por la que se ordena se marca en todo su alto, no sólo en la
    // cabecera: con 51 filas en pantalla, una flecha arriba del todo se pierde.
    const ord = k => (k === orden ? ' ordenada' : '');

    const conOrcid = f.filter(a => a.orcid).length;
    // Por etiqueta, no por veredicto: las asignaciones que salieron del propio
    // registro también vienen «confirmada», pero por construcción, y sumarlas
    // aquí presentaría como verificación independiente lo que no lo es.
    const verificados = f.filter(a => a.orcid_veredicto_etiqueta === 'verificado').length;
    document.getElementById('resumen').innerHTML =
      `<strong>${c.nf.format(f.length)}</strong> de ${c.nf.format(parametros.total_firmas)} formas de firma` +
      (soloInterpretables ? ` · mostrando sólo n ≥ ${parametros.n_minimo_interpretable}` : '') +
      ` · <strong>${c.nf.format(conOrcid)}</strong> con ORCID recuperado` +
      // Sólo si la verificación se ha ejecutado: sin ella el recuento sería 0
      // y un 0 aquí se leería como «ninguno se verificó», que es falso.
      (verificados ? ` · <strong>${c.nf.format(verificados)}</strong> verificado${
        verificados === 1 ? '' : 's'} contra el registro de ORCID` : '');

    document.getElementById('tabla-cuerpo').innerHTML = f.length ? f.map(a => `<tr>
      <td><a href="autor.html?id=${encodeURIComponent(a.id)}">${c.escapar(a.nombre)}</a>
        ${a.identidad_no_consolidada
          ? ' <span class="etiqueta-en-linea">identidad no consolidada</span>' : ''}</td>
      <td>${a.orcid
        ? `<a class="etiqueta-en-linea etiqueta-orcid" href="https://orcid.org/${c.escapar(a.orcid)}"
             target="_blank" rel="noopener"
             title="ORCID: ${c.escapar(a.orcid_estado)} · confianza ${c.escapar(a.orcid_confianza || '')}"
             >${c.escapar(a.orcid)}</a>`
          // Se marca todo lo que NO sea una verificación independiente. Las
          // verificadas son la norma y etiquetarlas sería ruido; el resto dice
          // qué evidencia tiene, incluidas las que sólo declara el titular.
          // En texto, no en color: el color solo no comunica.
          + (a.orcid_veredicto_clase && a.orcid_veredicto_clase !== 'verificado'
            ? ` <span class="nota nota-orcid-${c.escapar(a.orcid_veredicto_clase)}"
                 >${c.escapar(a.orcid_veredicto_etiqueta)}</span>` : '')
        : '<span class="sin-dato-txt">No disponible</span>'}</td>
      <td>${c.escapar(a.unidades.join(' · '))}</td>
      <td class="num${ord('n_publicaciones')}">${c.celda(a.n_publicaciones)}</td>
      <td class="num${ord('citas')}">${c.celda(a.citas)}</td>
      <td class="num${ord('citas_por_publicacion')}">${c.celda(a.citas_por_publicacion, 2)}</td>
      <td class="num${ord('publicaciones_top10')}">${c.celda(a.publicaciones_top10)}</td></tr>`).join('')
      : `<tr><td colspan="7"><div class="vacio">Ningún autor coincide.</div></td></tr>`;
  }

  const casilla = document.getElementById('solo-interpretables');
  const campo = document.getElementById('buscar-autor');
  /* Llegar buscando a alguien y no encontrarlo sería peor que no ofrecer la
     búsqueda: la vista por defecto oculta las firmas por debajo del umbral, y
     761 de las 829 lo están. Si la búsqueda viene en la URL se abre la lista
     entera y los dos controles enseñan el estado real, en vez de filtrar por
     detrás. */
  if (q) {
    soloInterpretables = false;
    casilla.checked = false;
    campo.value = q;
  }
  casilla.addEventListener('change', e => {
    soloInterpretables = e.target.checked; pintar();
  });
  campo.addEventListener('input',
    c.debounce(e => { q = e.target.value; pintar(); }, 250));
  document.querySelectorAll('th[data-orden]').forEach(th => {
    // Enter y Espacio, además del clic: sin esto la tabla no se podía ordenar
    // sin ratón, porque un <th> no es un control activable por defecto.
    th.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); th.click(); }
    });
    th.addEventListener('click', () => {
      const k = th.dataset.orden;
      asc = (orden === k) ? !asc : false;
      orden = k;
      document.querySelectorAll('th[data-orden]').forEach(o =>
        o.setAttribute('aria-sort', o === th ? (asc ? 'ascending' : 'descending') : 'none'));
      pintar();
    });
  });
  pintar();
}

/* ============================================================ ficha autor */
async function fichaAutor() {
  const idCrudo = new URLSearchParams(location.search).get('id');
  // Los identificadores que emite el propio build son slugs (letras, dígitos,
  // guion): `orellana-donoso-m`. Cualquier otra cosa en `?id=` no es un
  // identificador válido y se trata como ausente, no como ruta de `fetch`.
  const id = idCrudo && /^[a-z0-9-]{1,80}$/.test(idCrudo) ? idCrudo : null;
  const cont = document.getElementById('ficha');
  // Sin identificador la página quedaba en blanco: ni encabezado —la ficha es
  // la única del sitio sin h1 propio en el archivo, porque lo pone el JS— ni
  // salida hacia ningún lado. Un callejón sin salida se corrige con una puerta.
  if (!id) {
    cont.innerHTML = `<h1>Ficha de autor</h1>
      <div class="vacio">La dirección no trae identificador de autor, así que no
      hay ficha que mostrar.<br><a href="autores.html">Ir al directorio de autores →</a></div>`;
    return;
  }

  let a;
  try { a = await c.cargar(`author/${id}.json`); }
  catch (e) { c.mostrarError(cont, e); return; }

  // Coautoría interna de ESTA persona (C-05): quién más firma sus mismas
  // publicaciones. No hace falta el grafo entero para una ficha individual,
  // sólo cruzar sus propios EID contra `autores_uft` de cada publicación.
  const { publicaciones: todasPubs } = await c.cargar('publications.json');
  const idPorNombre = new Map((await c.cargar('authors.json')).autores.map(x => [x.nombre, x.id]));
  const misEid = new Set(a.publicaciones.map(p => p.eid));
  const pesoCoautor = new Map();
  for (const p of todasPubs) {
    if (!misEid.has(p.eid)) continue;
    for (const persona of (p.autores_uft || [])) {
      if (persona === a.nombre_en_fuente) continue;
      pesoCoautor.set(persona, (pesoCoautor.get(persona) || 0) + 1);
    }
  }
  const coautores = [...pesoCoautor.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));

  const i = a.indicadores;
  document.title = `${a.nombre_en_fuente} — Ficha de autor`;

  /* Qué declara esta hoja si alguien la imprime desde aquí.

     Sin esto decía «Sin filtros: el informe completo, 823 publicaciones», que
     es lo que el cromo deja escrito por defecto y aquí es falso: la hoja
     enseña a UNA persona. Un PDF nominal que se presenta como el informe
     institucional completo es exactamente la lectura que este proyecto
     persigue impedir.

     Se declara con la misma redacción que el resto —`fraseRecorte()`— y con
     las cifras que la ficha ya tiene: sus publicaciones y el universo que
     viaja en su propio `meta`. Cuando la ficha llega dentro de un informe
     recortado, el despachador ya escribió la línea con el recorte de la URL y
     ésta la confirma con las mismas palabras. */
  const papelFicha = document.getElementById('recorte-impreso');
  if (papelFicha) {
    papelFicha.textContent = c.fraseRecorte(
      i.n_publicaciones, a.meta.denominadores.universo_total,
      [`Autor: ${a.nombre_en_fuente}`]);
  }

  const idents = `
    <div><span>Nombre en fuente</span>${c.escapar(a.nombre_en_fuente)}</div>
    <div><span>Unidad académica</span>${c.escapar(a.unidades_academicas.join(' · '))}</div>
    <div><span>Scopus Author ID</span>${a.scopus_author_ids.length
      ? a.scopus_author_ids.map(s => `<a class="enlace-dato" href="https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(s)}"
          target="_blank" rel="noopener">${c.escapar(s)}</a>`).join(' · ')
      : '<span class="sin-dato-txt">No resuelto</span>'}</div>
    <div><span>ORCID</span>${a.orcid
      ? `<a class="enlace-dato" href="https://orcid.org/${c.escapar(a.orcid)}" target="_blank" rel="noopener">${c.escapar(a.orcid)}</a>`
        // Qué evidencia respalda este ORCID, en orden de fuerza. El veredicto
        // sale de contrastar la asignación contra el registro del propio
        // titular, así que cuando existe desplaza a la confianza, que sólo
        // dice lo que opina nuestra heurística de emparejamiento.
        + (a.orcid_veredicto_etiqueta
          ? ` <span class="nota nota-orcid-${c.escapar(a.orcid_veredicto_clase)}"
                 title="${c.escapar(a.orcid_veredicto_detalle || '')}"
               >${c.escapar(a.orcid_veredicto_etiqueta)}</span>`
          : a.orcid_confianza === 'media'
            ? ` <span class="nota">correspondencia probable</span>` : '')
      : `<span class="sin-dato-txt">${c.escapar(a.orcid_estado)}</span>`}</div>`
    // Sin esto, una ficha con 24 publicaciones repartidas entre tres formas de
    // firma no se puede rastrear hasta Scopus: quien busque «Giglio A.» no
    // sabría que sus publicaciones están aquí.
    + (a.variantes_consolidadas && a.variantes_consolidadas.length > 1
      ? `<div><span>Formas de firma fusionadas</span>${
          a.variantes_consolidadas.map(v => c.escapar(v)).join(' · ')}</div>`
      : '');

  const kpi = (v, etq, dec = 0, ayuda = null) => `<article class="kpi">
    <div class="valor">${v === null ? '<span class="sin-dato-txt" style="font-size:1rem">No disponible</span>' : c.num(v, dec)}</div>
    <div class="etiqueta">${etq}${ayuda ? c.botonAyuda(ayuda) : ''}</div></article>`;

  cont.innerHTML = `
    <p class="migas"><a href="autores.html">Autores</a> › ${c.escapar(a.nombre_en_fuente)}</p>
    <div class="ficha-cabecera">
      <h1>${c.escapar(a.nombre_en_fuente)}</h1>
      <div class="identificadores">${idents}</div>
    </div>

    ${VX.advertenciaLectura(a.meta, 'Cómo leer esta ficha')}

    ${a.advertencia_muestra_reducida ? VX.advertenciaMuestraReducida(a.umbral_interpretable) : ''}

    ${a.identidad_no_consolidada ? `<div class="nota-destacada"><b>Identidad no consolidada</b>
      Esta firma está asociada a más de un identificador de autor en la fuente. La
      consolidación de identidades requiere validación institucional u ORCID, pendientes.</div>` : ''}

    <!-- La entrada al informe recortado a esta persona. Va aquí y no en un panel
         de filtros: una lista de 829 firmas no es un filtro, y quien quiere el
         informe de alguien suele estar mirando a ese alguien. -->
    <p class="ficha-acciones"><a class="enlace-lista"
      href="index.html?autor=${encodeURIComponent(a.nombre_en_fuente)}"
      >Ver el informe recortado a esta firma →</a></p>

    <div class="kpis">
      ${kpi(i.n_publicaciones, 'Publicaciones')}
      ${kpi(i.citas_totales, 'Citas', 0, 'Fecha de corte')}
      ${kpi(i.citas_por_publicacion, 'Citas por publicación', 2)}
      ${kpi(i.h_index_ventana, 'h-index en ventana', 0, 'h-index en ventana')}
      ${kpi(i.publicaciones_top10, 'En el top 10 % de citación', 0, 'Percentil de citación')}
    </div>

    <p class="nota">El FWCI no se muestra a nivel de autor: no es el promedio de los
    FWCI de sus publicaciones y la fuente no lo entrega a nivel de persona.
    En su lugar se reporta la presencia en el top 10 % de citación, que sí está
    normalizado por campo. Ver <a href="metodologia.html">metodología</a>.</p>

    <section class="modulo">
      <header><h2>Evolución temporal</h2><span class="codigo">AU-06</span></header>
      ${c.barrasV(a.evolucion, { titulo: 'Publicaciones por año', etiquetaX: 'anio', etiquetaY: 'n' })}
      <p class="nota">Tres años de ventana: se presenta como barras, no como línea de tendencia.</p>
    </section>

    <section class="modulo">
      <header><h2>Publicaciones (${a.publicaciones.length})</h2></header>
      <div class="tabla-envoltura"><table>
        <thead><tr><th scope="col">Año</th><th scope="col">Título</th><th scope="col">Fuente</th><th scope="col">Tipo</th><th scope="col" class="num">Citas</th></tr></thead>
        <tbody>${a.publicaciones.map(p => `<tr>
          <td>${c.anio(p.anio)}</td>
          <td>${p.doi ? `<a href="https://doi.org/${c.escapar(p.doi)}" target="_blank" rel="noopener">${c.escapar(p.titulo)}</a>` : c.escapar(p.titulo)}</td>
          <td>${c.celda((p.fuentes || []).join(' · '))}</td>
          <td>${c.celda(p.tipo)}</td>
          <td class="num">${p.tiene_metricas ? c.celda(p.citas) : '<span class="sin-dato-txt">Sin métricas</span>'}</td>
        </tr>`).join('')}</tbody></table></div>
    </section>

    <section class="modulo">
      <header><h2>Coautoría interna (${coautores.length})</h2><span class="codigo">C-05</span></header>
      ${coautores.length ? `<div class="tabla-envoltura"><table>
        <thead><tr><th scope="col">Persona</th><th scope="col" class="num">Publicaciones compartidas</th></tr></thead>
        <tbody>${coautores.map(([nombre, n]) => {
          const otroId = idPorNombre.get(nombre);
          return `<tr><td>${otroId
            ? `<a href="autor.html?id=${encodeURIComponent(otroId)}">${c.escapar(nombre)}</a>`
            : c.escapar(nombre)}</td><td class="num">${n}</td></tr>`;
        }).join('')}</tbody></table></div>`
        : `<p class="vacio">Ninguna coautoría con otro autor UFT en esta ventana: sus
           publicaciones no comparten firma con otra persona detectada como afiliada a
           la institución. No significa que trabaje en solitario — puede coautorar con
           gente fuera de la UFT, que este corte no ve.</p>`}
      <p class="nota">Sólo cuenta coautoría <strong>interna</strong>: otra firma UFT en la
        misma publicación, dentro de esta ventana. <a href="colaboracion.html#C-05">Ver la
        red completa →</a></p>
    </section>`;
}

/* =========================================================== metodología */
async function metodologia() {
  const glosarioEl = document.getElementById('glosario');
  const procedenciaEl = document.getElementById('procedencia');
  const validacionEl = document.getElementById('validacion');
  if (yaPintado(glosarioEl) && yaPintado(procedenciaEl) && yaPintado(validacionEl)) return;
  const { entradas } = await c.cargar('glossary.json');
  const meta = await c.cargar('meta.json');
  glosarioEl.innerHTML = v.glosario(entradas);
  procedenciaEl.innerHTML = v.procedencia(meta);
  if (validacionEl) validacionEl.innerHTML = v.validacion(await c.cargar('validacion.json'));

  // La cifra de cobertura de ORCID crece sola (T-19 corre por cron mensual):
  // escribirla a mano en el HTML es exactamente cómo terminó diciendo
  // "216 de 556" cuando ya eran 280 de 538. Se calcula aquí, sobre el mismo
  // authors.json que sirve autores.html, para que nunca vuelva a desactualizarse.
  const orcidEl = document.getElementById('orcid-cobertura');
  if (orcidEl) {
    const { autores } = await c.cargar('authors.json');
    const total = autores.length;
    const conOrcid = autores.filter(a => a.orcid).length;
    orcidEl.textContent = `${c.nf.format(conOrcid)} de ${c.nf.format(total)} formas de firma con ORCID`;
  }
}

async function catalogo() {
  const cont = document.getElementById('catalogo');
  const graficos = VX.seccionDeGrafico();
  // Pre-renderizado: repintar destruiría un LCP que ya ocurrió, y el marcado
  // sería idéntico porque lo produce esta misma función.
  if (!yaPintado(cont)) cont.innerHTML = v.catalogo(await c.cargar('catalogo.json'), graficos);

  /* El selector de gráficos. El catálogo es la única página donde los dieciocho
     se ven juntos —en una sección sólo están los suyos—, así que es donde se
     eligen sin depender de en cuál viven.

     La selección viaja como `grafico=` en la URL, junto al recorte y con la
     misma gramática: quien la comparta o la descargue obtiene el mismo informe.
     El orden lo fija el informe, no el orden en que se marcaron: un informe con
     impacto antes que producción sería otro documento. */
  const orden = Object.keys(graficos);
  const elegidos = new Set();
  const estado = document.getElementById('estado-graficos');
  const enlace = document.getElementById('ver-seleccion');
  const limpiar = document.getElementById('limpiar-graficos');
  const cmd = document.getElementById('orden-graficos');
  if (!estado || !enlace) return;

  const pintarSeleccion = () => {
    const cods = orden.filter(k => elegidos.has(k));
    const n = cods.length;
    estado.textContent = n
      ? `${n} de ${orden.length} gráficos seleccionados`
      : 'Ningún gráfico seleccionado';
    enlace.hidden = !n;
    limpiar.hidden = !n;
    cmd.hidden = !n;
    if (n) {
      enlace.href = `index.html?grafico=${encodeURIComponent(cods.join('|'))}`;
      // La misma selección, para quien genere el PDF de varias secciones.
      cmd.textContent = `Para el PDF: make informe RECORTE="grafico=${cods.join('|')}"`;
    }
  };

  document.addEventListener('change', e => {
    const chk = e.target.closest('.chk-grafico');
    if (!chk) return;
    chk.checked ? elegidos.add(chk.dataset.cod) : elegidos.delete(chk.dataset.cod);
    pintarSeleccion();
  });
  limpiar.addEventListener('click', () => {
    elegidos.clear();
    document.querySelectorAll('.chk-grafico').forEach(x => { x.checked = false; });
    pintarSeleccion();
  });

  // Una selección que llega en la URL se refleja en las casillas: volver atrás
  // desde el informe tiene que enseñar lo que se eligió, no un formulario en
  // blanco.
  (X.graficosDe(X.leerURL()) || []).forEach(cod => {
    const chk = document.getElementById(`g-${cod}`);
    if (chk) { chk.checked = true; elegidos.add(cod); }
  });
  pintarSeleccion();
}

async function produccionAmpliada() {
  const cont = document.getElementById('produccion-declarada');
  if (!yaPintado(cont)) cont.innerHTML = v.produccionDeclarada(await c.cargar('produccion_declarada.json'));
}

/* ══════════════════════════════════════════ teclado dentro de un gráfico */

/* Cada barra era un punto de tabulación. Medido en Áreas temáticas: 41 de los
   70 puntos de la página eran barras, así que pasar del primer gráfico al
   enlace siguiente costaba veinte pulsaciones de Tab. Un gráfico no es una
   lista de veinte controles: es UN control con veinte posiciones.

   Patrón de composición de las prácticas ARIA: el gráfico es un solo punto de
   tabulación y por dentro se recorre con las flechas. El tabindex «rueda» —la
   marca enfocada vale 0 y las demás −1—, así que al volver con Tab se entra
   por donde se salió y no por el principio.

   Con esto el recorrido de la página baja de 70 puntos a 32, y explorar el
   gráfico se vuelve más rápido en vez de más lento. */
function tecladoGraficos() {
  document.addEventListener('keydown', e => {
    // `g.nodo-red[tabindex]` generaliza la misma rotación a la red de
    // coautoría (C-05): sólo los nodos con `tabindex` ya puesto entran a la
    // tabulación (el tope de 90 por grado que fija `disponerRed()` en
    // core.js) — el resto del selector, y este bucle, no cambian.
    // `g.heatmap-celda`/`g.treemap-nodo` con `tabindex` reproducen el mismo
    // punto único de tabulación que ya tenían las barras: antes cada celda
    // llevaba `tabindex="0"` a mano (hasta 24 paradas en el mapa de calor de
    // producción.html), justo lo que este mecanismo existe para evitar.
    const marca = e.target.closest?.(
      'svg.chart g.marca, svg.chart g.nodo-red[tabindex], ' +
      'svg.chart g.heatmap-celda[tabindex], svg.chart g.treemap-nodo[tabindex]');
    if (marca) {
      const esRed = marca.classList.contains('nodo-red');
      const sel = esRed ? 'g.nodo-red[tabindex]'
        : marca.classList.contains('heatmap-celda') ? 'g.heatmap-celda[tabindex]'
        : marca.classList.contains('treemap-nodo') ? 'g.treemap-nodo[tabindex]'
        : 'g.marca';
      const marcas = [...marca.closest('svg.chart').querySelectorAll(sel)];
      const i = marcas.indexOf(marca);
      let j = null;
      // Las dos orientaciones responden a los cuatro cursores a propósito: el
      // lector no tiene por qué saber si la serie se dibujó en horizontal o en
      // vertical para poder recorrerla. La red da la vuelta al llegar a una
      // punta (mismo criterio que ya tenía `pasoTecladoRed`, ahora inline);
      // las barras se quedan en el extremo, comportamiento sin cambios.
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        j = esRed ? (i + 1) % marcas.length : Math.min(i + 1, marcas.length - 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        j = esRed ? (i - 1 + marcas.length) % marcas.length : Math.max(i - 1, 0);
      }
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = marcas.length - 1;
      else if (esRed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); alternarFocoRed(marca); return; }
      else if (esRed && e.key === 'Escape') { e.preventDefault(); soltarFocoRed(marca.closest('svg.red-svg')); return; }
      else return;

      e.preventDefault();
      if (j === i) return;
      marca.setAttribute('tabindex', '-1');
      marcas[j].setAttribute('tabindex', '0');
      marcas[j].focus();
      return;
    }
  });
}

/* =================================================== fuentes externas */

const POR_PAGINA_FUENTES = 50;

async function fuentesexternas() {
  let datos;
  try { datos = await c.cargar('fuentes_externas.json'); }
  catch (e) {
    const cont = document.getElementById('contenido');
    c.mostrarError(cont, e);
    return;
  }

  // Sin `autores`: la capa pública ya no trae la atribución obra-persona.
  // La frontera la aplica src/build/10_fuentes_externas.py; aquí sólo se
  // consume lo que llega, y se declara lo que no llega.
  const { meta, publicaciones: pubs, resumen } = datos;
  const zonas = {
    estado: document.getElementById('estado-recorte'),
    controles: document.getElementById('controles'),
  };

  document.getElementById('aviso-fuentes').innerHTML =
    `<b>Sobre este listado</b> ${c.escapar(meta.advertencia)}`;

  document.getElementById('kpis-fuentes').innerHTML =
    `<article class="kpi"><div class="valor">${c.nf.format(resumen.total_publicaciones)}</div>
      <div class="etiqueta">Publicaciones fuera de Scopus</div></article>
    <article class="kpi"><div class="valor">${c.nf.format(resumen.atribuciones_retenidas)}</div>
      <div class="etiqueta">Atribuciones obra-persona en revisión</div>
      <div class="secundario">no se publican hasta confirmarse</div></article>
    <article class="kpi"><div class="valor">${c.nf.format(meta.universo_scopus_dois)}</div>
      <div class="etiqueta">DOIs en universo Scopus</div></article>`;

  const fuentesCortas = { facmed: 'Fac. Medicina', dspace: 'DSpace', autoarchivo: 'Autoarchivo' };
  let sel = { fuente: [], anio: [], q: undefined };
  let pagina = 1;

  function pintar({ nuevaEntrada = false } = {}) {
    let f = pubs;
    if (sel.fuente && sel.fuente.length)
      f = f.filter(p => (p.fuentes_id || []).some(x => sel.fuente.includes(x)));
    if (sel.anio && sel.anio.length)
      f = f.filter(p => sel.anio.includes(String(p.anio)));
    if (sel.q) {
      const nq = sel.q.toLowerCase();
      f = f.filter(p => (p.titulo || '').toLowerCase().includes(nq));
    }

    if (zonas.estado)
      zonas.estado.innerHTML = VX.estado(f.length, pubs.length, sel);

    const anios = [...new Set(pubs.map(p => String(p.anio)).filter(a => a))]
      .sort((a, b) => Number(b) - Number(a));
    const fuentesIds = ['facmed', 'dspace', 'autoarchivo'];
    if (zonas.controles) {
      zonas.controles.innerHTML =
        `<h3>Fuente</h3>
         <div class="chips">${fuentesIds.map(fid =>
           `<button type="button" class="chip${(sel.fuente || []).includes(fid) ? ' chip-activo' : ''}"
             data-dim="fuente" data-valor="${fid}">${fuentesCortas[fid]}<span class="chip-conteo">${resumen.por_fuente[fid] || 0}</span></button>`
         ).join('')}</div>
         <h3>Año</h3>
         <div class="chips">${anios.map(a =>
           `<button type="button" class="chip${(sel.anio || []).includes(a) ? ' chip-activo' : ''}"
             data-dim="anio" data-valor="${a}">${a}</button>`
         ).join('')}</div>
         <h3>Buscar</h3>
         <input type="search" id="q-fuentes" class="buscador" placeholder="Título…" value="${c.escapar(sel.q || '')}">`;
    }

    const totalPag = Math.max(1, Math.ceil(f.length / POR_PAGINA_FUENTES));
    pagina = Math.min(pagina, totalPag);
    const pag = f.slice((pagina - 1) * POR_PAGINA_FUENTES, pagina * POR_PAGINA_FUENTES);

    const cuerpo = document.getElementById('tabla-cuerpo');
    if (!f.length) {
      cuerpo.innerHTML = `<tr><td colspan="4"><div class="vacio">
        <p>Ningún resultado con este recorte.</p></div></td></tr>`;
    } else {
      cuerpo.innerHTML = pag.map(p => `<tr>
        <td>${c.anio(p.anio)}</td>
        <td>${p.doi ? `<a href="https://doi.org/${c.escapar(p.doi)}" target="_blank" rel="noopener">${c.escapar(p.titulo)}</a>`
          : c.escapar(p.titulo)}</td>
        <td>${c.celda((p.fuentes || []).join(' · '))}</td>
        <td>${c.celda(p.tipo)}</td>
      </tr>`).join('');
    }

    document.getElementById('paginacion').innerHTML = totalPag > 1 ? `
      <button class="boton" id="ant-f" ${pagina === 1 ? 'disabled' : ''}>Anterior</button>
      <span>Página ${pagina} de ${totalPag}</span>
      <button class="boton" id="sig-f" ${pagina === totalPag ? 'disabled' : ''}>Siguiente</button>` : '';
    const ant = document.getElementById('ant-f'), sig = document.getElementById('sig-f');
    if (ant) ant.onclick = () => { pagina--; pintar(); };
    if (sig) sig.onclick = () => { pagina++; pintar(); };
  }

  document.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-dim]');
    if (chip) {
      const { dim, valor } = chip.dataset;
      const actual = sel[dim] || [];
      sel = { ...sel, [dim]: actual.includes(valor)
        ? actual.filter(x => x !== valor) : [...actual, valor] };
      pagina = 1; pintar({ nuevaEntrada: true });
      return;
    }
    if (e.target.closest('#limpiar-recorte')) {
      sel = { fuente: [], anio: [], q: undefined };
      pagina = 1; pintar({ nuevaEntrada: true });
    }
    if (e.target.id === 'exportar') {
      let f = pubs;
      if (sel.fuente && sel.fuente.length) f = f.filter(p => (p.fuentes_id || []).some(x => sel.fuente.includes(x)));
      if (sel.anio && sel.anio.length) f = f.filter(p => sel.anio.includes(String(p.anio)));
      if (sel.q) { const nq = sel.q.toLowerCase(); f = f.filter(p => (p.titulo||'').toLowerCase().includes(nq)); }
      const cab = [`# Producción fuera del corpus Scopus — UFT`, `# ${f.length} de ${pubs.length} publicaciones`, `# Generado el ${meta.fecha_generacion}`].join('\n');
      const cols = ['titulo', 'doi', 'anio', 'tipo', 'fuentes', 'escuela'];
      const esc = v => `"${String(Array.isArray(v) ? v.join(' · ') : (v ?? '')).replace(/"/g, '""')}"`;
      const csv = [cab, cols.join(','), ...f.map(r => cols.map(k => esc(r[k])).join(','))].join('\n');
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `fuentes-externas-${meta.fecha_generacion}.csv`; a.click(); URL.revokeObjectURL(url);
    }
  });

  document.addEventListener('input', c.debounce(e => {
    if (e.target.id !== 'q-fuentes') return;
    sel = { ...sel, q: e.target.value || undefined };
    if (!sel.q) delete sel.q;
    pagina = 1; pintar();
  }, 250));

  pintar();
}

/* ============================================================== arranque */
const PAGINAS = { portada, seccion, publicaciones, autores, fichaAutor, metodologia, catalogo, fuentesexternas, produccionAmpliada };

/** C-05: fija (o suelta, si ya estaba fijado) el nodo `g` y resalta sus
    coautores directos — mismo patrón visual que el filtro atenúa las barras
    inactivas (`svg.chart.hay-foco .marca`), aplicado al nodo y sus vecinos
    en vez de a una serie. Puramente de marcado: no vuelve a pedir datos ni
    repinta el SVG, sólo alterna clases ya previstas en `app.css`. */
function alternarFocoRed(g) {
  const svg = g.closest('svg.red-svg');
  if (!svg) return;
  if (g.classList.contains('en-foco')) { soltarFocoRed(svg); return; }
  soltarFocoRed(svg, { mantenerHayFoco: true });
  svg.classList.add('hay-foco');
  g.classList.add('en-foco');
  const vecinos = new Set((g.dataset.vecinos || '').split(',').filter(Boolean));
  const i = g.dataset.redNodo;
  svg.querySelectorAll('.nodo-red[data-red-nodo]').forEach(n => {
    if (vecinos.has(n.dataset.redNodo)) n.classList.add('en-foco');
  });
  svg.querySelectorAll('.vinculo').forEach(l => {
    if (l.dataset.a === i || l.dataset.b === i) l.classList.add('en-foco');
  });
}

function soltarFocoRed(svg, { mantenerHayFoco = false } = {}) {
  if (!svg) return;
  svg.querySelectorAll('.en-foco').forEach(el => el.classList.remove('en-foco'));
  if (!mantenerHayFoco) svg.classList.remove('hay-foco');
}

document.addEventListener('DOMContentLoaded', async () => {
  const pagina = document.body.dataset.pagina;
  const archivo = location.pathname.split('/').pop() || 'index.html';
  try {
    await c.montarCabecera(archivo);
    /* Una página sin explorador dentro de un informe filtrado no puede afirmar
       que es el informe completo, que es lo que el cromo deja escrito por
       defecto. El anexo metodológico no cuenta publicaciones ni las filtra,
       pero SÍ forma parte del recorte que alguien pidió, y una hoja suelta que
       lo niegue contradice a las demás del mismo PDF.

       Sin cifras a propósito: esta página no tiene el corpus cargado y
       declarar «N de M» exigiría pedirlo sólo para eso. Donde sí hay
       explorador, `actualizarRecorteVivo()` reescribe la línea con las cifras
       en el primer repintado. */
    const selURL = X.leerURL();
    const partesURL = X.describir(selURL);
    const papel = document.getElementById('recorte-impreso');
    if (papel && partesURL.length) {
      papel.textContent = c.fraseRecorte(null, null, partesURL);
    }

    /* La selección de gráficos se declara APARTE del recorte, y en todas las
       páginas. No es un filtro de datos —las cifras siguen siendo las del
       recorte entero— sino una elección de qué figuras se muestran, y una hoja
       parcial tiene que decir que es parcial: sin esto, un informe de tres
       gráficos se lee como el informe entero. */
    const elegidos = X.graficosDe(selURL);
    const linea = document.getElementById('seleccion-impresa');
    if (linea && elegidos) {
      const total = Object.keys(VX.seccionDeGrafico()).length;
      linea.textContent = `Selección: ${elegidos.length} de los ${total} `
        + 'gráficos del informe. '
        + 'Las cifras no cambian: lo que se acota es qué figuras se muestran.';
    }
    await c.montarAyuda();
    c.montarTooltip();
    if (PAGINAS[pagina]) await PAGINAS[pagina]();
    // Delegado en document: vale para los gráficos pre-renderizados y para los
    // que se repintan después de un filtro, sin volver a enganchar nada.
    tecladoGraficos();
  } catch (e) {
    c.mostrarError(document.getElementById('contenido') || document.body, e);
  }
});
