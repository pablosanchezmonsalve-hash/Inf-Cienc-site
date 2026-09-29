/* Comentario de cada figura: qué se observa, qué precauciones pide y qué no
   permite concluir (piloto con P-02, I-05, R-01 y C-03, 2026-09-29).

   POR QUÉ EXISTE
   «Qué muestra» explica cómo leer la figura; no dice qué se ve en ella. El
   análisis estaba solo en su página, lejos de la figura que interpreta. Este
   módulo escribe, junto a cada figura, una lectura DESCRIPTIVA con una
   referencia explícita (el promedio mundial, lo esperable, la propia
   evolución), la base sobre la que se calcula y el límite de lo que la figura
   permite afirmar. Es la función que el Manifiesto de Leiden y DORA le asignan
   al comentario bibliométrico: orientar el juicio experto, no sustituirlo.

   REGLAS
   - Todo sale de los datos del recorte, con las mismas funciones que dibujan la
     figura: cambia con los filtros y el sitio y el PDF dicen lo mismo.
   - Verbos descriptivos (pasa de, se concentra, está por debajo de). Ni
     adjetivos de valor ni causas: `src/verify/comentarios.mjs` lo comprueba.
   - Silencio declarado: bajo `minimo` publicaciones no se comenta la figura, se
     dice que la muestra no alcanza.
   - Los umbrales son parámetros (`REGLAS`), no cifras escritas en el texto. */

import * as c from './core.js';
import * as X from './explorador.js';

export const REGLAS = {
  // Por debajo de esto una sola publicación mueve visiblemente cada porcentaje.
  // Es el mismo umbral que la portada usa para advertir un recorte pequeño.
  minimo: 20,
  // Diferencia relativa con la referencia bajo la cual se dice «en torno a».
  tolerancia: 0.05,
  // Años necesarios para describir una evolución.
  aniosEvolucion: 3,
};

const nf = (x) => c.nf.format(x);
const pct = (a, b) => (b ? (100 * a) / b : 0);
const pc = (x) => `${c.num(x, 1)} %`;
const unirY = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** «por encima de», «por debajo de» o «en torno a» una referencia. */
export function frente(obs, ref, tol = REGLAS.tolerancia) {
  if (!ref) return 'sin referencia';
  const d = obs / ref - 1;
  return Math.abs(d) <= tol ? 'en torno a' : d > 0 ? 'por encima de' : 'por debajo de';
}

/* Cada lector recibe el recorte y devuelve { observa: [..], precauciones: [..],
   noConcluye: '' } en texto plano; el marcado lo pone `comentario()`. */
