export const venezuela = {
  countryCode: 'VE',
  locale: 'es-VE',
  name: 'Venezuela',
  currency: 'VES',
  optionalDisplayCurrency: 'USD',
  timeZone: 'America/Caracas',
  status: 'pilot' as const,
  modules: [
    { title: 'Finanzas', description: 'Contabilidad y conciliación multimoneda', path: '/finance' },
    { title: 'Impuestos', description: 'Reglas venezolanas pendientes de validación legal', path: '/tax', gated: true },
    { title: 'Nómina', description: 'Normativa laboral pendiente de validación', path: '/payroll', gated: true },
    { title: 'Negocios', description: 'Herramientas para empresas y emprendedores', path: '/business' },
    { title: 'Aprendizaje', description: 'Formación y desarrollo profesional', path: '/learning' }
  ]
} as const;
