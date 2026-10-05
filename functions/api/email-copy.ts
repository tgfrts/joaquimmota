import type { ValidatedLead } from './leads.ts';

export type LeadEmail = { subject: string; text: string; html: string };
export type PropertyEmailContext = { title: string; reference: string };

const reply = 'Se quiser acrescentar alguma informação, basta responder a este email.';
const signature = 'Até breve,\nJoaquim Mota\nConsultor Imobiliário';
const valuation = 'Recebemos o seu pedido para conhecer o valor atual da sua casa. Entraremos em contacto consigo para confirmar os detalhes do imóvel e preparar uma análise do seu valor de mercado.';
const labels: Record<string, string> = {
  firstName: 'Nome', lastName: 'Apelido', name: 'Nome completo', email: 'Email', phone: 'Telefone',
  message: 'Informação adicional', propertyType: 'Tipo de imóvel', bedrooms: 'Quartos', location: 'Localização',
  clientType: 'Tipo de cliente', contactSubject: 'Assunto do contacto', consent: 'Consentimento',
  address: 'Morada', postalCode: 'Código postal', municipality: 'Concelho', referral: 'Conhece alguém', intent: 'Está a pensar',
};

function string(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function escape(value: string) {
  return value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}
function email(subject: string, text: string, lang = 'pt-PT', link?: { label: string; url: string }): LeadEmail {
  const paragraphs = text.split('\n\n').map((paragraph) => {
    if (link && paragraph === `${link.label}: ${link.url}`) return `<p><a href="${escape(link.url)}" style="display:inline-block;padding:14px 24px;background:#20457f;color:#fff;text-decoration:none">${escape(link.label)}</a></p>`;
    return `<p>${escape(paragraph).replace(/\n/gu, '<br>')}</p>`;
  }).join('');
  return { subject, text, html: `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;padding:24px;background:#fff;color:#222;font:16px/1.6 Arial,sans-serif"><main style="max-width:600px;margin:auto">${paragraphs}</main></body></html>` };
}

export function buildLeadEmails(submission: ValidatedLead, property?: PropertyEmailContext): { consultant: LeadEmail; customer: LeadEmail } {
  const fields = submission.fields;
  const fullName = string(fields.name) || [string(fields.firstName), string(fields.lastName)].filter(Boolean).join(' ');
  const firstName = string(fields.firstName) || fullName.split(/\s+/u)[0] || 'Cliente';
  const greeting = `Olá ${firstName},`;
  let consultantSubject: string;
  let customerSubject: string;
  let content: string;
  let lang = 'pt-PT';
  let customerGreeting = greeting;
  let customerReply = reply;
  let customerSignature = signature;
  let link: { label: string; url: string } | undefined;

  if (submission.route.startsWith('/imoveis/')) {
    const reference = property?.reference || submission.route.slice('/imoveis/'.length).toUpperCase();
    const title = property?.title || reference;
    consultantSubject = `Novo contacto sobre imóvel - ${reference}`;
    customerSubject = `Recebemos o seu pedido — ${reference}`;
    content = `Recebemos o seu pedido de informações sobre o imóvel ${title}, com a referência ${reference}.\n\nEntraremos em contacto consigo para esclarecer as suas questões e, se desejar, combinar uma visita.`;
    link = { label: 'Consultar o imóvel', url: `https://joaquimmota.pt${submission.route}` };
  } else switch (submission.route) {
    case '/vamos-comecar': {
      const selection = string(fields.contactSubject) || string(fields.message).match(/Assunto do contacto:\s*(Comprar|Vender|Outro)/iu)?.[1] || 'Outro';
      const intent = selection.toLowerCase() === 'comprar' ? 'Comprar' : selection.toLowerCase() === 'vender' ? 'Vender' : 'Outro';
      consultantSubject = `Novo contato - ${intent}`;
      customerSubject = `Recebemos o seu contacto, ${firstName}`;
      content = intent === 'Comprar'
        ? 'Recebemos o seu pedido para comprar casa. Entraremos em contacto consigo para conhecer o que procura e ajudá-lo nos próximos passos.'
        : intent === 'Vender'
          ? 'Recebemos o seu pedido para vender casa. Entraremos em contacto consigo para conhecer os seus objetivos e ajudá-lo nos próximos passos.'
          : 'Recebemos o seu contacto. Entraremos em contacto consigo para perceber como podemos ajudar.';
      break;
    }
    case '/uma-venda-com-sucesso':
    case '/lp-flyer-uma-venda-com-sucesso':
    case '/estudo-de-mercado':
    case '/quanto-vale-a-sua-casa-hoje': {
      const page = submission.route === '/estudo-de-mercado' ? 'Estudo de mercado' : submission.route === '/quanto-vale-a-sua-casa-hoje' ? 'Quanto vale a sua casa hoje' : 'Uma venda com sucesso';
      consultantSubject = `Novo pedido de avaliação - ${page}`;
      customerSubject = submission.route === '/quanto-vale-a-sua-casa-hoje' ? `Recebemos o seu pedido para saber quanto vale a sua casa, ${firstName}` : `Recebemos o seu pedido de avaliação, ${firstName}`;
      content = valuation;
      break;
    }
    case '/sessao-gratuita':
      consultantSubject = 'Novo pedido de sessão gratuita';
      customerSubject = `Recebemos o seu pedido de sessão gratuita, ${firstName}`;
      content = 'Recebemos o seu pedido de uma sessão gratuita. Entraremos em contacto consigo para combinar o melhor dia e horário, conhecer os seus objetivos e ajudá-lo nos próximos passos para vender a sua casa.';
      break;
    case '/parcerias':
    case '/partnerships':
    case '/partenariats': {
      const language = submission.route === '/partnerships' ? 'Inglês' : submission.route === '/partenariats' ? 'Francês' : 'Português';
      consultantSubject = `Novo pedido de parceria - ${language}`;
      if (language === 'Inglês') {
        lang = 'en'; customerGreeting = `Hello ${firstName},`;
        customerSubject = `We’ve received your partnership request, ${firstName}`;
        content = 'We’ve received your partnership request to assist your client in Portugal. We’ll contact you to understand their goals and discuss the next steps.';
        customerReply = 'If you’d like to add any information, simply reply to this email.';
        customerSignature = 'Best regards,\nJoaquim Mota\nReal Estate Consultant';
      } else if (language === 'Francês') {
        lang = 'fr'; customerGreeting = `Bonjour ${firstName},`;
        customerSubject = `Nous avons reçu votre demande de partenariat, ${firstName}`;
        content = 'Nous avons reçu votre demande de partenariat pour accompagner votre client au Portugal. Nous vous contacterons pour connaître ses objectifs et convenir des prochaines étapes.';
        customerReply = 'Si vous souhaitez ajouter des informations, il vous suffit de répondre à cet email.';
        customerSignature = 'À bientôt,\nJoaquim Mota\nConseiller immobilier';
      } else {
        customerSubject = `Recebemos o teu pedido de parceria, ${firstName}`;
        content = 'Recebemos o teu pedido de parceria. Entraremos em contacto contigo para conhecer os seus objetivos e combinar os próximos passos.';
        customerReply = 'Se quiseres acrescentar alguma informação, basta responder a este email.';
      }
      break;
    }
    case '/lp/smillingstreet':
      consultantSubject = 'Nova inscrição - Smillingstreet';
      customerSubject = 'Recebemos a sua inscrição — Smillingstreet';
      content = 'Recebemos a sua inscrição para beneficiar do desconto de 10% nos tratamentos dentários da Smillingstreet. Entraremos em contacto consigo para explicar como usufruir desta vantagem.';
      break;
    case '/lp/cabaz-de-natal':
      consultantSubject = 'Nova participação - Cabaz de Natal';
      customerSubject = `A sua participação no sorteio do cabaz de Natal, ${firstName}`;
      content = 'Recebemos a sua participação no sorteio do nosso cabaz de Natal. Boa sorte!';
      customerReply = 'Se tiver alguma questão, basta responder a este email.';
      customerSignature = 'Boas festas!\nJoaquim Mota\nConsultor Imobiliário';
      break;
    case '/lp/atualizacao-de-informacao':
      consultantSubject = `Atualização de informação - ${fullName || firstName}`;
      customerSubject = `Recebemos a atualização dos seus dados, ${firstName}`;
      content = 'Recebemos os dados que enviou para atualizar as suas informações.';
      customerReply = 'Se precisar de corrigir ou acrescentar alguma informação, basta responder a este email.';
      break;
    case '/credito-habitacao':
      consultantSubject = 'Nova lead de crédito habitação — Joaquim Mota';
      customerSubject = `Recebemos o seu pedido de crédito habitação, ${firstName}`;
      content = 'Recebemos o seu pedido de apoio com o crédito habitação. A equipa da Somos Crédito entrará em contacto consigo para conhecer os seus objetivos e ajudá-lo nos próximos passos.';
      break;
    case '/lp/guia-de-ferias':
    case '/guia-vender-para-comprar':
    case '/dossier': {
      const holidays = submission.route === '/lp/guia-de-ferias';
      const dossier = submission.route === '/dossier';
      consultantSubject = holidays ? 'Novo pedido de guia - Guia de férias' : dossier ? 'Novo pedido - Dossier' : 'Novo pedido de guia - Vender para comprar';
      customerSubject = holidays ? `O seu guia de férias, ${firstName}` : dossier ? `O seu dossier, ${firstName}` : `O seu guia para vender antes de comprar, ${firstName}`;
      content = holidays ? 'Aqui está o seu guia de férias. Pode consultá-lo através do botão abaixo.' : dossier ? 'Aqui está o seu dossier. Pode consultá-lo através do botão abaixo.' : 'Aqui está o seu guia para vender antes de comprar. Pode consultá-lo através do botão abaixo.';
      link = { label: holidays ? 'Consultar o guia de férias' : dossier ? 'Consultar o dossier' : 'Consultar o guia', url: holidays ? 'https://drive.google.com/file/d/1Cy4G9-0rLHbO8CG0AlEbvaxPhql1yl4L/view?usp=sharing' : dossier ? 'https://drive.google.com/file/d/1wi6qHnQzGuJOpk2uK1WyfFUzRGUcAndF/view?usp=sharing' : 'https://drive.google.com/file/d/1_AqC5yAUDz8l3xWBaTYLC5OA3EfRF0kF/view?usp=sharing' };
      customerReply = 'Se tiver alguma questão, basta responder a este email.';
      if (holidays) customerSignature = 'Boas férias!\nJoaquim Mota\nConsultor Imobiliário';
      break;
    }
    default: throw new Error('No approved lead email copy for this route.');
  }

  const details = Object.entries(fields).map(([key, value]) => `${labels[key] || key}: ${typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}`);
  if (property) details.push(`Imóvel: ${property.title}`, `Referência: ${property.reference}`);
  details.push(`Página: https://joaquimmota.pt${submission.route}`);
  const consultantText = submission.route === '/credito-habitacao'
    ? `Olá,\n\nTens uma nova lead para crédito habitação do Joaquim Mota:\n\nNome: ${firstName}\nApelido: ${string(fields.lastName) || fullName.split(/\s+/u).slice(1).join(' ')}\nEmail: ${string(fields.email)}\nTelefone: ${string(fields.phone)}\n\nCumprimentos,\nTiago Freitas`
    : `Olá Mota, tens uma nova lead do site:\n\n${consultantSubject}\n\n${details.join('\n')}\n\nCumprimentos,\nTiago Freitas`;
  const customerText = [customerGreeting, content, ...(link && submission.route.startsWith('/imoveis/') ? [customerReply, `${link.label}: ${link.url}`] : [...(link ? [`${link.label}: ${link.url}`] : []), customerReply]), customerSignature].join('\n\n');
  return { consultant: email(consultantSubject, consultantText), customer: email(customerSubject, customerText, lang, link) };
}
