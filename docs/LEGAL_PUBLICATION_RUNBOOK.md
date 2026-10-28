# Runbook — publicación legal e integración PL-016

Procedimiento preparado; no ejecutado. Requiere aprobación jurídica y autorización explícita por operación. No hay releases ni INSERT para ejecutar ahora. La primera versión real será `v1.0` únicamente después de su aprobación; no se crea ni se reserva mediante un registro ficticio.

Fuente del backend: `PL-016-WEB-INTEGRATION-CONTRACT.md` (main 38b6b73). Fuente canónica: rlvo-web. Reglas técnicas: `LEGAL_VERSIONING.md`.

## 1. Preparar una versión aprobada

El responsable jurídico aprueba el texto íntegro y fecha de actualización; resolver sus marcadores requiere una tarea editorial autorizada. Registrar la aprobación en la revisión de publicación. Definir el par `(tipo, version)` y `vigente_desde` con zona explícita. Verificar PK y UNIQUE contra el catálogo mediante el responsable autorizado, sin asumir que el manifiesto web es el estado de Supabase. Consultar si existen activaciones futuras: la web no puede detectarlas sola.

El tipo es `terminos` o `aviso_privacidad`. Sus páginas son respectivamente `/terminos/{version}` y `/privacidad/{version}`. La versión cumple el CHECK de 1–40 caracteres y coincide exactamente con el segmento, sin quitar la `v` ni cambiar mayúsculas. Nunca reutilizar `staging-prueba` o un identificador histórico. Una corrección posterior usa otro identificador.

Crear `src/content/legal/releases/{terminos|privacidad}/{version}/document.md` desde el material aprobado ya normalizado. No cambiar versiones anteriores. Verificar estrictamente sus bytes, calcular SHA-256 y tamaño, añadir la fila a `legal/registry.json` y **solo las nuevas entradas** al lock: huella de archivo y huella determinista de metadata. `recordDigest` en `src/legal/registry.ts` calcula la segunda; no es el hash para Supabase. Revisar el diff contra el baseline protegido. No se proporciona un comando que regenere todo el lock.

`vigente_desde` forma parte de metadata inmutable; acordarlo antes de congelar el registro. Los punteros pueden seguir en la versión anterior/null durante la publicación de la nueva URL. No apuntar a una fecha futura. Pasar check, tests, build y CI protegido. La aprobación técnica no reemplaza la jurídica.

## 2. Publicar primero la URL inmutable y el Markdown

Solicitar por separado autorización para commit y deploy. Publicar solo el artefacto validado, conservando todas las versiones anteriores. Verificar desde el dominio público exacto:

- Página versionada: 200, URL y canonical exactos, texto aprobado visible, sin marcadores, descarga enlazada, versión identificada, navegación y móvil accesibles.
- Markdown y checksum: 200 sin redirecciones, bytes exactos y SHA-256 igual al registro. Comprobar MIME, charset y headers noindex de Cloudflare; no asumir que Astro preview los aplicó.
- Manifiesto: identifica tipo, versión, URL y digest correctos; ninguna edición involuntaria de releases anteriores.
- Versiones inexistentes: 404 real, sin fallback SPA. Revisar rutas generales y punteros sin alterar históricos.

Ejemplo reproducible con variables proporcionadas por el operador, no valores inventados. Ejecutar en rlvo-web; se descarga a un directorio temporal, nunca encima del canónico:

```sh
# Definir tipo, version y URL_MD con el release aprobado del manifiesto.
# tipo será terminos o aviso_privacidad; URL_MD es canonical_url exacta.
revision_dir="$(mktemp -d)"
estado_http="$(curl --fail --silent --show-error --proto '=https' --max-redirs 0 \
  --write-out '%{http_code}' --output "$revision_dir/document.md" "$URL_MD")"
if [ "$estado_http" != 200 ]; then
  printf '%s\n' 'Bloqueado: la URL canónica no respondió 200.'
  exit 1
fi
npm run compare:legal -- "$tipo" "$version" "$revision_dir/document.md"
```

El comando bloquea una descarga con bytes distintos, HTML de error o contenido no canónico aunque pudiera normalizarse. Un HTTP 3xx requiere investigación; no aprobar una URL que dependa de redirección. Conservar código/headers y el digest de la verificación como evidencia. La comprobación explícita de estado bloquea también 3xx, que `curl --fail` por sí solo no rechaza; la comparación posterior impide aprobar un cuerpo distinto. Nunca extraer el hash del HTML renderizado.

## 3. Archivar y comparar en el repositorio móvil

Tras verificar lo publicado, el responsable del repositorio móvil copiará los bytes canónicos, sin editor, formateador, conversión CRLF ni BOM, a `docs/legal/versiones/<version>/terminos.md` y/o `privacidad.md`. Conservar su `.gitattributes` de archivo binario/sin conversión y `SHA256SUMS`. No tocar el directorio `staging-prueba`.

Desde rlvo-web ejecutar para cada copia independiente:

```sh
npm run compare:legal -- "$tipo" "$version" "$archivo_archivado"
shasum -a 256 "$archivo_archivado"
```

