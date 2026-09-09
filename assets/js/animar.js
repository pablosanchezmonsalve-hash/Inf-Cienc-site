/* animar.js — el movimiento de los gráficos.

   QUÉ RESUELVE
     Al recortar el conjunto, los gráficos se reemplazaban de golpe: las barras
     aparecían ya colocadas y había que releer las etiquetas para saber qué
     había cambiado. Ahora se MUEVEN a su nueva posición y las que salen del
     recorte se desvanecen, así que se ve cuál subió, cuál bajó y cuál se fue.

     La animación no es adorno: codifica el cambio. Es la distinción que separa
     A3 de A1 —contar una cifra— que se descartó por no codificar nada.

   POR QUÉ FLIP Y NO RECONCILIAR EL DOM
     Los gráficos se generan como cadena y se sustituyen con `innerHTML`, así
     que después de repintar TODOS los elementos son nuevos: no hay ninguno al
     que aplicarle una transición. Reconciliar el SVG marca por marca sería una
     segunda implementación del dibujo, que divergiría del generador.

     FLIP mide la geometría ANTES (First), deja repintar (Last), aplica la
     transformación que devuelve cada marca a donde estaba (Invert) y la anima
     hasta cero (Play). No necesita que los elementos sobrevivan: sólo que se
     puedan emparejar por `data-k`.

   POR QUÉ `transform` Y NO `width`
     En SVG, `x`, `y` y `width` son atributos. Su animación por CSS depende del
     navegador y falla en silencio donde no está. `transform` se anima en todas
     partes y sobre cualquier elemento SVG, así que el crecimiento de una barra
     se hace con `scaleX` desde su propio borde y el desplazamiento con
     `translate`.

   ACCESIBILIDAD
     Nada de esto ocurre si el sistema pide menos movimiento. No es una
     preferencia estética: hay personas a quienes el movimiento en pantalla les
     produce malestar físico. */

const QUIETO = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

const DUR_MOVER = 520;
const DUR_ENTRAR = 420;
const CURVA = 'cubic-bezier(.22,.61,.36,1)';

/** Geometría de cada marca de un contenedor, indexada por su clave. */
function medir(raiz) {
  const m = new Map();
  raiz.querySelectorAll('svg.chart [data-k]').forEach(el => {
    const svg = el.closest('svg');
    // La clave incluye el id del SVG: dos gráficos de la misma página pueden
    // tener la categoría «Facultad de Medicina», y emparejarlas entre sí haría
    // volar una barra de un gráfico a otro.
    m.set(`${svg.id}|${el.dataset.k}`, el.getBoundingClientRect());
  });
  return m;
}

/** El rectángulo que crece: el primero de la marca, si lo hay. */
const barraDe = el => el.querySelector('rect.barra, rect.seg, circle.marca-nodo');

/** Anima la ENTRADA de las marcas que no existían antes.

    Escalonada unos milisegundos, para que la vista recorra el gráfico en orden
    en vez de recibirlo entero de golpe (A2). El retardo se acota: con veinte
    barras, escalonar cada una 70 ms haría esperar segundo y medio. */
function entrar(el, i) {
  const b = barraDe(el);
  if (!b) return;
  const horizontal = b.tagName === 'rect' && +b.getAttribute('width') > +b.getAttribute('height');
  const caja = b.getBBox();
  const origen = horizontal ? `${caja.x}px ${caja.y + caja.height / 2}px`
                            : `${caja.x + caja.width / 2}px ${caja.y + caja.height}px`;
  b.animate(
    [{ transform: horizontal ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'none' }],
    { duration: DUR_ENTRAR, delay: Math.min(i * 45, 420), easing: CURVA, fill: 'backwards' },
  );
  b.style.transformOrigin = origen;
  b.style.transformBox = 'fill-box';
  // `fill-box` referencia el origen a la propia caja del rect y no al lienzo
  // del SVG. Sin él, escalar desde «el borde izquierdo» significaría el borde
  // izquierdo del gráfico entero y las barras saldrían disparadas.
  b.style.transformOrigin = horizontal ? 'left center' : 'center bottom';
}

/** Anima el paso de un estado al siguiente.

    `repintar` es la función que reemplaza el marcado. Se llama en medio: hay
    que medir antes y después del cambio, y la única forma de garantizar ese
    orden es que este módulo controle el momento del repintado. */
export function transicion(raiz, repintar) {
  if (!raiz) return repintar();
  if (QUIETO()) return repintar();

  const antes = medir(raiz);
  repintar();
  const marcas = [...raiz.querySelectorAll('svg.chart [data-k]')];

  let nuevas = 0;
  marcas.forEach(el => {
    const svg = el.closest('svg');
    const clave = `${svg.id}|${el.dataset.k}`;
    const previo = antes.get(clave);
    const ahora = el.getBoundingClientRect();

    if (!previo) { entrar(el, nuevas++); return; }

    const dx = previo.left - ahora.left;
    const dy = previo.top - ahora.top;
    // Una marca que no se movió ni cambió de tamaño no se anima: animarla
    // gastaría un fotograma en no decir nada.
    const escala = ahora.width > 1 ? previo.width / ahora.width : 1;
    if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(escala - 1) < .01) return;

    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: DUR_MOVER, easing: CURVA },
    );

    const b = barraDe(el);
    if (b && Math.abs(escala - 1) >= .01) {
      b.style.transformBox = 'fill-box';
      b.style.transformOrigin = 'left center';
      b.animate(
        [{ transform: `scaleX(${escala})` }, { transform: 'none' }],
        { duration: DUR_MOVER, easing: CURVA },
      );
    }
  });
}

/** La entrada inicial, cuando el gráfico aparece por primera vez.

    Se dispara al entrar en pantalla y no al cargar: animar un gráfico que está
    tres pantallas más abajo gasta la animación donde nadie la ve, y cuando el
    lector llega ya ocurrió. */
export function entradaAlVer(raiz) {
  if (!raiz || QUIETO() || !('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(entradas => {
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);
      [...e.target.querySelectorAll('[data-k]')].forEach(entrar);
    });
  }, { threshold: .25 });
  raiz.querySelectorAll('svg.chart').forEach(s => obs.observe(s));
}
