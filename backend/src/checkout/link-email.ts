const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface LinkEmailInput {
  merchantName: string | null;
  description: string;
  amountCents: number;
  url: string;
  expiresAt: Date;
  note?: string;
}

export function renderLinkEmail(i: LinkEmailInput) {
  const merchant = i.merchantName?.trim() || 'Um lojista';
  const amount = brl(i.amountCents);
  const expires = i.expiresAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
  const note = i.note?.trim();

  const subject = `${merchant} enviou um link de pagamento de ${amount}`;
  const text = [
    `${merchant} enviou um link de pagamento.`,
    '',
    `Referente a: ${i.description}`,
    `Valor: ${amount}`,
    note ? `\nMensagem: ${note}` : '',
    '',
    `Pague em: ${i.url}`,
    `Válido até ${expires}.`,
  ].filter((l, idx, arr) => !(l === '' && arr[idx - 1] === '')).join('\n');

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f1f4f2;font-family:Arial,Helvetica,sans-serif;color:#0f1f1b">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
    <tr><td>
      <p style="margin:0 0 4px;color:#62756d;font-size:14px">${escapeHtml(merchant)} enviou uma cobrança</p>
      <h1 style="margin:0 0 4px;font-size:20px">${escapeHtml(i.description)}</h1>
      <p style="margin:12px 0 20px;font-size:32px;font-weight:700">${escapeHtml(amount)}</p>
      ${note ? `<p style="margin:0 0 20px;padding:12px;background:#f1f4f2;border-radius:8px;font-size:14px">${escapeHtml(note)}</p>` : ''}
      <a href="${escapeHtml(i.url)}" style="display:block;text-align:center;background:#0a5c4a;color:#ffffff;text-decoration:none;padding:14px;border-radius:8px;font-weight:600">Pagar agora</a>
      <p style="margin:20px 0 0;font-size:13px;color:#62756d">Link válido até ${escapeHtml(expires)}. Se o botão não abrir, copie este endereço:<br>${escapeHtml(i.url)}</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
