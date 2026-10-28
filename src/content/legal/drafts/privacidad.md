# Aviso de privacidad

Borrador informativo sobre cómo la aplicación móvil de RLVO trata datos personales.

Última actualización: [[POR CONFIRMAR: fecha de actualización del aviso de privacidad]]

## Qué es RLVO y a quién se dirige {#alcance}

RLVO es un marketplace móvil para personas de 18 años o más dentro de comunidades universitarias admitidas. Permite descubrir publicaciones, publicar productos y contactar a otros usuarios para coordinar directamente una operación.

La verificación universitaria demuestra únicamente acceso a un correo de un dominio institucional admitido. No verifica legalmente la identidad, no garantiza que la persona sea estudiante actualmente y no implica respaldo de una universidad.

### Este sitio web

El sitio público rlvo.com.mx es informativo. Actualmente no recopila información mediante formularios, no tiene lista de espera, no utiliza analítica y no utiliza cookies no esenciales.

## Responsable del tratamiento {#responsable}

La sociedad mercantil todavía no está constituida. La identidad y el domicilio que deberán aparecer en la versión definitiva dependen de esa constitución y de revisión jurídica.

[[POR CONFIRMAR: razón social definitiva de la entidad responsable]]

[[POR CONFIRMAR: nombre completo de la persona responsable mientras no exista una sociedad constituida]]

[[POR CONFIRMAR: domicilio empresarial o fiscal del responsable]]

El canal confirmado para privacidad y derechos sobre datos personales es:

[privacidad@rlvo.com.mx](mailto:privacidad@rlvo.com.mx)

## Qué datos trata la aplicación {#datos}

### Cuenta y acceso

- Correo institucional y universidad derivada de su dominio.

- Credenciales administradas mediante Supabase Auth. RLVO no puede leer la contraseña en texto plano.

- ID interno, fecha de registro, último inicio de sesión y token de notificaciones por dispositivo.

### Perfil

- Nombre, universidad y campus.

- Fotografía de perfil, carrera e intereses cuando el usuario decide proporcionarlos.

- Calificación y reseñas asociadas al perfil.

### Teléfono y WhatsApp

El número de teléfono es necesario para publicar, pero no para navegar. No se muestra públicamente. Se proporciona de manera individual cuando otro usuario activo elige “Contactar por WhatsApp”; entonces la conversación continúa fuera de RLVO y queda sujeta también al tratamiento que WhatsApp o Meta realicen bajo sus propios términos.

RLVO registra el usuario que inició el contacto, la publicación y la fecha y hora. Estos datos pueden apoyar el registro de una venta, funciones relacionadas con la operación y recomendaciones internas.

### Publicaciones e imágenes

Una publicación puede incluir título, descripción, precio, categoría, condición, hasta cinco fotografías y su orden, propietario, universidad, campus, estado, fechas, contador agregado de vistas e información de moderación. Las fotografías de publicaciones y perfiles se almacenan en Supabase Storage.

### Actividad e interacciones

RLVO trata favoritos, contactos iniciados, publicaciones creadas, la relación entre comprador y vendedor cuando se registra una venta, reseñas y reportes. No mantiene un historial general de navegación por usuario.

### Diagnóstico técnico

RLVO utiliza Sentry para diagnóstico de errores, rendimiento y estabilidad técnica. Su configuración debe evitar el envío de datos personales innecesarios.

## Cómo utiliza RLVO la información {#usos}

- Crear y administrar cuentas, verificar acceso al correo institucional y asignar la universidad correspondiente.

- Mostrar perfiles y publicaciones; permitir descubrimiento, favoritos, contacto, registro de ventas y reseñas.

- Moderar contenido, prevenir abuso, gestionar reportes, aplicar suspensiones y detectar reincidencias.

- Enviar notificaciones operativas, prestar soporte y mantener seguridad, rendimiento y estabilidad.

- Cumplir obligaciones legales aplicables, cuya redacción jurídica todavía debe validarse.

RLVO no realiza actualmente marketing por correo electrónico.

[[POR CONFIRMAR: fundamentos jurídicos, finalidades en su redacción legal y versión definitiva del aviso de privacidad]]

### Información visible para otros usuarios

Pueden mostrarse nombre, foto, universidad, campus, calificación, reseñas, carrera cuando corresponda y publicaciones. El correo institucional, la contraseña, el teléfono antes de una acción explícita de contacto, los tokens push y los registros administrativos o internos de moderación son privados.

### Personalización

“Recomendados para ti” puede utilizar intereses, favoritos y contactos de los últimos 90 días. El cálculo se realiza internamente en la base de datos y no utiliza aprendizaje automático.

### Ubicación aproximada

Solo se solicita cuando el usuario activa “Detectar campus más cercano”. El cálculo ocurre en el dispositivo. RLVO no envía esa ubicación a Supabase, no la almacena en su base de datos y no la guarda localmente.

### Notificaciones push

RLVO utiliza Expo Push Notification Service, que puede entregar notificaciones mediante infraestructura de Apple o Google. Las notificaciones son operativas, por ejemplo sobre publicaciones, favoritos, reportes, reseñas o suspensiones. El usuario puede desactivarlas, aunque actualmente no puede configurarlas por categoría.

