# PL-016 · Contrato de integración con rlvo-web

Documento para el equipo (o agente) que trabaja en el repositorio del sitio
`rlvo-web`. Describe cómo el backend de RLVO (Supabase, este repo) modela los
documentos legales versionados y las aceptaciones, y qué necesita del sitio.

Fecha: 2026-10-27. Fuente: el código y las migraciones de este repo en `main`
(`38b6b73`). No se consultó ninguna base remota para escribirlo.

**Cómo leer este documento.** Cada afirmación lleva una de estas marcas:

- **[CONFIRMADO]**: está en el código o en una migración de este repo, con la
  cita `archivo:línea`.
- **[DOCUMENTADO, SIN ENFORCEMENT]**: está escrito en un documento del repo
  como regla o intención, pero ningún código lo hace cumplir.
- **[PENDIENTE / ABIERTO]**: no está decidido. Lo que aparezca como ejemplo es
  ilustrativo, no un contrato.

Archivos fuente principales:

| Archivo | Qué es |
|---|---|
| `supabase/migrations/20261026000490_aceptacion_terminos.sql` | La migración de PL-016 (tablas, funciones, policies, triggers) |
| `src/lib/terminos.ts` | El cliente móvil: lee el estado y registra la aceptación |
| `docs/legal/versiones/staging-prueba/` | Archivo de la versión de prueba de STAGING (HTML, hashes, insert) |
| `docs/legal/versiones/.gitattributes` | `* -text`: Git no toca los bytes del archivo legal |
| `scripts/pl016-activar.sh` | Script que aplicó la migración y cargó las versiones en STAGING |
| `supabase/seeds-local/terminos.sql` | Versiones falsas para el stack local |
| `docs/pl-016-plan.md` | Plan y decisiones (V1 = versionado por URL fija + hash) |

---

## 1. Esquema (DDL)

Las dos tablas nacen en `20261026000490_aceptacion_terminos.sql`, la última
migración comiteada en `main`. Ninguna migración posterior las modifica: las
dos que existen sin comitear al escribir esto (`20261027000491` y `…492`, de
otra tarea en curso) no mencionan ninguna tabla ni función de PL-016 (`grep`).
**[CONFIRMADO]**

### 1.1 `public.documentos_legales` — `…490:46-64`

```sql
create table public.documentos_legales (
  tipo             text not null,
  version          text not null,
  vigente_desde    timestamptz not null,
  url              text not null,
  contenido_sha256 bytea not null,
  created_at       timestamptz not null default now(),
  primary key (tipo, version),
  constraint documentos_legales_tipo_check
    check (tipo in ('terminos', 'aviso_privacidad')),
  constraint documentos_legales_version_check
    check (version ~ '^[a-z0-9][a-z0-9.-]{0,39}$'),
  constraint documentos_legales_url_check
    check (url ~ '^https://[^[:space:]]+$'),
  constraint documentos_legales_sha256_check
    check (octet_length(contenido_sha256) = 32),
  constraint documentos_legales_tipo_vigente_desde_key
    unique (tipo, vigente_desde)
);
```

| Columna | Tipo | Nulo | Default | Restricción |
|---|---|---|---|---|
| `tipo` | text | no | — | `'terminos'` o `'aviso_privacidad'` (CHECK, no es enum de Postgres) |
| `version` | text | no | — | 1 a 40 caracteres, `^[a-z0-9][a-z0-9.-]{0,39}$`: minúsculas, dígitos, `.` y `-`, empieza por letra o dígito |
| `vigente_desde` | timestamptz | no | — | único por `tipo` |
| `url` | text | no | — | `^https://` sin espacios. No se valida dominio ni ruta |
| `contenido_sha256` | bytea | no | — | exactamente 32 bytes (el digest crudo, no el hex) |
| `created_at` | timestamptz | no | `now()` | — |

- **PK** `(tipo, version)`. **UNIQUE** `(tipo, vigente_desde)`. No hay más
  índices que los que crean la PK y el UNIQUE. **[CONFIRMADO]**
