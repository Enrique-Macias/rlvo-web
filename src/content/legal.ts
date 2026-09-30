// Fuentes: LEGAL_FACTS.md y las especificaciones legales derivadas en /docs.
// Solo permanecen aquí decisiones todavía abiertas o pendientes de validación.
export const pending = {
  legalName: 'razón social definitiva de la entidad responsable',
  interimResponsible: 'nombre completo de la persona responsable mientras no exista una sociedad constituida',
  responsibleAddress: 'domicilio empresarial o fiscal del responsable',
  privacyLegalReview: 'fundamentos jurídicos, finalidades en su redacción legal y versión definitiva del aviso de privacidad',
  arco: 'procedimiento formal, requisitos, plazos y redacción de los derechos ARCO conforme a la legislación mexicana vigente',
  providerClassification: 'clasificación jurídica de cada proveedor y tratamiento aplicable a transferencias nacionales o internacionales',
  moderationMechanism: 'fundamento jurídico y redacción exacta del mecanismo de acción afirmativa para proveedores de moderación',
  sentryRetention: 'periodo configurado de conservación de diagnósticos en Sentry y verificación de que evita datos personales innecesarios',
  moderationAcceptanceRetention: 'periodo jurídicamente válido para conservar fecha y versión de la acción relativa a proveedores de moderación',
  suspendedHash: 'fundamento jurídico, proporcionalidad y conservación indefinida del hash de correo de cuentas suspendidas',
  retentionLegalReview: 'validación jurídica de periodos de conservación, anonimización y excepciones aplicables',
  deletionImplementation: 'implementación y pruebas del flujo de eliminación en Supabase Auth, base de datos y Storage antes del lanzamiento',
  externalDeletionVerification: 'procedimiento definitivo para verificar la identidad en solicitudes de eliminación realizadas fuera de la aplicación',
  ipChannel: 'canal oficial para reclamos de propiedad intelectual',
  contentLicense: 'redacción jurídica definitiva de la licencia limitada sobre contenido del usuario',
  liabilityConsumer: 'redacción sobre responsabilidad, obligaciones de protección al consumidor y resolución de controversias',
  jurisdiction: 'ley aplicable, jurisdicción, competencia y mecanismos de resolución de controversias',
} as const;
export type PendingKey = keyof typeof pending;
