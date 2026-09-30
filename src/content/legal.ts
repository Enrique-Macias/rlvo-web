// Única fuente factual: docs/LEGAL_FACTS.md. Estos textos siguen siendo borradores.
export const pending = {
  responsible: 'nombre del responsable del tratamiento, persona física o moral, y domicilio',
  age: 'edad mínima para utilizar la aplicación',
  jurisdiction: 'ley aplicable y jurisdicción',
  arco: 'correo o medio y procedimiento para ejercer derechos sobre datos personales (ARCO)',
  push: 'qué se guarda exactamente del token de notificaciones push',
  providers: 'cuáles de Google Cloud Vision, OpenAI y Amazon Rekognition estarán en producción al lanzar',
  suspension: 'confirmar con el flujo real de eliminación si se conserva un hash del correo de una cuenta suspendida para impedir un nuevo registro',
  deletion: 'ruta exacta en la app para eliminar la cuenta; qué se borra del perfil, publicaciones, fotos de Storage y reseñas; qué se conserva, por cuánto tiempo y plazo de eliminación',
  retention: 'periodos de conservación de los datos personales',
} as const;
export type PendingKey = keyof typeof pending;
