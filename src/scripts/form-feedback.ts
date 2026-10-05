/** Route-specific confirmation copy agreed with the Owner. Insert with textContent. */
export function formSuccessMessage(route: string, firstName: string) {
  const name = firstName.trim();
  const thanks = name ? `Obrigado, ${name}!` : 'Obrigado!';
  if (route === '/partnerships') return `${name ? `Thank you, ${name}!` : 'Thank you!'} We’ve received your partnership request. We’ll contact you shortly.`;
  if (route === '/partenariats') return `${name ? `Merci, ${name} !` : 'Merci !'} Nous avons reçu votre demande de partenariat. Nous vous contacterons prochainement.`;
  if (route === '/parcerias') return `${thanks} Recebemos o teu pedido de parceria. Entraremos em contacto contigo em breve.`;
  if (route === '/sessao-gratuita') return `${thanks} Recebemos o seu pedido. Entraremos em contacto consigo para combinar o dia e horário.`;
  if (route === '/credito-habitacao') return `${thanks} Recebemos o seu pedido. A equipa da Somos Crédito entrará em contacto consigo em breve.`;
  if (route === '/lp/smillingstreet') return `${thanks} Recebemos a sua inscrição. Entraremos em contacto consigo para explicar como usufruir do desconto.`;
  if (route === '/lp/atualizacao-de-informacao') return `${thanks} Recebemos a atualização dos seus dados.`;
  if (route.startsWith('/imoveis/')) return `${thanks} Recebemos o seu pedido. Entraremos em contacto consigo para esclarecer as suas questões ou combinar uma visita.`;
  if (['/uma-venda-com-sucesso', '/quanto-vale-a-sua-casa-hoje', '/lp-flyer-uma-venda-com-sucesso', '/estudo-de-mercado'].includes(route)) return `${thanks} Recebemos o seu pedido de avaliação. Entraremos em contacto consigo para confirmar os detalhes do imóvel.`;
  return `${thanks} Recebemos o seu contacto. Entraremos em contacto consigo em breve.`;
}