- **Enums:** ninguno. `tipo` es `text` con CHECK. **[CONFIRMADO]**
- **RLS** activo; una policy `documentos_legales_select` `for select to
  authenticated using (true)` (`:66-70`). **[CONFIRMADO]**
- **Grants:** `revoke all … from anon, authenticated` y después solo `grant
  select … to authenticated` (`:76-77`). **`anon` no puede leer el catálogo**:
  con la publishable key y sin sesión, PostgREST no devuelve nada. Las altas
  solo las puede hacer `service_role`/Studio. **[CONFIRMADO]**
- **Inmutable** (`:84-102`): los triggers `documentos_legales_inmutable`
  (BEFORE UPDATE, por fila) y `documentos_legales_sin_truncate` (BEFORE
  TRUNCATE) llaman a `private.documento_legal_inmutable()`, que lanza
  `55000 documento_legal_inmutable` **para todos los roles**, incluido
  `service_role`. DELETE no tiene trigger; lo frena la FK de la sección 1.2 en
  cuanto existe una aceptación. **[CONFIRMADO]**

### 1.2 `public.aceptaciones_legales` — `…490:116-137`

```sql
create table public.aceptaciones_legales (
  user_id     uuid not null references public.users(id) on delete cascade,
  tipo        text not null,
  version     text not null,
  accion      text not null,
  aceptado_at timestamptz not null default now(),
  primary key (user_id, tipo, version),
  constraint aceptaciones_legales_documento_fkey
    foreign key (tipo, version) references public.documentos_legales (tipo, version),
  constraint aceptaciones_legales_accion_check
    check ((tipo = 'terminos' and accion = 'aceptado')
        or (tipo = 'aviso_privacidad' and accion = 'presentado'))
);
```

- **PK** `(user_id, tipo, version)`: una fila por usuario, documento y versión.
- **FK** `user_id → public.users(id)` **on delete cascade**: la evidencia se
  borra con la cuenta (decisión P4, pendiente de validación legal en PL-009).
- **FK** `(tipo, version) → documentos_legales` **sin cascade** (`NO ACTION`):
  impide borrar una versión que alguien aceptó.
- **CHECK** `accion`: los Términos se **aceptan** (`'aceptado'`) y el Aviso de
  privacidad se **presenta** (`'presentado'`). Presentar el Aviso no es un
  consentimiento a ningún tratamiento de datos (`…490:8-10`).
- `aceptado_at` la pone el servidor (`default now()`); el cliente no escribe
  en la tabla.
- **RLS:** una policy `aceptaciones_legales_select_own`, `user_id =
  auth.uid()`. **Grants:** solo `select` a `authenticated`. Nadie escribe
  directo; solo `public.aceptar_terminos()`. **[CONFIRMADO]**

### 1.3 `public.users` (solo lo que el contrato toca)

`aceptaciones_legales.user_id` apunta a `public.users.id`, que es igual a
`auth.users.id` (§3 de `CLAUDE.md`). No hay ninguna columna legal en `users`.
**[CONFIRMADO]**

---

## 2. Funciones, RPC y consultas

### 2.1 Regla de vigencia — `private.version_vigente(p_tipo text) returns text` (`…490:146-161`)

```sql
select d.version
  from public.documentos_legales d
 where d.tipo = p_tipo
   and d.vigente_desde <= now()
 order by d.vigente_desde desc
 limit 1;
```

- La versión vigente de un tipo es **la de `vigente_desde` más reciente que ya
  empezó** (`<= now()`, hora del servidor). **[CONFIRMADO]**
- Una fila con `vigente_desde` en el futuro existe pero **no es vigente**
  hasta esa hora; ese momento la vuelve vigente sin ningún otro paso. Así se
  puede programar una activación. **[CONFIRMADO por la consulta; ningún flujo
  del repo la usa todavía]**
- **Sin fila que cumpla, devuelve NULL.** No hay columna `activa`: no se puede
  "desactivar" una versión, solo sustituirla con una más reciente o borrarla
  (si nadie la aceptó). **[CONFIRMADO]**
- Es `private`, no se llama desde el cliente.

### 2.2 `public.estado_terminos()` — lectura (`…490:238-267`)

