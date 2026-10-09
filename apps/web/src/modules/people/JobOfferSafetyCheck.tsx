import { useState, type FormEvent } from 'react';
import { screenRecruiterMessage, type RecruiterRiskCode, type RecruiterRiskResult } from './recruiterRisk';

type Locale = 'es' | 'en';

const COPY = {
  es: {
    heading: 'Revisión de seguridad de ofertas de empleo',
    intro: 'Analiza señales de alerta antes de responder. Esta revisión preliminar no confirma la identidad de la empresa, el reclutador ni la vacante.',
    message: 'Mensaje del reclutador',
    placeholder: 'Pega el mensaje sin incluir datos personales',
    sender: 'Correo del reclutador (opcional)',
    website: 'Sitio oficial de la empresa (opcional; búscalo por separado)',
    submit: 'Analizar señales',
    noFlags: 'No se detectaron señales mediante estas reglas limitadas. La oferta NO está verificada ni aprobada.',
    nextTitle: 'Qué hacer:',
    next: 'Busca la vacante en el sitio oficial de la empresa, contacta a RR. HH. usando canales independientes y nunca pagues para conseguir empleo ni compartas datos bancarios o de identidad antes de verificar.',
    privacy: 'El análisis ocurre en tu navegador: este formulario no envía el mensaje a la API de People ni guarda empresas como verificadas. No escribas números de seguro social, cuentas bancarias ni contraseñas.',
    high: 'Prioridad alta',
    caution: 'Precaución'
  },
  en: {
    heading: 'Recruiter message safety precheck',
    intro: 'Review potential warning signs before responding. This preliminary text check does not authenticate an employer, recruiter or job posting.',
    message: 'Recruiter message',
    placeholder: 'Paste offer text without personal details',
    sender: 'Recruiter email (optional)',
    website: 'Official employer website (optional; find independently)',
    submit: 'Check warning signs',
    noFlags: 'No obvious signals were detected by these limited rules. The offer is NOT verified or approved.',
    nextTitle: 'Next steps:',
    next: "Find the vacancy on the employer's official careers site, contact HR through an independently sourced channel, and never pay for a job or share banking or identity data before verification.",
    privacy: 'Analysis runs in your browser: this form does not send the message to the People API or save a verified employer. Do not enter SSNs, bank numbers or passwords.',
    high: 'High priority',
    caution: 'Caution'
  }
} as const;

const RESULT_LABELS: Record<Locale, Record<RecruiterRiskResult['level'], string>> = {
  es: {
    'high-risk': 'Señales de alto riesgo: no continúes sin verificación independiente',
    review: 'Señales de advertencia: investiga antes de compartir información',
    inconclusive: 'Resultado no concluyente: la autenticidad sigue sin verificar'
  },
  en: {
    'high-risk': 'High-risk signals: do not proceed before independent verification',
    review: 'Warning signals: investigate before sharing information',
    inconclusive: 'Inconclusive: authenticity remains unverified'
  }
};

const SPANISH_FLAGS: Record<RecruiterRiskCode, { title: string; explanation: string }> = {
  upfront_payment: { title: 'Solicitud de pago o compra', explanation: 'No pagues para obtener un empleo ni compres equipos siguiendo instrucciones de una oferta sin verificar.' },
  sensitive_information: { title: 'Solicitud de datos sensibles', explanation: 'Confirma el proceso usando un contacto oficial independiente antes de compartir identidad, datos bancarios o contraseñas.' },
  check_scheme: { title: 'Posible esquema con cheque falso', explanation: 'No deposites cheques de supuestos empleadores para comprar suministros o transferir dinero sin una verificación independiente.' },
  off_platform: { title: 'Solicitud de mensajería privada', explanation: 'Pide continuar por un correo corporativo verificable o un portal de contratación oficial.' },
  urgency: { title: 'Presión o urgencia', explanation: 'Dedica tiempo a comprobar la empresa y la oferta por separado.' },
  personal_email: { title: 'Correo de proveedor personal', explanation: 'Un correo personal no prueba fraude; confirma por un canal independiente que el remitente está autorizado.' },
  domain_mismatch: { title: 'Dominios de remitente y empresa diferentes', explanation: 'Las agencias legítimas pueden utilizar otros dominios. Confirma la relación con la empresa por una fuente independiente.' }
};

/** In-browser screening only. Never persists user text or authenticates employers. */
export function JobOfferSafetyCheck() {
  const [language, setLanguage] = useState<Locale>(() =>
    typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
  );
  const [result, setResult] = useState<RecruiterRiskResult | null>(null);
  const copy = COPY[language];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setResult(screenRecruiterMessage({
      message: String(data.get('message') || ''),
      senderEmail: String(data.get('senderEmail') || ''),
      officialEmployerWebsite: String(data.get('officialEmployerWebsite') || '')
    }));
  }

  return <section className="status-card" aria-labelledby="job-safety-heading" lang={language}>
    <div className="module-experience-actions" role="group" aria-label="Idioma / Language">
      <button type="button" aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>Español</button>
      <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
    </div>
    <h2 id="job-safety-heading">{copy.heading}</h2>
    <p>{copy.intro}</p>
    <form className="atlas-form" onSubmit={submit}>
      <label>{copy.message}
        <textarea name="message" rows={4} maxLength={4000} required placeholder={copy.placeholder} onChange={() => setResult(null)} />
      </label>
      <label>{copy.sender}
        <input name="senderEmail" type="email" autoComplete="off" placeholder="recruiter@example.com" onChange={() => setResult(null)} />
      </label>
      <label>{copy.website}
        <input name="officialEmployerWebsite" type="text" autoComplete="off" placeholder="example.com" onChange={() => setResult(null)} />
      </label>
      <button type="submit">{copy.submit}</button>
    </form>
    {result ? <div role="status" aria-live="polite">
      <h3>{RESULT_LABELS[language][result.level]}</h3>
      {result.flags.length ? <ul>{result.flags.map(flag => {
        const translation = SPANISH_FLAGS[flag.code];
        return <li key={flag.code}>
          <strong>{language === 'es' ? translation.title : flag.title} ({flag.severity === 'high' ? copy.high : copy.caution})</strong>:
          {' '}{language === 'es' ? translation.explanation : flag.explanation}
        </li>;
      })}</ul> : <p>{copy.noFlags}</p>}
      <p><strong>{copy.nextTitle}</strong> {copy.next}</p>
    </div> : null}
    <small>{copy.privacy}</small>
  </section>;
}