## Moderación automatizada y revisión humana {#moderacion}

La especificación del producto contempla moderación automática antes de permitir determinados textos o imágenes:

- **OpenAI:** recibe el título y la descripción de la publicación; no recibe imágenes en este flujo.

- **Google Cloud Vision:** recibe fotografías de publicaciones y de perfil, y puede realizar reconocimiento óptico de texto.

- **Amazon Rekognition:** recibe fotografías de publicaciones.

La finalidad es identificar contenido que pueda incumplir las políticas de RLVO. Una coincidencia clara puede bloquearse automáticamente; los casos que requieran interpretación pueden pasar a revisión humana. La automatización no garantiza detectar todas las infracciones.

Antes del primer envío correspondiente, la aplicación deberá identificar proveedores, datos y finalidad, pedir una acción afirmativa y conservar su fecha y versión. Si el usuario no realiza esa acción, puede seguir navegando, pero no puede publicar ni subir una foto de perfil.

[[POR CONFIRMAR: fundamento jurídico y redacción exacta del mecanismo de acción afirmativa para proveedores de moderación]]

[[POR CONFIRMAR: periodo jurídicamente válido para conservar fecha y versión de la acción relativa a proveedores de moderación]]

## Proveedores y servicios relevantes {#proveedores}

- **Supabase:** autenticación, base de datos, Storage, Edge Functions y Realtime.

- **OpenAI, Google Cloud Vision y Amazon Rekognition:** moderación de texto o imágenes según lo descrito arriba.

- **Sentry:** diagnóstico de errores, rendimiento y estabilidad.

- **Expo/EAS, Apple y Google:** infraestructura de la aplicación, distribución y entrega de notificaciones cuando corresponda.

- **Google Workspace:** correo corporativo y canales de privacidad, soporte y contacto.

- **Cloudflare y Squarespace:** alojamiento del sitio público y gestión actual del dominio, respectivamente.

- **WhatsApp/Meta:** aplicación externa que se abre para continuar el contacto entre usuarios.

[[POR CONFIRMAR: clasificación jurídica de cada proveedor y tratamiento aplicable a transferencias nacionales o internacionales]]

## Conservación {#conservacion}

- Los datos de cuenta y perfil se conservan mientras exista la cuenta y sean necesarios para prestar el servicio.

- Una publicación eliminada y sus fotografías se eliminan. Si existió una infracción, puede permanecer un registro mínimo de moderación, sin conservar las fotografías únicamente para ese fin.

- Los reportes se conservan durante 12 meses después de su resolución.

- Los registros mínimos de moderación pueden conservarse durante 12 meses para reincidencias y disputas.

- La personalización considera contactos y favoritos relevantes dentro de una ventana de 90 días.

- Los tokens push se conservan hasta que dejan de ser válidos, se retira el dispositivo o se elimina la cuenta.

[[POR CONFIRMAR: periodo configurado de conservación de diagnósticos en Sentry y verificación de que evita datos personales innecesarios]]

[[POR CONFIRMAR: validación jurídica de periodos de conservación, anonimización y excepciones aplicables]]

## Eliminación de cuenta {#eliminacion}

El flujo definido en la aplicación se encuentra en **Perfil → Configuración → Eliminar cuenta**, requiere confirmar la contraseña y no tiene periodo de espera. Después de una confirmación correcta, la eliminación comienza inmediatamente.

Se eliminan el perfil, correo institucional, teléfono, fotografías, publicaciones, favoritos, contactos atribuibles, intereses, tokens push, reseñas recibidas, registro de comprador y referencias personales aplicables.

Las reseñas escritas conservan únicamente las estrellas de forma anónima; se eliminan autor y comentario. Los reportes pueden permanecer sin identidad durante su periodo de conservación, y puede quedar un registro mínimo de moderación por 12 meses.

Si la cuenta estaba suspendida, la decisión actual del producto es conservar indefinidamente un hash SHA-256 del correo institucional, sin guardar el correo original, para evitar un nuevo registro con ese correo. Esta medida todavía requiere validación jurídica.

[[POR CONFIRMAR: fundamento jurídico, proporcionalidad y conservación indefinida del hash de correo de cuentas suspendidas]]

[[POR CONFIRMAR: implementación y pruebas del flujo de eliminación en Supabase Auth, base de datos y Storage antes del lanzamiento]]

Consulta los detalles y el canal de asistencia en [Eliminación de cuenta](/eliminar-cuenta).

## Derechos sobre tus datos {#derechos}

Las solicitudes relacionadas con datos personales comienzan por correo electrónico. RLVO podrá verificar la identidad mediante mecanismos proporcionales al tipo de solicitud y utilizando la información mínima necesaria.

[privacidad@rlvo.com.mx](mailto:privacidad@rlvo.com.mx)

[[POR CONFIRMAR: procedimiento formal, requisitos, plazos y redacción de los derechos ARCO conforme a la legislación mexicana vigente]]

Los cambios sustanciales en categorías de datos, finalidades o proveedores requieren revisar este aviso y, cuando corresponda, solicitar una nueva acción del usuario.
