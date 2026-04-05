# Ads Manager

Base funcional de carteleria digital para red local construida con React + Vite.

La administracion y el player pueden correr en PCs distintas dentro de la misma LAN. El servidor local persiste la playlist y los medios en disco, sincroniza el estado por WebSocket y cada navegador mantiene una cache local en IndexedDB para acelerar la reproduccion.

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

## Rutas

- `/`: administracion de playlist
- `/player`: reproduccion fullscreen

## Funcionalidad implementada

- Carga multiple de imagenes y videos por drag and drop
- Persistencia real de medios en disco desde un servidor local
- Estado compartido entre equipos via REST + WebSocket
- Cache local de blobs en IndexedDB por navegador
- Reconstruccion de object URLs desde cache local o descarga remota
- Reordenamiento manual de playlist con drag and drop nativo
- Eliminacion de items
- Seleccion de item con preview y metadatos
- Controles Play, Pausa, Siguiente, Anterior y Finalizar
- Orientacion global real para el player
- Estado idle en `/player` hasta recibir Play
- Avance automatico: timeout para imagenes y `ended` para videos
- Sincronizacion entre equipos usando WebSocket

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
- El player no empieza a reproducir hasta que el estado cambia a `playing` desde administracion.
- La carpeta `local-data/` contiene el estado persistido del servidor y los archivos subidos.
- Para usarlo entre equipos, ambos PCs deben poder llegar por red al host donde corre `pnpm dev`.
