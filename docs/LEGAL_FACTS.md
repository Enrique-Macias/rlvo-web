# RLVO — Legal Facts

> Este archivo contiene hechos del producto, NO asesoría ni texto legal final.
>
> Los documentos legales deben basarse exclusivamente en hechos confirmados
> aquí.
>
> No completar información faltante mediante suposición.

## Hechos para el Aviso de privacidad y los Términos

## Datos que recolecta la app
- Correo universitario (para verificar; solo dominios dados de alta). No es
  visible para otros usuarios.
- Nombre, foto de perfil (opcional), universidad, campus, carrera.
- Teléfono (para contacto por WhatsApp). NO es público: solo se entrega, de una
  fila a la vez, al abrir el WhatsApp de un vendedor.
- Publicaciones: título, descripción, precio, categoría, condición, hasta 5
  fotos.
- Reseñas/calificaciones, reportes, favoritos.
- Token de notificaciones push. [[POR CONFIRMAR: qué se guarda exactamente]]
- Ubicación aproximada (solo para sugerir el campus más cercano): se obtiene y
  usa SOLO en el dispositivo; nunca se envía a Supabase ni a terceros, nunca se
  guarda (ni en la base ni en almacenamiento local).

## Terceros que procesan datos
- Supabase (base de datos, autenticación, almacenamiento de fotos).
- Moderación de contenido: Google Cloud Vision (fotos), OpenAI (título y
  descripción), Amazon Rekognition (fotos: drogas/alcohol/tabaco/apuestas).
  [[POR CONFIRMAR: cuáles ya están en producción al lanzar]]
- Expo Push Notification Service (notificaciones).
- Google Workspace (correos soporte@ y contacto@).

## Moderación
- Revisión automática antes de publicar; publicaciones dudosas quedan
  "pendientes" para revisión humana; las bloqueadas dejan de ser visibles.
- Hay suspensión de cuentas. Una cuenta que se elimina estando suspendida deja
  un hash del correo para impedir que vuelva a registrarse.
  [[POR CONFIRMAR con el flujo real de "Eliminar cuenta"]]

## Eliminación de cuenta
[[POR CONFIRMAR: ruta exacta en la app, qué se borra (perfil, publicaciones,
fotos de Storage, reseñas), qué se conserva y por cuánto tiempo, y plazo]]

## Contacto
soporte@rlvo.com.mx (soporte) · contacto@rlvo.com.mx (contacto general)

## Datos que solo tú puedes dar
- Responsable del tratamiento: nombre (persona física o moral) y domicilio.
- Edad mínima para usar la app.
- Ley aplicable y jurisdicción.
- Correo o medio para ejercer derechos sobre datos personales (ARCO).