# Inf-Cienc · sitio público

Repositorio de **despliegue** del informe bibliométrico institucional.

Solo contiene la **capa pública** del sitio (`dist/`, D-SEC-02): datos procesados
bajo licencia CC BY 4.0, páginas HTML, JS, CSS y el informe PDF. Nunca datos
brutos (Elsevier) ni la capa interna (`internal/`).

- Repositorio fuente (privado, con datos): [`pablosanchezmonsalve-hash/Inf-Cienc`](https://github.com/pablosanchezmonsalve-hash/Inf-Cienc)
- Sitio publicado: <https://pablosanchezmonsalve-hash.github.io/Inf-Cienc-site/>

## Cómo se publica

El flujo `Publicar sitio público al repo de despliegue` del repositorio fuente
ensambla `dist/` desde la capa pública versionada, verifica que no viaje material
interno y empuja el resultado a la rama `gh-pages` de este repositorio mediante
el secreto `DEPLOY_PAT`. GitHub Pages sirve directamente esa rama.