# Ads Manager

Base funcional de carteleria digital para red local construida con React + Vite.

La administracion y el player pueden correr en PCs distintas dentro de la misma LAN. El servidor local persiste la playlist y los medios en disco, sincroniza el estado por WebSocket para el admin y expone un manifiesto HTTP simple para que el player del TV funcione como cliente minimo de solo lectura.

## Stack

- React
- Vite
- React Router
- Zustand
- react-dropzone
- Hugeicons
- IndexedDB para cache local de blobs
- Express
- Multer
- WebSocket con `ws`
- polling HTTP simple para el player del TV

## Rutas

- `/`: administracion de playlist
- `/player` y `/player/:screenId`: reproduccion fullscreen minimalista para TV

## Funcionalidad implementada

- Carga multiple de imagenes y videos por drag and drop
- Persistencia real de medios en disco desde un servidor local
- Estado compartido entre equipos via REST + WebSocket
- Cache local de blobs en IndexedDB solo para la experiencia de administracion
- Manifiesto de reproduccion dedicado para TV con URLs HTTP directas del backend
- Reordenamiento manual de playlist con drag and drop nativo
- Eliminacion de items
- Seleccion de item con preview y metadatos
- Controles Play, Pausa, Siguiente, Anterior y Finalizar
- Orientacion global real para el player
- Estado idle en `/player` hasta recibir Play
- Avance automatico delegado al backend: timeout para imagenes y `ended` para videos
- Polling robusto cada pocos segundos para Smart TV con navegadores limitados

## Politica de formatos para TV

El perfil recomendado y soportado como base del sistema para carteleria es:

- contenedor `MP4`
- video `H.264 / AVC`
- audio `AAC` estereo
- resolucion sugerida `1080p`
- `30 fps`
- bitrate moderado

No se asume como formato base `AV1`, `VP9`, `HEVC/H.265` ni streaming adaptativo complejo.

El flujo actual valida y avisa cuando un video no llega como `video/mp4`. No se hace transcodificacion automatica en esta base, asi que la normalizacion recomendada debe ocurrir antes del upload o en un proceso de ingesta backend futuro.

## Perfiles de reproduccion y variantes

La app ahora separa `perfil solicitado` de `variante realmente reproducida`.

Perfiles disponibles:

- `Compatibilidad maxima`
- `Balanceado`
- `Eficiencia moderna`
- `Alta calidad moderna`
- `Experimental AV1`

Cada video puede declarar variantes con codec, contenedor, resolucion, bitrate y perfiles soportados. El player:

- recibe el perfil global solicitado desde administracion
- inspecciona las variantes disponibles del item actual
- valida compatibilidad con `canPlayType(...)`
- intenta la mejor variante del perfil pedido
- si falla, baja automaticamente al siguiente perfil seguro
- informa al admin que perfil pidio, cual termino reproduciendo y por que hizo fallback

### Ruta minima viable actual

En este repo no hay `ffmpeg` integrado ni disponible por defecto, asi que la generacion automatica de variantes queda preparada arquitectonicamente pero no se ejecuta sola.

La forma minima de cargar variantes reales hoy es subir archivos ya derivados con sufijos de perfil en el nombre, por ejemplo:

- `promo__compat.mp4`
- `promo__balanced.mp4`
- `promo__modern-hevc.mp4`
- `promo__modern-quality.mp4`
- `promo__av1.mp4`

Si varios archivos comparten el mismo nombre base y cambian solo el sufijo, el backend los agrupa como un solo asset de playlist con multiples variantes.

Si subes solo un archivo, el sistema lo registra como una variante unica y resuelve el fallback hacia el perfil seguro mas cercano cuando no exista una derivada mas moderna.

### Pipeline ideal pendiente

La arquitectura ya queda lista para que, cuando exista `ffmpeg` en el host, la ingesta haga esto:

1. guardar el master original
2. generar `compat_h264`
3. generar `balanced_h264`
4. generar `modern_hevc`
5. opcionalmente `premium_hevc` y `av1_experimental`
6. registrar metadata tecnica y poster

Ese paso no se fuerza en esta base para no fingir una capacidad que hoy no existe en el entorno.

## Arquitectura de reproduccion TV

La ruta `/player` ya no comparte la store pesada ni la cache local del admin.

- El backend sigue siendo la fuente de verdad de playlist, indice actual, estado, orientacion y duracion de imagenes.
- El TV consulta `GET /api/player/manifest` por polling simple.
- El TV renderiza solo un `img` o un `video` a la vez usando URLs HTTP directas del backend.
- Si un item falla, el player informa el error al backend y avanza sin bloquear toda la pantalla.
- Si no hay reproduccion activa o no quedan items viables, muestra un estado idle sobrio.

## Comandos

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
pnpm start
```

`pnpm start` arranca el servidor de produccion en `5173`. Si ya ejecutaste `pnpm build`, ese mismo servidor tambien servira la app compilada desde `dist/`.

En produccion usa solo `pnpm start`: primero compila la app y luego levanta un unico proceso en `5173` que sirve el frontend compilado, la API y el WebSocket.

`pnpm dev` levanta dos procesos:

- cliente Vite en el puerto `5173`
- servidor LAN interno en el puerto `8787`

En desarrollo, el navegador carga la UI desde `5173` pero las llamadas REST y el WebSocket van directo al servidor `8787` usando el mismo hostname. Abre `http://IP-DEL-PC-ADMIN:5173/` en el equipo de administracion y `http://IP-DEL-PC-ADMIN:5173/player` en el equipo conectado a la pantalla.

En produccion, esas mismas rutas quedan servidas directamente por `pnpm start`:

- `http://IP-DEL-PC-ADMIN:5173/`
- `http://IP-DEL-PC-ADMIN:5173/player`

## Estructura relevante

```text
src/
  components/
  lib/
  routes/
  store/
  types/
server/
```

## Notas tecnicas

- Los object URLs no se persisten. Se recrean desde IndexedDB o se descargan del servidor cuando hace falta.
- El admin sigue usando IndexedDB para acelerar previews y operaciones de escritorio; el player del TV no depende de IndexedDB.
- El player no empieza a reproducir hasta que el estado cambia a `playing` desde administracion.
- La carpeta `local-data/` contiene el estado persistido del servidor y los archivos subidos.
- Para usarlo entre equipos, ambos PCs deben poder llegar por red al host donde corre `pnpm dev`.
