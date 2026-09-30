/* Análisis de cada figura y cuadro del informe (D-760, D-761).

   POR QUÉ EXISTE
   «Qué muestra» explica cómo leer la figura; no dice qué se ve en ella. Este
   módulo escribe, debajo, un párrafo de ANÁLISIS OBJETIVO: magnitudes,
   distribución, evolución y comparación con una referencia explícita (el
   conjunto mundial que traen las métricas normalizadas, el reparto uniforme,
   la propia serie). Enuncia lo que los datos muestran y nada más.

   El piloto (2026-09-29) tenía tres bloques —qué se observa, precauciones, qué
   no permite concluir—. El usuario pidió un análisis más objetivo, sin los dos
   últimos: las advertencias metodológicas siguen en el anexo y en la nota de
   cada indicador, y aquí solo quedan hechos con su cifra y su base.

   REGLAS
   - Todo sale del recorte, con las mismas funciones que dibujan la figura:
     cambia con los filtros y el sitio y el PDF dicen lo mismo.
   - Cada porcentaje declara su base cuando no es el recorte completo.
   - Verbos descriptivos (pasa de, reúne, aparece en). Ni adjetivos de valor ni
     causas: `src/verify/comentarios.mjs` lo comprueba en CI.
   - Bajo `REGLAS.minimo` publicaciones no se analiza: se dice que la muestra
     no alcanza.
   - Los umbrales son parámetros (`REGLAS`), no cifras escritas en el texto. */

import * as c from './core.js';
import * as X from './explorador.js';

export const REGLAS = {
  // Por debajo de esto una sola publicación mueve visiblemente cada porcentaje.
  // Es el umbral con que la portada advierte un recorte pequeño.
  minimo: 20,
  // Diferencia relativa con la referencia bajo la cual se dice «en torno a».
  tolerancia: 0.05,
  // Años necesarios para describir una evolución.
  aniosEvolucion: 3,
  // Cuántos elementos se nombran en una enumeración («los más frecuentes»).
  nombrados: 3,
};

const nf = (x) => c.nf.format(x);
const pct = (a, b) => (b ? (100 * a) / b : 0);
const pc = (x) => `${c.num(x, 1)} %`;
const dec = (x) => c.num(x, 2);
// Una mediana entera se escribe sin decimales («3 citas», no «3,0»).
const med = (x) => (Number.isInteger(x) ? nf(x) : c.num(x, 1));
const unirY = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const desc = (xs) => [...xs].sort((a, b) => b.n - a.n || String(a.valor).localeCompare(String(b.valor)));
// Las categorías (tipo, vía, área, ODS) van entre comillas para leerse dentro de
// la frase —«Medicina (general)» (124)—; los nombres propios, sin ellas.
const q = (v) => `«${v}»`;
const lista = (xs, k = REGLAS.nombrados, cat = false) =>
  unirY(xs.slice(0, k).map(d => `${cat ? q(d.valor) : d.valor} (${nf(d.n)})`));
const SIN_UNIDAD = new Set(['No determinada', 'Sin dato declarado', X.SIN_FACULTAD]);

/** «por encima de», «por debajo de» o «en torno a» una referencia. */
export function frente(obs, ref, tol = REGLAS.tolerancia) {
  if (!ref) return 'sin referencia';
  const d = obs / ref - 1;
  return Math.abs(d) <= tol ? 'en torno a' : d > 0 ? 'por encima de' : 'por debajo de';
}
// «por encima del 25 %», «en torno al 25 %».
const frenteAl = (obs, ref) => frente(obs, ref).replace(/ a$/, ' al').replace(/ de$/, ' del');

/** Extremos de una serie por año: [{anio, valor}] -> {max, min, primero, ultimo}. */
function extremos(serie) {
  const max = serie.reduce((m, d) => (d.valor > m.valor ? d : m));
  const min = serie.reduce((m, d) => (d.valor < m.valor ? d : m));
  const anios = (v) => serie.filter(d => d.valor === v).map(d => d.anio);
  return { max, min, aniosMax: anios(max.valor), aniosMin: anios(min.valor),
    primero: serie[0], ultimo: serie[serie.length - 1] };
}

