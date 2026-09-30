/* tema.js — corre antes de pintar, sin módulo ni diferido, y las dos cosas
   que hace tienen que ocurrir antes.
   1. El tema guardado: desde el módulo diferido, la página aparecería un
      instante con el tema equivocado.
   2. La clase `js`: marca que hay JavaScript. Las vistas conmutables se
      contraen a una sola solo bajo esa clase; sin JS se muestran las dos, que
      es lo correcto —la tabla es la vía equivalente al gráfico, no un extra—.
   Estaba en línea en la cabecera; como archivo, la política de seguridad de
   contenido puede prohibir todo guion en línea (C11). */
(function () {
  var e = document.documentElement;
  e.className += ' js';
  try { var t = localStorage.getItem('tema'); if (t) e.setAttribute('data-tema', t); } catch (x) { /* sin almacenamiento */ }
})();