```
returns table (tipo text, version text, vigente_desde timestamptz,
               url text, aceptado boolean, acepto_alguna boolean)
```

- SECURITY INVOKER, `stable`, sin parámetros. EXECUTE solo para
  `authenticated` (anon no).
- Devuelve **una fila por tipo que tenga versión vigente**: `version`,
  `vigente_desde`, `url`, `aceptado` (la sesión tiene fila para ESA versión) y
  `acepto_alguna` (la sesión tiene fila para alguna versión de ese tipo).
- **No devuelve `contenido_sha256`.**
- **Sin versión vigente, ese tipo no aparece.** Con el catálogo vacío devuelve
  0 filas. **[CONFIRMADO]**
- Llamada del cliente: `supabase.rpc('estado_terminos')`
  (`src/lib/terminos.ts:41`). Si falta cualquiera de los dos tipos, el cliente
  lo trata como "no se puede aceptar todavía" (`terminos.ts:44-47`).

### 2.3 `public.aceptar_terminos(p_version_terminos text, p_version_aviso text) returns void` (`…490:204-229`)

- SECURITY DEFINER, `search_path = ''`. EXECUTE solo para `authenticated`.
- Quién acepta: `auth.uid()`. Sin sesión → `42501 no_autenticado`.
- Las dos versiones recibidas tienen que ser **exactamente** las vigentes de
  cada tipo (`is distinct from version_vigente(...)`). Si no (versión vieja,
  inventada, o no hay vigente: NULL nunca coincide) → **`22023
  version_no_vigente`**.
- Inserta dos filas en una sola sentencia: `('terminos', vT, 'aceptado')` y
  `('aviso_privacidad', vA, 'presentado')`, con `on conflict (user_id, tipo,
  version) do nothing`. **Idempotente**: repetirla no cambia `aceptado_at`.
- El cliente solo manda **qué versiones vio**; la hora y la identidad las pone
  el servidor. **No recibe ni verifica ningún hash ni URL.**
- Llamada del cliente (`terminos.ts:78-84`):
  ```ts
  supabase.rpc('aceptar_terminos', {
    p_version_terminos: estado.terminos.version,
    p_version_aviso: estado.aviso.version,
  })
  ```
- Errores que la app reconoce: `esVersionNoVigente` (`22023` +
  `version_no_vigente`, `terminos.ts:101-104`). **[CONFIRMADO]**

### 2.4 `private.terminos_vigentes_aceptados() returns boolean` (`…490:174-189`)

`true` solo si `auth.uid()` tiene fila para la versión vigente de **los dos**
tipos. Sin versión vigente de alguno → `false` (falla cerrado). Es el candado
que la base aplica en 9 policies de escritura, en dos triggers
(`listings_exige_terminos`, `users_exige_terminos`, que lanzan `42501
terminos_no_aceptados`) y en `seller_whatsapp` (`…490:279-461`). El sitio web
no lo invoca, pero define el efecto de publicar una versión nueva (sección 6).
**[CONFIRMADO]**

### 2.5 Consulta directa al catálogo

Con sesión (`authenticated`) se puede hacer `select * from
documentos_legales` por PostgREST; trae TODAS las versiones, vigentes o no.
`contenido_sha256` (bytea) viaja por PostgREST como texto `"\x<64 hex>"`
(es la forma que usa `scripts/_terminos-prueba.mjs:23` para escribirlo). La app
móvil no usa esta consulta. **[CONFIRMADO para el formato de escritura; la app
no lee el hash]**

### 2.6 Comportamiento sin versión vigente — resumen

| Pieza | Sin versión vigente de algún tipo |
|---|---|
| `version_vigente(tipo)` | NULL |
| `estado_terminos()` | ese tipo no aparece |
| `aceptar_terminos()` | `22023 version_no_vigente` |
| `terminos_vigentes_aceptados()` | false para todos |
| Acciones protegidas (publicar, contactar, calificar, fotos…) | rechazadas para todos |
| App móvil | entra normal (no muestra la puerta), y la base rechaza esas acciones (`docs/pl-016-plan.md`, "Si el estado no se puede leer o no hay versión vigente, se entra") |