/* Cada analista recibe el recorte y el contexto y devuelve una lista de
   oraciones en texto plano, o null si no hay dato que analizar. */
const ANALISTAS = {
  'P-02': (sub) => {
    const serie = X.porCampo(sub, 'anio')
      .map(d => ({ anio: Number(d.valor), n: d.n })).sort((a, b) => a.anio - b.anio);
    if (serie.length < REGLAS.aniosEvolucion) {
      return [`El recorte abarca ${nf(serie.length)} ${serie.length === 1 ? 'año' : 'años'}`
        + ` y reúne ${nf(sub.length)} publicaciones.`];
    }
    const [a, b] = [serie[0], serie[serie.length - 1]];
    const cambio = pct(b.n - a.n, a.n);
    const bajas = serie.slice(1).map((d, i) => [serie[i], d]).filter(([x, y]) => y.n < x.n);
    const max = serie.reduce((m, d) => (d.n > m.n ? d : m));
    return [
      `Entre ${a.anio} y ${b.anio} la producción pasa de ${nf(a.n)} a ${nf(b.n)} publicaciones`
        + ` (${cambio >= 0 ? '+' : '−'}${c.num(Math.abs(cambio), 1)} %).`,
      `Aumenta en ${nf(serie.length - 1 - bajas.length)} de los ${nf(serie.length - 1)} intervalos anuales`
        + (bajas.length ? `; disminuye ${unirY(bajas.slice(0, 2).map(([x, y]) =>
          `entre ${x.anio} y ${y.anio} (de ${nf(x.n)} a ${nf(y.n)})`))}` : '') + '.',
      `El año con más publicaciones es ${max.anio}, con ${nf(max.n)} (${pc(pct(max.n, sub.length))} del recorte).`,
    ];
  },

  'P-03': (sub) => {
    const t = desc(X.porCampo(sub, 'tipo'));
    if (!t.length) return null;
    const resto = t.slice(2);
    const sumaResto = resto.reduce((s, d) => s + d.n, 0);
    return [
      `El tipo ${q(t[0].valor)} reúne ${nf(t[0].n)} publicaciones (${pc(pct(t[0].n, sub.length))})`
        + (t[1] ? ` y ${q(t[1].valor)}, ${nf(t[1].n)} (${pc(pct(t[1].n, sub.length))}).` : '.'),
      ...(resto.length ? [`Los ${nf(resto.length)} tipos restantes suman ${nf(sumaResto)} (${pc(pct(sumaResto, sub.length))}).`] : []),
    ];
  },

  'P-05': (sub) => {
    const f = desc(X.porCampo(sub, 'fuente'));
    if (!f.length) return null;
    const tope = f.slice(0, 15).reduce((s, d) => s + d.n, 0);
    const unicas = f.filter(d => d.n === 1).length;
    return [
      `Las publicaciones se distribuyen en ${nf(f.length)} fuentes distintas.`
        + ` La más frecuente, ${f[0].valor}, reúne ${nf(f[0].n)} (${pc(pct(f[0].n, sub.length))}),`
        + ` y las ${nf(Math.min(15, f.length))} primeras, ${nf(tope)} (${pc(pct(tope, sub.length))}).`,
      `${nf(unicas)} fuentes (${pc(pct(unicas, f.length))} de las fuentes) tienen una sola publicación del recorte.`,
    ];
  },

  'P-07': (sub, { jerarquia } = {}) => {
    const cob = X.cobertura(sub, 'unidad');
    const fac = desc(X.porFacultad(sub, jerarquia || {}).filter(d => !SIN_UNIDAD.has(d.valor)));
    if (!fac.length) return [`Ninguna publicación del recorte tiene facultad identificada.`];
    return [
      `La unidad académica está identificada en ${nf(cob.cubiertas)} publicaciones (${pc(pct(cob.cubiertas, sub.length))}).`,
      `${fac[0].valor} aparece en ${nf(fac[0].n)} (${pc(pct(fac[0].n, cob.cubiertas))} de las identificadas)`
        + (fac.length > 1 ? `; le siguen ${lista(fac.slice(1), 2)}.` : '.'),
    ];
  },

  escuela: (sub, { jerarquia } = {}) => {
    const j = jerarquia || {};
    const e = desc(X.porEscuela(sub, j));
    if (!e.length) return [`Ninguna publicación del recorte nombra una escuela.`];
    const facs = new Set(e.map(d => j[d.valor]));
    return [
      `${nf(e.length)} ${e.length === 1 ? 'escuela aparece' : 'escuelas aparecen'} en el recorte,`
        + ` de ${nf(facs.size)} ${facs.size === 1 ? 'facultad' : 'facultades'}.`,
      `La más frecuente es ${e[0].valor} (${nf(e[0].n)}), de la ${j[e[0].valor]}`
        + (e.length > 1 ? `; le siguen ${lista(e.slice(1), 2)}.` : '.'),
    ];
  },

  'I-01': (sub) => {
    const s = X.sumaPorAnio(sub, 'citas').map(d => ({ anio: d.anio, valor: d.n }));
    if (!s.length) return null;
    const total = s.reduce((a, d) => a + d.valor, 0);
    if (!total) return [`Las publicaciones del recorte no registran citas al corte.`];
    const { max, ultimo } = extremos(s);
    const top = sub.filter(p => typeof p.citas === 'number').reduce((m, p) => (p.citas > m.citas ? p : m));
    return [
      `Las publicaciones de ${max.anio} reúnen ${nf(max.valor)} citas (${pc(pct(max.valor, total))} del total),`
        + ` el año con más citas` + (ultimo.anio !== max.anio
          ? `; las de ${ultimo.anio}, ${nf(ultimo.valor)} (${pc(pct(ultimo.valor, total))}).` : '.'),
      `La publicación más citada del recorte, de ${top.anio}, suma ${nf(top.citas)} citas (${pc(pct(top.citas, total))} del total).`,
    ];
  },

  'I-09': (sub) => {
    const s = X.medianaPorAnio(sub, 'citas');
    if (s.length < 2) return null;
    const { max, min, aniosMax, aniosMin, primero, ultimo } = extremos(s);
    const out = [`La mediana de citas por publicación va de ${med(max.valor)} (${unirY(aniosMax)})`
      + ` a ${med(min.valor)} (${unirY(aniosMin)}).`];
    // Primer y último año, solo si no son ya los extremos nombrados.
    const nombrados = new Set([...aniosMax, ...aniosMin]);
    const faltan = [primero, ultimo].filter((d, i, xs) => !nombrados.has(d.anio) && xs.indexOf(d) === i);
    if (faltan.length) {
      out.push(`${faltan.length === 2 ? 'Es' : 'En'} ${faltan.length === 2
        ? `${med(faltan[0].valor)} en ${faltan[0].anio} y ${med(faltan[1].valor)} en ${faltan[1].anio}`
        : `${faltan[0].anio} es ${med(faltan[0].valor)}`}.`);
    }
    return out;
  },

  'I-08': (sub) => {
    const v = sub.filter(p => p.tiene_metricas && typeof p.citas === 'number').map(p => p.citas).sort((a, b) => b - a);
    if (!v.length) return null;
    const total = v.reduce((a, x) => a + x, 0);
    const sin = v.filter(x => x === 0).length;
    const k = Math.max(1, Math.round(v.length * 0.1));
    const conc = v.slice(0, k).reduce((a, x) => a + x, 0);
    return [
      `${nf(sin)} publicaciones (${pc(pct(sin, v.length))}) no tienen citas al corte.`,
      `La mediana es ${med(X.mediana(v))} citas y el promedio, ${dec(total / v.length)}.`,
      `El 10 % más citado (${nf(k)} publicaciones) reúne el ${pc(pct(conc, total))} de las citas.`,
    ];
  },

  'I-04': (sub) => {
    const f = sub.map(p => p.fwci).filter(x => typeof x === 'number');
    const s = X.medianaPorAnio(sub, 'fwci');
    if (!f.length || !s.length) return null;
    const { max, min, aniosMax, aniosMin } = extremos(s);
    const sobre = f.filter(x => x >= 1).length;
    const bajo1 = s.every(d => d.valor < 1);
    return [
      `El FWCI mediano del recorte es ${dec(X.mediana(f))}, sobre ${nf(f.length)} publicaciones con FWCI.`,
      `Por año va de ${dec(min.valor)} (${unirY(aniosMin)}) a ${dec(max.valor)} (${unirY(aniosMax)})`
        + (bajo1 ? '; en ningún año alcanza 1,00, el promedio mundial.' : '.'),
      `${nf(sobre)} publicaciones (${pc(pct(sobre, f.length))}) tienen FWCI igual o superior a 1,00.`,
    ];
  },

  'I-05': (sub) => {
    const { datos, base } = X.umbralesPercentil(sub);
    if (!base) return null;
    const [d10, d25] = [10, 25].map(u => ({ u, n: datos.find(x => x.valor === `Top ${u} %`).n, esp: (base * u) / 100 }));
    return [
      `En el 10 % más citado del mundo hay ${nf(d10.n)} publicaciones (${pc(pct(d10.n, base))}),`
        + ` ${frente(d10.n, d10.esp)} las ${nf(Math.round(d10.esp))} que corresponderían si el recorte`
        + ' se distribuyera como el conjunto mundial.',
      `En el 25 % más citado hay ${nf(d25.n)} (${pc(pct(d25.n, base))}), ${frente(d25.n, d25.esp)}`
        + ` las ${nf(Math.round(d25.esp))} esperables con ese mismo criterio.`,
    ];
  },

  // R-01, A-01, C-01 y C-03 vienen de SciVal y se miden sobre las publicaciones
  // con métricas, igual que el build: una exclusiva de Web of Science no trae
  // cuartil, acceso abierto ni países (D-791). Hoy son todas.
  'R-01': (sub) => {
    const q = Object.fromEntries(X.porCampo(sub, 'cuartil').map(d => [d.valor, d.n]));
    const de = sub.every(p => p.tiene_metricas) ? 'del recorte' : 'de las que tienen métricas';
    const sinDato = q['Sin dato declarado'] || 0;
    const base = ['Q1', 'Q2', 'Q3', 'Q4'].reduce((s, k) => s + (q[k] || 0), 0);
    if (!base) return null;
    const q1 = q.Q1 || 0;
    // Primero sobre la base de la figura —todo el recorte—; después sobre las
    // que tienen cuartil, que es donde vale la referencia del 25 %.
    return [
      `${nf(q1)} publicaciones (${pc(pct(q1, base + sinDato))} ${de}) están en revistas Q1.`
        + ` Sobre las ${nf(base)} con cuartil son el ${pc(pct(q1, base))}, ${frenteAl(pct(q1, base), 25)}`
        + ' 25 % que correspondería a un reparto uniforme entre cuartiles.',
      `Sobre esa misma base, Q1 y Q2 reúnen el ${pc(pct(q1 + (q.Q2 || 0), base))}; Q4, el ${pc(pct(q.Q4 || 0, base))}.`,
    ];
  },

  'A-01': (todas) => {
    const sub = todas.filter(p => p.tiene_metricas);
    const oa = desc(X.porCampo(sub, 'open_access'));
    const sinDato = (oa.find(d => d.valor === 'Sin dato declarado') || { n: 0 }).n;
    const vias = oa.filter(d => d.valor !== 'Sin dato declarado');
    const con = sub.length - sinDato;
    const multi = sub.filter(p => (p.open_access || []).length > 1).length;
    if (!vias.length) return [`Ninguna publicación del recorte declara una vía de acceso abierto.`];
    return [
      `${nf(con)} publicaciones (${pc(pct(con, sub.length))}) tienen al menos una vía de acceso abierto declarada`
        + ` y ${nf(sinDato)} (${pc(pct(sinDato, sub.length))}) no declaran ninguna.`,
      `La vía más frecuente es ${q(vias[0].valor)} (${nf(vias[0].n)})` + (vias[1] ? `, seguida de ${lista(vias.slice(1), 2, true)}.` : '.'),
      `${nf(multi)} publicaciones declaran más de una vía.`,
    ];
  },

  'C-01': (todas) => {
    const sub = todas.filter(p => p.tiene_metricas);
    const intl = sub.filter(p => p.es_internacional).length;
    const out = [`${nf(intl)} publicaciones (${pc(pct(intl, sub.length))}) son en colaboración internacional`
      + ` y ${nf(sub.length - intl)} (${pc(pct(sub.length - intl, sub.length))}), nacionales.`];
    const anios = [...new Set(sub.map(p => p.anio))].sort();
    if (anios.length >= REGLAS.aniosEvolucion) {
      const pa = (a) => { const s = sub.filter(p => p.anio === a); return pct(s.filter(p => p.es_internacional).length, s.length); };
      const [a, b] = [anios[0], anios[anios.length - 1]];
      out.push(`La proporción internacional es ${pc(pa(a))} en ${a} y ${pc(pa(b))} en ${b}.`);
    }
    return out;
  },

  'C-03': (todas, { pais } = {}) => {
    const sub = todas.filter(p => p.tiene_metricas);
    const socios = desc(X.porCampo(sub, 'paises').filter(d => d.valor !== pais));
    const intl = sub.filter(p => p.es_internacional).length;
    const out = [`El ${pc(pct(intl, sub.length))} de las publicaciones incluye instituciones de más de un país.`];
    if (socios.length) {
      out.push(`${pais ? `Además de ${pais}, figuran` : 'Figuran'} ${nf(socios.length)}`
        + ` ${socios.length === 1 ? 'país' : 'países'}; los más frecuentes son ${lista(socios)}.`);
      // La autoría masiva ya la declara la nota de la figura: no se repite.
    }
    return out;
  },

  'C-04': (sub, { meta } = {}) => {
    const propia = meta && meta.institucion;
    const inst = desc(X.porCampo(sub, 'instituciones').filter(d => d.valor !== propia));
    if (!inst.length) return [`Ninguna publicación del recorte nombra otra institución.`];
    const unicas = inst.filter(d => d.n === 1).length;
    return [
      `${propia ? `Además de la ${propia}, figuran` : 'Figuran'} ${nf(inst.length)} instituciones;`
        + ` las más frecuentes son ${lista(inst)}.`,
      `${nf(unicas)} instituciones (${pc(pct(unicas, inst.length))} de ellas) aparecen en una sola publicación.`,
    ];
  },

  'C-06': (sub) => {
    const v = sub.map(p => p.n_autores).filter(x => typeof x === 'number');
    if (!v.length) return null;
    const uno = v.filter(x => x === 1).length;
    const mas20 = v.filter(x => x > 20).length;
    return [
      `La mediana es ${med(X.mediana(v))} autores por publicación.`,
      `${nf(uno)} publicaciones (${pc(pct(uno, v.length))}) tienen un solo autor y ${nf(mas20)} (${pc(pct(mas20, v.length))}),`
        + ` más de 20; la de mayor autoría tiene ${nf(Math.max(...v))}.`,
    ];
  },

  'AU-07': (sub) => {
    const { firmas, datos } = X.productividad(sub);
    if (!firmas) return null;
    const de = (v) => (datos.find(d => d.valor === v) || { n: 0 }).n;
    const cinco = de('5-9') + de('10+');
    return [
      `El recorte reúne ${nf(firmas)} formas de firma de la institución.`,
      `${nf(de('1'))} (${pc(pct(de('1'), firmas))}) tienen una sola publicación y ${nf(cinco)} (${pc(pct(cinco, firmas))}),`
        + ' cinco o más.',
    ];
  },

  // La red la calcula `corteRed()`; llega en `contexto.red`.
  'C-05': (sub, { red } = {}) => {
    if (!red || !red.personas) return null;
    return [
      `De las ${nf(red.personas)} formas de firma del recorte, ${nf(red.conectadas)}`
        + ` (${pc(pct(red.conectadas, red.personas))}) tienen al menos una coautoría interna.`,
      // Cada firma sin coautor interno es una componente de uno: se descuentan
      // para describir los grupos que sí tienen vínculos.
      `Las firmas con coautoría interna forman ${nf(red.componentes - (red.personas - red.conectadas))} componentes;`
        + ` la mayor reúne ${nf(red.mayor)} (${pc(pct(red.mayor, red.personas))} de todas las formas de firma).`,
    ];
  },

  'T-05': (sub) => {
    const a = desc(X.porCampo(sub, 'qs_area'));
    if (!a.length) return null;
    const con = sub.filter(p => (p.qs_area || []).length).length;
    return [
      `${nf(con)} publicaciones (${pc(pct(con, sub.length))}) tienen área QS asignada.`,
      `${q(a[0].valor)} aparece en ${nf(a[0].n)} (${pc(pct(a[0].n, sub.length))} del recorte)`
        + (a.length > 1 ? `; le siguen ${lista(a.slice(1), 2, true)}.` : '.'),
    ];
  },

  'T-01': (sub) => {
    const a = desc(X.porCampo(sub, 'asjc'));
    if (!a.length) return null;
    return [
      `Las publicaciones se clasifican en ${nf(a.length)} categorías ASJC distintas; las más frecuentes son ${lista(a, REGLAS.nombrados, true)}.`,
      `La primera aparece en el ${pc(pct(a[0].n, sub.length))} de las publicaciones del recorte.`,
    ];
  },

  'T-04': (sub) => {
    const o = desc(X.porCampo(sub, 'ods'));
    const con = sub.filter(p => (p.ods || []).length).length;
    if (!o.length) return [`Ninguna publicación del recorte tiene un ODS asignado.`];
    return [
      `${nf(con)} publicaciones (${pc(pct(con, sub.length))}) tienen al menos un ODS asignado.`,
      `Los más frecuentes son ${lista(o, REGLAS.nombrados, true)}.`,
    ];
  },

  'I-07': (sub) => {
    const { filas } = X.masCitadas(sub, 10);
    if (!filas.length) return null;
    const total = sub.filter(p => typeof p.citas === 'number').reduce((a, p) => a + p.citas, 0);
    const suma = filas.reduce((a, p) => a + p.citas, 0);
    const fw = filas.map(p => p.fwci).filter(x => typeof x === 'number');
    const anios = filas.map(p => p.anio);
    return [
      `Las ${nf(filas.length)} publicaciones más citadas reúnen ${nf(suma)} citas (${pc(pct(suma, total))} del total del recorte);`
        + ` la primera suma ${nf(filas[0].citas)} (${pc(pct(filas[0].citas, total))}).`,
      `Son de ${Math.min(...anios)} a ${Math.max(...anios)}`
        + (fw.length ? ` y su FWCI va de ${dec(Math.min(...fw))} a ${dec(Math.max(...fw))}.` : '.'),
    ];
  },

  dinamica: (sub) => {
    const p = X.porCampo(sub, 'anio').map(d => ({ anio: d.valor, valor: d.n }));
    const s = X.sumaPorAnio(sub, 'citas').map(d => ({ anio: d.anio, valor: d.n }));
    if (!p.length) return null;
    const mp = extremos(p).max;
    const out = [`El año con más publicaciones es ${mp.anio} (${nf(mp.valor)}; ${pc(pct(mp.valor, sub.length))} del recorte).`];
    if (s.length) {
      const ms = extremos(s).max;
      const total = s.reduce((a, d) => a + d.valor, 0);
      out.push(`El año con más citas es ${ms.anio} (${nf(ms.valor)}; ${pc(pct(ms.valor, total))} de las citas).`);
    }
    return out;
  },

  // Pares autor × publicación por facultad (`construirArbol()`), en `contexto.arbol`.
  treemap: (sub, { arbol } = {}) => {
    if (!arbol || !arbol.n_publicaciones) return null;
    const hijos = arbol.hijos || [];
    const ident = hijos.filter(h => !SIN_UNIDAD.has(h.nombre));
    const nIdent = ident.reduce((a, h) => a + h.n_publicaciones, 0);
    if (!ident.length) return [`Ningún par autor × publicación del recorte tiene facultad identificada.`];
    const f = ident[0];
    const esc = (f.hijos || [])[0];
    return [
      `De los ${nf(arbol.n_publicaciones)} pares autor × publicación, ${nf(nIdent)} (${pc(pct(nIdent, arbol.n_publicaciones))})`
        + ' tienen facultad identificada.',
      `${f.nombre} reúne ${nf(f.n_publicaciones)} (${pc(pct(f.n_publicaciones, nIdent))} de los identificados)`
        + (esc ? `; dentro de ella, ${esc.nombre} aporta ${nf(esc.n_publicaciones)}.` : '.'),
    ];
  },

  // Categorías ASJC × año (`agregarMatriz()`), en `contexto.matriz`.
  heatmap: (sub, { matriz } = {}) => {
    if (!matriz || !matriz.categorias.length) return null;
    const { anios, categorias, matriz: m } = matriz;
    const total = (cat) => anios.reduce((a, y) => a + (m.get(cat).get(y) || 0), 0);
    const lider = (y) => categorias.reduce((b, cat) => ((m.get(cat).get(y) || 0) > (m.get(b).get(y) || 0) ? cat : b));
    const lideres = anios.map(lider);
    const primera = categorias[0];
    const anosPrimera = lideres.filter(x => x === primera).length;
    const ult = anios[anios.length - 1];
    return [
      `${q(primera)} es la categoría con más publicaciones del periodo (${nf(total(primera))})`
        + ` y la más frecuente en ${nf(anosPrimera)} de los ${nf(anios.length)} años.`,
      lider(ult) === primera
        ? `En ${ult} también es la más frecuente (${nf(m.get(primera).get(ult) || 0)}).`
        : `En ${ult}, la categoría más frecuente es ${q(lider(ult))} (${nf(m.get(lider(ult)).get(ult) || 0)}).`,
    ];
  },
};