const LECTORES = {
  'P-02': (sub) => {
    const serie = X.porCampo(sub, 'anio')
      .map(d => ({ anio: Number(d.valor), n: d.n })).sort((a, b) => a.anio - b.anio);
    const observa = [];
    if (serie.length >= REGLAS.aniosEvolucion) {
      const [a, b] = [serie[0], serie[serie.length - 1]];
      const cambio = pct(b.n - a.n, a.n);
      observa.push(`La producción pasa de ${nf(a.n)} publicaciones en ${a.anio} a ${nf(b.n)} en ${b.anio}`
        + ` (${cambio >= 0 ? '+' : '−'}${c.num(Math.abs(cambio), 1)} %).`);
      const sube = serie.slice(1).filter((d, i) => d.n > serie[i].n).length;
      const max = serie.reduce((m, d) => (d.n > m.n ? d : m));
      observa.push(`Aumenta en ${nf(sube)} de los ${nf(serie.length - 1)} intervalos anuales`
        + ` y su máximo está en ${max.anio} (${nf(max.n)}).`);
    } else {
      observa.push(`El recorte abarca ${nf(serie.length)} ${serie.length === 1 ? 'año' : 'años'}:`
        + ' no alcanza para describir una evolución.');
    }
    return {
      observa,
      precauciones: [
        'Cuenta publicaciones indexadas en Scopus, cuya cobertura también cambia de un año a otro.',
        'El último año puede aumentar todavía por el retraso de indexación.',
      ],
      noConcluye: 'Que la productividad del cuerpo académico haya variado en la misma proporción:'
        + ' la figura no se relaciona con el número de académicos ni con su dedicación.',
    };
  },

  'I-05': (sub, { meta } = {}) => {
    const { datos, base } = X.umbralesPercentil(sub);
    const observa = [10, 25].map(u => {
      const d = datos.find(x => x.valor === `Top ${u} %`);
      const esperado = (base * u) / 100;
      return `En el ${u} % más citado del mundo hay ${nf(d.n)} publicaciones (${pc(pct(d.n, base))}),`
        + ` ${frente(d.n, esperado)} las ${nf(Math.round(esperado))} que corresponderían si el recorte`
        + ' se comportara como el conjunto mundial.';
    });
    const corte = meta && meta.fecha_corte_citas ? ` al ${c.fechaLarga(meta.fecha_corte_citas)}` : '';
    return {
      observa,
      precauciones: [
        `Percentil de citación de SciVal${corte}: las publicaciones recientes todavía acumulan citas`
          + ' y tienden a quedar fuera de los umbrales.',
        'Las publicaciones empatadas en el umbral cuentan dentro de él.',
      ],
      noConcluye: 'La calidad científica de las publicaciones: el percentil compara citas recibidas'
        + ' con el conjunto mundial, no el valor del trabajo.',
    };
  },

  'R-01': (sub) => {
    const q = Object.fromEntries(X.porCampo(sub, 'cuartil').map(d => [d.valor, d.n]));
    const sinDato = q['Sin dato declarado'] || 0;
    const base = ['Q1', 'Q2', 'Q3', 'Q4'].reduce((s, k) => s + (q[k] || 0), 0);
    if (!base) return null;
    const q1 = q.Q1 || 0;
    const q12 = q1 + (q.Q2 || 0);
    const total = base + sinDato;
    return {
      // Primero sobre la misma base que la figura —todo el recorte, con «Sin
      // dato declarado» como segmento—; después sobre las que tienen cuartil,
      // que es donde vale la referencia del 25 %. Dos porcentajes sin su base,
      // uno en la barra y otro en el texto, se leen como una contradicción.
      observa: [
        `${nf(q1)} publicaciones (${pc(pct(q1, total))} del recorte) están en revistas Q1.`
          + ` Sobre las ${nf(base)} con cuartil son el ${pc(pct(q1, base))},`
          + ` ${frente(pct(q1, base), 25).replace(/ a$/, ' al').replace(/ de$/, ' del')} 25 % que correspondería`
          + ' si se repartieran por igual entre cuartiles.',
        `Sobre esa misma base, Q1 y Q2 reúnen el ${pc(pct(q12, base))}; Q4, el ${pc(pct(q.Q4 || 0, base))}.`,
      ],
      precauciones: [
        'Es una métrica de la revista, no del artículo.',
        'Cuando una revista pertenece a varias áreas, SciVal podría asignarle el percentil de la más'
          + ' favorable; el proyecto aún no lo confirma en la documentación completa.',
        ...(sinDato ? [`${nf(sinDato)} publicaciones sin cuartil (${pc(pct(sinDato, base + sinDato))}) quedan fuera.`] : []),
      ],
      noConcluye: 'Que esos artículos tengan un impacto alto: una revista Q1 publica artículos muy'
        + ' citados y otros sin citas.',
    };
  },

  'C-03': (sub, { pais } = {}) => {
    const todos = X.porCampo(sub, 'paises');
    const socios = pais ? todos.filter(d => d.valor !== pais) : todos;
    const intl = sub.filter(p => p.es_internacional).length;
    const tres = socios.slice(0, 3).map(d => `${d.valor} (${nf(d.n)})`);
    const observa = [
      `El ${pc(pct(intl, sub.length))} de las publicaciones incluye instituciones de más de un país.`,
    ];
    if (socios.length) {
      observa.push(`${pais ? `Además de ${pais}, figuran` : 'Figuran'} ${nf(socios.length)}`
        + ` ${socios.length === 1 ? 'país' : 'países'}; los más frecuentes son ${unirY(tres)}.`);
    }
    return {
      observa,
      precauciones: [
        'Conteo completo: cada publicación suma todos sus países, también las de autoría masiva.',
      ],
      noConcluye: 'La intensidad ni la estabilidad de la colaboración: basta una publicación para que'
        + ' un país aparezca, y la figura no distingue un vínculo sostenido de uno ocasional.',
    };
  },
};

export const CODIGOS = Object.keys(LECTORES);

/** El comentario de la figura `cod` sobre el recorte, en texto plano (lo usa
    la verificación), o null si el indicador no tiene lector. */
export function lectura(cod, sub, contexto = {}) {
  const leer = LECTORES[cod];
  if (!leer || !sub) return null;
  const minimo = (contexto.meta && contexto.meta.n_minimo_interpretable_unidad) || REGLAS.minimo;
  if (sub.length < minimo) {
    return { insuficiente: true, observa: [`Con ${nf(sub.length)} ${sub.length === 1 ? 'publicación' : 'publicaciones'}`
      + ` en el recorte, menos de ${nf(minimo)}, la figura no se comenta: una sola publicación cambiaría la lectura.`],
      precauciones: [], noConcluye: '' };
  }
  return leer(sub, contexto);
}

/** El bloque HTML que va bajo «Qué muestra». */
export function comentario(cod, sub, contexto = {}) {
  const l = lectura(cod, sub, contexto);
  if (!l) return '';
  const p = (titulo, textos) => (textos.length
    ? `<p class="lectura-grafico comentario-figura"><b>${titulo}</b> ${textos.map(c.escapar).join(' ')}</p>` : '');
  return `<div class="comentario" data-comentario="${c.escapar(cod)}">
    ${p('Qué se observa', l.observa)}
    ${p('Precauciones', l.precauciones)}
    ${l.noConcluye ? p('Qué no permite concluir', [l.noConcluye]) : ''}
  </div>`;
}