**[CONFIRMADO]**

---

## 3. Contrato de hashes

### 3.1 Dónde se calcula y dónde se verifica hoy

| Lugar | Qué hace | Cita |
|---|---|---|
| Base | Solo exige que `contenido_sha256` tenga 32 bytes. **No calcula ni verifica nada contra la URL.** | `…490:60-61` |
| App móvil | No lee ni verifica el hash. Abre `url` en el navegador. | `src/lib/terminos.ts` (no hay `sha`) |
| `scripts/pl016-activar.sh` | Antes del push, comprueba `shasum -a 256 -c SHA256SUMS` sobre los HTML archivados y que esos hashes estén en el insert. | `:107-113` |
| `insert-staging.sql` | Dentro de la transacción, comprueba que lo guardado coincide con los hashes literales. | `:27-40` |
| Seeds locales y suite | `sha256('<texto>')` en SQL sobre literales de prueba. | `seeds-local/terminos.sql:26-28`, `rls.sql:230-231` |

**Ningún proceso vuelve a descargar la URL para compararla con el hash.**
La verificación es manual y fuera de línea, contra el archivo de
`docs/legal/versiones/`. **[CONFIRMADO]**

### 3.2 STAGING hoy (versión `staging-prueba`) — **[CONFIRMADO]**

- **Entrada del hash:** los **bytes exactos del HTML servido** por
  `https://www.rlvo.com.mx/terminos` y `/privacidad`, descargados el
  2026-10-27 con `curl -s` (`staging-prueba/LEEME.md:18-24`). Sin
  normalización: ni Unicode, ni fines de línea, ni espacios.
- Codificación de los archivos: UTF-8 (`file` lo confirma). `.gitattributes`
  `* -text` impide que Git convierta fines de línea.
- Algoritmo: SHA-256, guardado como el digest crudo de 32 bytes
  (`decode('<hex>', 'hex')`, `insert-staging.sql:22-25`).
- Valores (`SHA256SUMS`):

  | tipo | url | bytes | sha256 |
  |---|---|---|---|
  | `terminos` | `https://www.rlvo.com.mx/terminos` | 17057 | `a54344e6b97361575fecb341ccf3a895bfceac04e51dc603c7ba2df4a39e94e8` |
  | `aviso_privacidad` | `https://www.rlvo.com.mx/privacidad` | 21318 | `dfbb3742a5840e658946037df021bb3d0f291fe01e6f6aa5f02845d03a9b078f` |

- **Es una excepción explícita** a la decisión V1, válida solo para
  `staging-prueba` (`LEEME.md:43-45`): los documentos son borradores sin texto
  canónico. Esos hashes ya **no** coinciden con lo que sirva hoy la URL si la
  página cambió después del 2026-10-27 (la URL no es versionada).

### 3.3 PROD — lo decidido y lo que falta

- **Decidido (V1, `docs/pl-016-plan.md:56-68`; comentario en `…490:43-45`):**
  `contenido_sha256` es el sha256 del **texto canónico** de la versión (el
  documento aprobado), **no del HTML servido**, para que un cambio de plantilla
  no cambie el documento. El texto canónico se archiva en
  `docs/legal/versiones/<version>/` de este repo. **[DOCUMENTADO, SIN
  ENFORCEMENT]**: la base solo verifica la longitud.
- **Regla de normalización propuesta** (`staging-prueba/LEEME.md:49-53`):
  archivo UTF-8, **NFC**, fines de línea **LF**, **un salto de línea final**,
  y el sha256 se calcula sobre los bytes de ESE archivo. Opcionalmente se
  archiva también el HTML publicado con su propio hash como evidencia de lo
  servido. **[DOCUMENTADO como paso para PROD; no hay script que lo aplique ni
  lo valide]**
- **No definido** [PENDIENTE / ABIERTO]:
  - el **formato** del texto canónico (texto plano, Markdown, HTML mínimo…);
  - si hay espacios al final de línea o líneas en blanco finales permitidas;
  - si se quita o no un BOM (la regla dice UTF-8, no dice "sin BOM");
  - si el sitio publica el texto canónico tal cual o lo renderiza (y, por
    tanto, si alguien puede recalcular el hash a partir de la página);
  - quién calcula el hash (este repo, rlvo-web o ambos) y quién gana si
    discrepan.