// Las figuras de la portada que dibujan el mismo indicador que una sección.
const ALIAS = { anio: 'P-02', qs_area: 'T-05', unidad: 'P-07', tipo: 'P-03' };

export const CODIGOS = Object.keys(ANALISTAS);

/** El análisis de la figura `cod` sobre el recorte: {texto: [oraciones],
    insuficiente?}, o null si la figura no tiene analista o no hay dato. */
export function analisis(cod, sub, contexto = {}) {
  const leer = ANALISTAS[ALIAS[cod] || cod];
  if (!leer || !sub) return null;
  const minimo = (contexto.meta && contexto.meta.n_minimo_interpretable_unidad) || REGLAS.minimo;
  if (sub.length < minimo) {
    return { insuficiente: true, texto: [`Con ${nf(sub.length)} ${sub.length === 1 ? 'publicación' : 'publicaciones'}`
      + ` en el recorte, menos de ${nf(minimo)}, la figura no se analiza: una sola publicación cambiaría`
      + ' visiblemente cada proporción.'] };
  }
  const texto = leer(sub, contexto);
  return texto && texto.length ? { texto } : null;
}

/** El bloque HTML que va bajo «Qué muestra». */
export function comentario(cod, sub, contexto = {}) {
  const a = analisis(cod, sub, contexto);
  if (!a) return '';
  return `<div class="comentario" data-comentario="${c.escapar(ALIAS[cod] || cod)}">
    <p class="lectura-grafico comentario-figura"><b>Análisis</b> ${a.texto.map(c.escapar).join(' ')}</p>
  </div>`;
}