`compare:legal` selecciona un release real por tipo/versión, toma el digest del registro y exige igualdad byte por byte entre su fuente y la copia archivada, además de normalización estricta y SHA-256. Falla si no hay release, si se compara el archivo consigo mismo, si el digest difiere o si se cambian finales de línea. No escribe ni copia nada, ni conecta con Supabase. El mismo comando sobre el Markdown descargado en el paso anterior une las tres evidencias: fuente, descarga pública y archivo móvil.

**Bloquear el INSERT ante cualquier discrepancia.** No «arreglar» el hash del registro, normalizar la copia a escondidas o cambiar la fuente publicada para hacerlas coincidir. Investigar el origen. Si el documento aprobado debe cambiar, crear otra versión; si es una copia dañada, repetir el archivo desde la fuente intacta y repetir todas las verificaciones. Revisar en el repo móvil los checks propios de su archivo, por su responsable.

## 4. Autorizar el INSERT, por separado y al final

Solo una vez verificadas URL, canónico, manifiesto y copia archivada, solicitar autorización explícita para el alta. El responsable de Supabase prepara y revisa el INSERT con las columnas reales `tipo, version, vigente_desde, url, contenido_sha256`; `created_at` queda a su default. No usar una service role key en esta web ni cambiar grants/RLS para `anon`.

El valor SQL del hash será `decode('<hex verificado de 64 caracteres>', 'hex')`; PostgREST usa `\x<hex>`, convertido al mismo digest de 32 bytes. Revisar la PK, UNIQUE por instante y el catálogo vigente en la misma transacción de preparación/alta. No se incluye SQL relleno, credenciales, hashes ficticios ni una activación automatizada en este repositorio.

Si se activan ambos documentos, coordinar una transacción que publique las dos filas para evitar estados parciales y confirmar previamente que ambas URLs responden. El backend elige por tipo la fila con mayor `vigente_desde <= now()` (reloj del servidor). Un INSERT con fecha pasada/presente puede activar inmediatamente; uno futuro se activará por el paso del tiempo, sin otra autorización o comando posterior. Insertar una fecha pasada tampoco garantiza reemplazar una fila con fecha mayor. No hay columna `activa` ni mecanismo de desactivación.

Elegir preferentemente una ventana supervisada, sin activación programada hasta contar con operación y sincronización de punteros adecuadas. No fijar un instante conjetural en código. Confirmar la hora efectiva y el estado real con el equipo backend.

## 5. Coordinar los punteros y comprobar el efecto

Tras la activación autorizada, actualizar explícitamente los punteros web para que los alias muestren la versión vigente; su publicación requiere su propia autorización. Comprobar `/terminos`, `/privacidad`, manifiesto y URLs permanentes. La actualización del alias no cambia bytes ni rutas históricas. Coordinar esta ventana porque Supabase y el sitio estático no cambian de forma atómica. El manifiesto expresa el estado web, no certifica el estado del catálogo.

Efectos del backend que deben comunicarse antes del alta:

- Las evidencias anteriores se conservan por `(user_id, tipo, version)`, pero no satisfacen el candado de la nueva versión vigente. Las acciones protegidas pueden quedar bloqueadas hasta completar el flujo de nuevo.
- `aceptar_terminos` exige las **dos versiones vigentes** y registra atómicamente términos `aceptado` y aviso `presentado`. Presentar el aviso no significa aceptar tratamientos. Si solo cambia un tipo, la fila ya existente del otro se conserva por `ON CONFLICT DO NOTHING`; no se cambia su hora.
- Si falta una versión vigente de cualquiera de los tipos, la app no puede completar la aceptación y las acciones protegidas fallan cerradas. El estado móvil puede quedar desactualizado porque hoy se recarga al cambiar de usuario; el backend rechaza igualmente. Validar el flujo de recarga por el equipo móvil, sin modificarlo desde este repo.
- `estado_terminos` no devuelve hashes; la app no verifica SHA-256. El backend solo comprueba longitud de 32 bytes: estas verificaciones operativas son necesarias.
- UPDATE y TRUNCATE están prohibidos por triggers. DELETE no tiene prohibición absoluta: la FK lo impide cuando hay evidencia, pero sin ella puede borrarse. La política de publicación prohíbe borrar aun entonces.

Si algo falla, detener nuevas operaciones y escalar. No editar/borrar una fila histórica, reutilizar versión o ejecutar un rollback que retire URLs ya publicadas. Corregir mediante otra versión aprobada y una nueva autorización; mantener todos los históricos disponibles. Retirar una publicación nueva con un rollback de sitio también puede romper sus URLs, aunque su fila aún no esté activa: revisar el conjunto completo de releases antes de cualquier rollback.

## 6. Cerrar evidencia operativa

Guardar aprobación jurídica/técnica, commit y artefacto desplegado, comprobaciones de URL/canónico/copia archivada, SHA-256, instante, aprobación del INSERT y resultado verificado por el responsable backend. Avanzar el baseline protegido únicamente después de la revisión autorizada y mantener backups y checks periódicos de disponibilidad/bytes. No depender solo del último commit de un PR.

Pendientes externos: configurar CI/checks y referencia protegida; seleccionar responsables/ventana; autorizar publicaciones; validar los 23 marcadores, Analytics y decisiones de PL-008/PL-009. Ningún paso de este runbook se ha ejecutado contra servicios remotos.