---

## 4. Vectores de prueba

Todos son no sensibles. Reproducción con herramientas estándar de macOS/Linux.

### 4.1 Vector A — el que ya usa este repo (local) **[CONFIRMADO]**

Es el hash de las versiones `local-prueba` (`seeds-local/terminos.sql:26-28`
en SQL y `scripts/_terminos-prueba.mjs:22-23` en Node, que coinciden).

- Contenido: `local-prueba` (12 bytes ASCII, **sin** salto final)
- Hex: `6c6f63616c2d707275656261`
- SHA-256: `27df2ac49d1fae51bc8cbf0d88f5354176b5290a5a5907d11ca8d2fd2fcf33b5`

```sh
printf 'local-prueba' | shasum -a 256
printf 'local-prueba' | openssl dgst -sha256 -hex
node -e "console.log(require('crypto').createHash('sha256').update('local-prueba').digest('hex'))"
```

En SQL se guarda como `sha256('local-prueba')` o
`decode('27df…33b5', 'hex')`. **Ojo:** `sha256('…')` en SQL convierte el
literal a `bytea` con la sintaxis de escape de `bytea`, así que un texto con
`\` no da los bytes que parece. Para documentos reales, insertar siempre
`decode('<hex>', 'hex')` calculado fuera.

### 4.2 Vector B — STAGING real (`staging-prueba`) **[CONFIRMADO]**

Los archivos están en este repo; no se reproducen aquí por tamaño.

```sh
cd docs/legal/versiones/staging-prueba
shasum -a 256 -c SHA256SUMS   # terminos.html: OK, privacidad.html: OK
```

Sirve para comprobar que rlvo-web hashea "bytes servidos" igual que este repo,
**no** para el contrato futuro (el contenido es un borrador y la URL ya no está
congelada).

### 4.3 Vector C — ilustrativo de la regla PROPUESTA para PROD **[PENDIENTE / ABIERTO]**

**No es un contrato.** Solo muestra qué daría la regla de `LEEME.md:49-53`
(UTF-8, NFC, LF, un salto final) sobre un texto con acentos, y cuánto cambia el
hash si se rompe cada condición. Sirve para que ambos repos comprueben que
hashean los mismos bytes cuando la regla se apruebe.

- Contenido (2 líneas, cada una terminada en LF):
  ```
  Términos de uso
  Versión de prueba
  ```
- 36 bytes. Hex (UTF-8, NFC):
  `54c3a9726d696e6f732064652075736f0a5665727369c3b36e206465207072756562610a`
- SHA-256 esperado:
  `dcba0f0dea38bbc87ee70d825dc8966f16c232e64d8ce8c846f799ab76e006fb`

```sh
printf 'T\xc3\xa9rminos de uso\nVersi\xc3\xb3n de prueba\n' | shasum -a 256
# o, desde el hex:
echo 54c3a9726d696e6f732064652075736f0a5665727369c3b36e206465207072756562610a | xxd -r -p | shasum -a 256
```

Variantes que **deben dar un hash distinto** (controles negativos):

| Variante | SHA-256 |
|---|---|
| Mismo texto en **NFD** (38 bytes) | `424b86a79959b6c7d9a48d2d3568cca86516940fd5670fc148129efbbee35169` |
| Fines de línea **CRLF** | `54bc521fd916ecdb4b227423f2c62873314028530587fd4691252efc783989b7` |
| **Sin** el salto final | `a56c3ca3e975a1f7267a64a9fbd4c1e6eeccf91b5cc9f1184b88b90f6cb0eec1` |

---

## 5. Relación URL ↔ documento ↔ versión ↔ hash ↔ aceptación

```
documentos_legales (tipo, version)  ──PK──┐
   ├─ url               → la página que se le abre al usuario
   ├─ contenido_sha256  → sha256 del documento (sección 3)
   └─ vigente_desde     → cuándo rige
                                          │ FK sin cascade
