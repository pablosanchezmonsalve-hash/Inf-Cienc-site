/* produccion_mapas.js — primer montaje del treemap y del mapa de calor de
   Producción. Estaba en línea en produccion.html; como archivo, la política de
   seguridad de contenido puede prohibir todo guion en línea (C11). */
// Primer montaje del treemap. Usa construirArbol() —la misma función que
// paginas.js llama en cada recorte— sobre el filtro YA presente en la URL
// al cargar (si alguien llega por un enlace con ?anio=2023, por ejemplo).
// Antes esto cargaba hierarchy.json directo, sin mirar la URL: si
// paginas.js montaba el treemap filtrado primero y este script lo
// sobrescribía después con el árbol completo sin filtrar, quien entrara
// por un enlace filtrado vería el treemap equivocado por una carrera
// entre los dos montajes. Con la misma función y la misma URL como
// entrada, los dos caminos siempre calculan lo mismo — no hay carrera
// que ganar porque no hay dos respuestas posibles.
import { cargar } from './core.js';
import * as X from './explorador.js';
import { montarTreemap, construirArbol } from './visualizations/treemap.js';
import { montarHeatmap, agregarMatriz } from './visualizations/heatmap.js';
import { comentario } from './comentarios.js';
import { ANCHO_PAPEL } from './vista_explorador.js';

/* En papel, el treemap y el mapa de calor se redibujan al ancho de la hoja
   (D-755): dibujados a la tarjeta de pantalla, la hoja los estira y sus
   rótulos quedan apretados. Los ganchos los deja cada montaje. */
const MAPAS = ['treemap-contenedor', 'heatmap-contenedor'];
addEventListener('beforeprint', () =>
  MAPAS.forEach(id => document.getElementById(id)?._alPapel?.(ANCHO_PAPEL)));
addEventListener('afterprint', () =>
  MAPAS.forEach(id => document.getElementById(id)?._alPantalla?.()));

async function montarModulosNuevos() {
  const [{ publicaciones }, meta, { advertencia }] = await Promise.all([
    cargar('publications.json'), cargar('meta.json'), cargar('hierarchy.json'),
  ]);

  // Este treemap y el gráfico "Unidad académica" de arriba cuentan con
  // criterios distintos (pares autor×publicación vs. publicaciones
  // distintas) — declarado a propósito, no conciliado todavía. Sin este
  // aviso cruzado, alguien que mire ambos paneles vería números
  // distintos para la misma facultad sin saber por qué.
  const nota = document.getElementById('treemap-nota');
  if (nota) {
    const base = advertencia || '';
    nota.textContent = (base ? base + ' ' : '') +
      'Este treemap cuenta pares autor × publicación: una publicación con dos '
      + `autores ${meta.institucion_corta} de la misma unidad cuenta dos veces. El gráfico "Unidad `
      + 'académica", más arriba en esta misma página, cuenta publicaciones '
      + 'distintas —una sola vez por unidad— y por eso sus totales no '
      + 'coinciden con los de este treemap. Ambos criterios están '
      + 'documentados; ninguno es un error.';
  }

  const sel = X.leerURL();
  const recorte = X.recorte(publicaciones, sel);
  const arbol = construirArbol(recorte, X.jerarquiaDe(meta), meta.institucion_corta);
  montarTreemap(document.getElementById('treemap-contenedor'), arbol);
  /* El mapa de calor también, y por la misma razón que el treemap: la página
     pre-renderizada sin recorte no pasa por `pintar()`, así que nadie lo
     montaba y se quedaba con el lienzo estimado del build (760 unidades). En
     una tarjeta de 352 px eso dibujaba sus rótulos a 6 px, y en una de 1.042
     los estiraba a 16. Montado aquí, se dibuja al ancho medido y se redibuja
     solo con su `ResizeObserver`. */
  montarHeatmap(document.getElementById('heatmap-contenedor'), recorte);
  // El análisis de las dos figuras (comentarios.js), con las mismas
  // estructuras que las dibujan. paginas.js lo repite en cada recorte.
  const ta = document.getElementById('treemap-analisis');
  if (ta) ta.innerHTML = comentario('treemap', recorte, { meta, arbol });
  const ha = document.getElementById('heatmap-analisis');
  if (ha) ha.innerHTML = comentario('heatmap', recorte, { meta, matriz: agregarMatriz(recorte) });
}

document.addEventListener('DOMContentLoaded', () => {
  montarModulosNuevos().catch(e => console.error('Módulo Treemap:', e));
});
