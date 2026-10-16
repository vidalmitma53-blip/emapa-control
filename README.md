# EMAPA — despliegue Netlify + Render

La aplicación conserva la interfaz actual y separa la publicación en dos servicios: Netlify compila y publica el frontend estático; Render ejecuta el API en Python con SQLite. Las ubicaciones y el catálogo se vuelven a sembrar al iniciar Render. Las existencias se empiezan sin saldo ficticio; el mapa muestra «Sin registro» hasta recibir movimientos reales.

## Orden de publicación

1. Sube el proyecto a un repositorio Git privado/público según las políticas de tu institución. No subas `.env`, archivos SQLite, contraseñas ni datos reales.
2. Crea el sitio Netlify desde el repositorio, usando el `netlify.toml` incluido. Si la URL Render todavía no está configurada, el primer deploy será solo la interfaz. Copia el dominio Netlify que te asignaron.
3. En Render, crea un **Blueprint** desde el mismo repositorio y selecciona `render.yaml`. En el Web Service, define `EMAPA_CORS_ORIGINS` con el origen Netlify exacto (ej. `https://mi-sitio.netlify.app`), `EMAPA_ADMIN_USERNAME` y `EMAPA_ADMIN_PASSWORD` (12+ caracteres). Para los cinco almaceneros configura `EMAPA_WAREHOUSE_USERNAME`/`EMAPA_WAREHOUSE_PASSWORD` y los pares `_2_` a `_5_`. Opcionalmente configura `EMAPA_AUDITOR_USERNAME`/`EMAPA_AUDITOR_PASSWORD`. El servidor crea esas cuentas iniciales si no existen.
4. Despliega Render y comprueba `https://<servicio>.onrender.com/health`; debe responder `{"status":"ok"}`. Copia la URL raíz final del servicio.
5. En Netlify, configura `EMAPA_API_BASE_URL` con la URL raíz HTTPS de Render, sin barra final, y vuelve a desplegar. Desde entonces el frontend consulta ese backend.

El backend lee el puerto dinámico `PORT`, escucha en `0.0.0.0`, publica CORS solo para el origen configurado y usa cookies seguras `HttpOnly`. La sesión cross-site para Netlify/Render activa `SameSite=None; Secure`. Las cuentas locales y la base SQLite de tu computadora **no se copian automáticamente** al servicio Render: crea las cuentas allí con sus secretos y contraseñas fuertes. No uses la contraseña común `12345678` en un servicio público.

## Configuración frontend Netlify

`netlify.toml` fija `python3 build.py` como build command y `dist` como carpeta publicada. En **Site configuration → Environment variables**, `EMAPA_API_BASE_URL` recibe la URL pública de Render (no es un secreto). `build.py` genera `dist/emapa-config.js` con esa URL. No edites el código para cambiar de entorno. Si se cambia el dominio Netlify, actualiza también `EMAPA_CORS_ORIGINS` en Render y redespliega ambos.

El cliente consulta catálogo y sucursales al backend, inicia sesión, registra movimientos y abre el flujo de eventos en vivo. La sincronización usa credenciales incluidas y el backend valida origen y rol. Netlify usa HTTPS automáticamente.

## Salidas y control de compras

Una salida requiere nombre completo y CI del comprador. El servidor aplica, inicialmente, máximo 10 unidades del mismo producto por CI/día y máximo 5 tipos de producto distintos por CI/día, sumando todas las sucursales. Los dos topes se comprueban dentro de la transacción, además del stock del lote, y se pueden ajustar con `EMAPA_SALE_LIMIT_PER_PRODUCT` y `EMAPA_SALE_MAX_PRODUCTS_PER_DAY`. El movimiento registra comprador, operador, lote y saldo anterior/resultante. Los ingresos no piden datos del comprador.

Nombre y CI están solo en el kardex protegido; el API público del mapa no los devuelve. El CI aparece enmascarado para almaceneros y completo solo para supervisores/auditores. Antes de usar datos reales, EMAPA debe aprobar base legal, aviso al comprador, acceso según funciones y un plazo de retención/eliminación. Los límites reducen compras por CI, pero no eliminan por sí solos la reventa ni sustituyen controles institucionales.

## Salidas y prevención de reventa

Toda salida exige nombre del comprador y CI; ambos se guardan en la bitácora interna de kardex y nunca se incluyen en el endpoint público del mapa. Como política inicial configurable, cada CI puede retirar hasta 10 unidades del mismo producto al día y hasta 5 tipos de producto distintos al día, sumando todas las sucursales. El servidor vuelve a comprobar los topes dentro de la transacción para impedir que se evadan modificando el navegador. `EMAPA_SALE_LIMIT_PER_PRODUCT` y `EMAPA_SALE_MAX_PRODUCTS_PER_DAY` ajustan esos topes a la normativa y política comercial que apruebe EMAPA.

El CI es dato personal: el kardex muestra el documento completo solo a supervisores y auditores; para almaceneros lo enmascara. Antes de operación institucional, la entidad debe validar base legal, aviso al comprador, perfiles autorizados, periodo de retención y eliminación segura. Los límites son controles operativos de apoyo y no sustituyen verificación de identidad ni revisión normativa.

## SQLite en el plan gratuito

El `render.yaml` guarda SQLite en `/tmp/emapa.sqlite3`, que es **efímero**. Se puede reiniciar o borrar con redeploy, reinicio o ciclo del servicio; las cuentas sembradas desde variables vuelven a crearse, pero los movimientos y saldos se pierden. En Render gratuito el servicio también puede dormir, por lo que la primera petición demora. Es aceptable solo para evaluación y datos de prueba.

Para inventario institucional, configura disco persistente/una base administrada (preferiblemente PostgreSQL), backups y restauración probada, dominio y política de sesión de mismo sitio, gestión segura de cuentas, monitoreo y revisión de ciberseguridad/jurídica. Algunos navegadores bloquean cookies de terceros incluso con `SameSite=None`; para uso real, despliega frontend y API bajo el mismo dominio registrable (o un proxy de mismo origen), y prueba login y SSE en los navegadores objetivo.

## Desarrollo local

Usa Python 3.10 o superior y ejecuta `python server.py`; luego abre `http://127.0.0.1:8000`. Para probar el build estático de Netlify ejecuta `python build.py`; genera `dist/`. Configura las credenciales de prueba en `.env` (ignorado por Git). Ejecuta las pruebas con `python -m unittest discover -s tests -v`.