aceptaciones_legales (user_id, tipo, version, accion, aceptado_at)
```

- **Identificador del documento:** el par `(tipo, version)`. No hay id
  numérico. La URL y el hash **no** son clave; dos versiones podrían tener la
  misma URL (`local-prueba` y `staging-prueba` apuntan las dos a
  `https://www.rlvo.com.mx/terminos`) y la base lo permite. **[CONFIRMADO]**
- **Qué guarda una aceptación:** solo `(user_id, tipo, version, accion,
  aceptado_at)`. **No guarda la URL ni el hash**: se obtienen por la FK.
  Como la fila de `documentos_legales` no se puede editar, la URL y el hash
  asociados a una aceptación son estables. **[CONFIRMADO]**
- **Qué abre la app:** la `url` que devuelve `estado_terminos()` para la
  versión vigente, en la pantalla "Términos actualizados"
  (`src/app/terminos-actualizados.tsx:159-160`) y en Completar perfil
  (`completar-perfil.tsx:394-395`, con `URL_TERMINOS`/`URL_PRIVACIDAD` como
  respaldo si el estado no cargó). Otras pantallas (Verificación,
  Configuración) abren las constantes fijas `https://www.rlvo.com.mx/terminos`
  y `/privacidad` (`src/lib/configuracion.ts:37-38`), no la URL versionada.
  **[CONFIRMADO]**
- **Lo que hace falta del sitio (V1, `docs/pl-016-plan.md:56-61`):** cada
  versión en **una URL que no cambia nunca** (ejemplo del plan:
  `/terminos/2026-10-v1`), y `/terminos` llevando a la vigente. Medido el
  2026-10-27 en ese plan: `/terminos/v1` y `/privacidad/2026-10-01` daban 404,
  o sea que **hoy no existen URLs versionadas**. El esquema de rutas no está
  definido: la condición 2 de la aprobación de PL-016 pide proponerlo antes de
  implementarlo (`LEEME.md:54-57`). **[PENDIENTE / ABIERTO]**
- Hoy en STAGING, las filas `staging-prueba` apuntan a `/terminos` y
  `/privacidad` (no versionadas). Una aceptación de STAGING apunta, por tanto,
  a una página que puede mostrar otro texto. Aceptado solo para pruebas.

---

## 6. Inmutabilidad, activación y sustitución

| Regla | Estado | Dónde |
|---|---|---|
| Una versión no se edita (ningún rol) | **Implementado** | trigger `documentos_legales_inmutable`, `…490:84-98` |
| La tabla no se trunca | **Implementado** | trigger `documentos_legales_sin_truncate`, `…490:100-102` |
| No se borra una versión que alguien aceptó | **Implementado** | FK sin cascade, `…490:123-124` |
| Se puede borrar un borrador que nadie aceptó | **Implementado** (por ausencia de trigger de DELETE) | `…490:79-83` |
| Corregir = publicar una versión nueva | **Implementado** como única vía | consecuencia de lo anterior |
| Activar = insertar una fila con `vigente_desde <= now()` | **Implementado** | `version_vigente`, `…490:146-158` |
| Activación programada (`vigente_desde` futuro) | **Implementado en la consulta**, sin flujo ni runbook que la use | `…490:155` |
| Dos versiones del mismo tipo a la misma hora | **Rechazado** (UNIQUE) | `…490:62-63` |
| Altas solo por `service_role`/Studio (un `insert` revisado) | **Implementado** (grants) | `…490:76-77` |
| Al activar una versión nueva, toda cuenta deja de contar como "aceptada" hasta aceptar de nuevo | **Implementado** | `terminos_vigentes_aceptados`, `…490:174-186` |
| Activar solo los Términos (no el Aviso) obliga igual a re-aceptar | **Implementado**: `aceptar_terminos` exige las dos vigentes; la fila del Aviso ya existente se conserva por `on conflict do nothing` | `…490:216-224` |
| La app ve la versión nueva sin reiniciar | **No implementado**: el estado se lee solo al cambiar de usuario; la base rechaza igual | `src/lib/session.tsx:305-319`; deuda en `CLAUDE.md` §8 |
| URL inmutable por versión en el sitio | **Pendiente** (rlvo-web) | `docs/pl-016-plan.md:56-61` |
| Texto canónico archivado y hash sobre él | **Pendiente** (solo existe la excepción de STAGING) | `LEEME.md:47-61` |
| Nombre de versión real para PROD | **Pendiente**; el formato solo está acotado por el CHECK | `LEEME.md:58-59` |
| Verificación automática hash ↔ contenido publicado | **No existe ni está planeada** | — |
| Carga en PROD | **Pendiente** (PROD no existe; PL-001) | `scripts/pl016-activar.sh:30-31` |

Orden operativo que exige el diseño **[CONFIRMADO por cómo funciona la base]**:
la página versionada tiene que estar publicada y estable **antes** de insertar
su fila, porque desde el `insert` la app puede abrir esa URL y nadie puede
corregirla después.

---

## 7. Riesgos y decisiones abiertas para rlvo-web

1. **Esquema de URLs versionadas** [ABIERTO]. Forma de la ruta (fecha, número,
   `vN`), qué hace `/terminos` (redirección 301/302 o contenido de la vigente),
   y garantía de que una URL publicada nunca cambia de contenido ni da 404.
   La base solo exige `https://` sin espacios.
2. **Qué bytes se hashean** [ABIERTO]. V1 dice "texto canónico", pero no hay
   formato definido ni regla aprobada (la de UTF-8/NFC/LF/salto final es una
   propuesta del `LEEME`). Si el sitio renderiza el documento, el hash del
   canónico no se puede recalcular desde la página: hay que decidir si el sitio
   publica también el texto canónico descargable.
3. **Quién es la fuente de verdad del texto** [ABIERTO]. Hoy el archivo vive
   en este repo (`docs/legal/versiones/`) y la página en rlvo-web. Hay dos
   copias que pueden divergir sin ningún error. Falta decidir cuál manda y qué
   comprobación las amarra (p. ej., un hash publicado por el sitio que este
   repo compare antes del `insert`).
4. **Identificador de versión compartido** [ABIERTO]. `version` debe cumplir
   `^[a-z0-9][a-z0-9.-]{0,39}$`. Conviene que el segmento de la URL sea el
   mismo string; no está decidido.
5. **El sitio no puede leer el catálogo sin sesión.** `anon` no tiene grants
   sobre `documentos_legales` ni EXECUTE sobre `estado_terminos`. Si rlvo-web
   necesitara saber cuál es la vigente, tendría que mantenerlo por su cuenta o
   pedir un cambio de grants (decisión de este repo, no implementada).
6. **Cloudflare Web Analytics en el HTML** [RIESGO]. Las páginas archivadas
   traen el snippet del beacon (`LEEME.md:27-28`). Si se volviera a hashear
   HTML, cualquier cambio de analítica, plantilla o caché cambiaría el hash.
   Además, `CLAUDE.md` §8 lista sin verificar si el aviso de privacidad debe
   mencionarlo.
7. **Enlaces no versionados en la app** [RIESGO]. Verificación y
   Configuración abren `/terminos` y `/privacidad` fijos, no la URL de la
   versión. Si `/terminos` deja de servir el contenido (p. ej., pasa a ser solo
   una redirección), esas pantallas dependen de que la redirección funcione en
   el navegador integrado.
8. **Textos aprobados** [ABIERTO, PL-008/PL-009]. Los documentos actuales son
   borradores con marcadores `[[POR CONFIRMAR]]`. La validación legal de la
   distinción "aceptado" vs "presentado" y de borrar la evidencia con la cuenta
   (P4) sigue pendiente.
9. **Timing de activación** [RIESGO]. La URL debe estar publicada antes del
   `insert` (sección 6). Con `vigente_desde` futuro se puede preparar, pero no
   hay runbook para eso.
10. **STAGING no es representativo del contrato final**: hash de HTML, URLs no
    versionadas y versión `staging-prueba`. No usar sus valores como referencia
    de PROD.
