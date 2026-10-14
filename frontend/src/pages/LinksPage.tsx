import { FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../api';
import { CurrencyInput, Field, Segmented } from '../components/inputs';
import { CopyButton, EmptyState, ErrorMessage, errorText, Modal, Notice, PageHeader, QrImage, StatusBadge, useLoad } from '../components/ui';
import { feeInCents, formatBRL, formatDate, METHOD_LABEL } from '../format';

interface Fee { brand: string; installments: number; feePercent: number }
interface Link {
  id: string;
  code: string;
  checkoutUrl: string;
  description: string;
  method: 'PIX' | 'CARD';
  brand: string | null;
  amountCents: number;
  installments: number | null;
  feePercent: number | null;
  feeCents: number;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const EXPIRY_OPTIONS = [[60, '1 hora'], [1440, '24 horas'], [10080, '7 dias'], [43200, '30 dias']] as const;
const METHODS = [['PIX', 'Pix'], ['CARD', 'Cartão']] as const;

const whatsappUrl = (l: Link) =>
  `https://wa.me/?text=${encodeURIComponent(
    `Olá! Segue o link para pagamento de "${l.description}" (${formatBRL(l.amountCents)}): ${l.checkoutUrl}`,
  )}`;

export default function LinksPage() {
  const links = useLoad(() => api<Link[]>('/checkout/links'));
  const [form, setForm] = useState({
    description: '',
    cents: 0,
    method: 'PIX' as 'PIX' | 'CARD',
    brand: 'VISA',
    installments: 1,
    expiresInMinutes: 1440,
  });
  const [fees, setFees] = useState<Fee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrId, setQrId] = useState<string | null>(null);
  const [mailId, setMailId] = useState<string | null>(null);
  const [mail, setMail] = useState({ to: '', note: '' });
  const [mailBusy, setMailBusy] = useState(false);
  const [mailError, setMailError] = useState<string | null>(null);

  useEffect(() => {
    if (form.method !== 'CARD') return;
    setFees([]);
    api<Fee[]>(`/fees?brand=${form.brand}`)
      .then((rows) => setFees(rows.filter((r) => r.brand === form.brand).sort((a, b) => a.installments - b.installments)))
      .catch((e) => setError(errorText(e)));
  }, [form.method, form.brand]);

  const selectedFee = fees.find((f) => f.installments === Number(form.installments));
  const qrLink = links.data?.find((l) => l.id === qrId && l.status === 'ACTIVE') ?? null;
  const mailLink = links.data?.find((l) => l.id === mailId && l.status === 'ACTIVE') ?? null;

  const openMail = (id: string) => {
    setMail({ to: '', note: '' });
    setMailError(null);
    setMailId(id);
  };

  const sendMail = async (e: FormEvent) => {
    e.preventDefault();
    if (!mailLink) return;
    setMailError(null);
    setMailBusy(true);
    try {
      await api(`/checkout/links/${mailLink.id}/email`, {
        body: { email: mail.to.trim(), ...(mail.note.trim() ? { message: mail.note.trim() } : {}) },
      });
      setMessage(`Link enviado para ${mail.to.trim()}.`);
      setError(null);
      setMailId(null);
    } catch (err) {
      setMailError(errorText(err));
    } finally {
      setMailBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (form.cents < 1) return setError('Informe o valor do link, por exemplo 49,90.');
    if (form.method === 'CARD' && !selectedFee) return setError('Aguarde o carregamento das taxas do cartão.');
    setBusy(true);
    try {
      await api('/checkout/links', {
        body: {
          description: form.description.trim(),
          amountCents: form.cents,
          method: form.method,
          expiresInMinutes: form.expiresInMinutes,
          ...(form.method === 'CARD' ? { brand: form.brand, installments: Number(form.installments) } : {}),
        },
      });
      setForm({ ...form, description: '', cents: 0 });
      setMessage('Link criado. Ele aparece na lista abaixo, pronto para copiar ou enviar.');
      links.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm('Cancelar este link? Quem abrir verá que ele foi cancelado.')) return;
    try {
      await api(`/checkout/links/${id}/cancel`, { method: 'POST' });
      links.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Links de pagamento" subtitle="Crie um link, envie ao cliente e acompanhe o pagamento em Transações." />
      <ErrorMessage error={error ?? links.error} />
      {message && <Notice>{message}</Notice>}

      <form className="card" onSubmit={submit}>
        <h2>Novo link</h2>
        <Segmented name="method" value={form.method} options={METHODS} onChange={(method) => setForm({ ...form, method })} />
        <div className="row">
          <Field label="Descrição">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required minLength={2} maxLength={255} placeholder="Ex.: Pedido #1042" />
          </Field>
          <Field label="Valor">
            <CurrencyInput value={form.cents} onValueChange={(cents) => setForm({ ...form, cents })} required aria-label="Valor em reais" />
          </Field>
          <Field label="Validade do link">
            <select value={form.expiresInMinutes} onChange={(e) => setForm({ ...form, expiresInMinutes: Number(e.target.value) })}>
              {EXPIRY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        {form.method === 'CARD' && (
          <div className="row">
            <Field label="Bandeira">
              <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value, installments: 1 })}>
                <option value="VISA">Visa</option>
                <option value="MASTERCARD">Mastercard</option>
                <option value="ELO">Elo</option>
              </select>
            </Field>
            <Field label="Parcelas" hint={selectedFee && form.cents > 0 ? `Taxa de ${selectedFee.feePercent.toLocaleString('pt-BR')}% sobre ${formatBRL(form.cents)} = ${formatBRL(feeInCents(form.cents, selectedFee.feePercent))}, descontada do lojista.` : undefined}>
              <select value={form.installments} onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })}>
                {fees.length === 0 && <option value={1}>Carregando taxas...</option>}
                {fees.map((f) => (
                  <option key={f.installments} value={f.installments}>
                    {f.installments}x · taxa {f.feePercent.toLocaleString('pt-BR')}%
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <button className="primary" disabled={busy}>{busy ? 'Criando...' : 'Criar link'}</button>
      </form>

      <div className="card">
        <div className="card-head">
          <h2>Seus links</h2>
          <button type="button" className="small" onClick={links.reload}>Atualizar</button>
        </div>
        {links.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Descrição</th><th>Método</th><th className="num">Valor</th><th>Taxa aplicada</th><th>Status</th><th>Validade</th><th>Ações</th></tr></thead>
              <tbody>
                {links.data.map((l) => {
                  const active = l.status === 'ACTIVE';
                  return (
                    <tr key={l.id}>
                      <td>{l.description}</td>
                      <td>{METHOD_LABEL[l.method]}{l.method === 'CARD' && ` · ${l.brand} ${l.installments}x`}</td>
                      <td className="num">{formatBRL(l.amountCents)}</td>
                      <td>{l.feePercent !== null ? `${l.feePercent.toLocaleString('pt-BR')}% (${formatBRL(l.feeCents)})` : '-'}</td>
                      <td><StatusBadge status={l.status} link /></td>
                      <td>{formatDate(l.expiresAt)}</td>
                      <td className="actions-cell">
                        <div className="actions">
                          { }
                          {active && <CopyButton className="small" text={l.checkoutUrl} label="Copiar link" />}
                          {active && <button type="button" className="small" onClick={() => setQrId(l.id)}>QR Code</button>}
                          {active && <button type="button" className="small" onClick={() => openMail(l.id)}>E-mail</button>}
                          {active && (
                            <a className="btn small" href={whatsappUrl(l)} target="_blank" rel="noreferrer">WhatsApp</a>
                          )}
                          <a className="btn small" href={l.checkoutUrl} target="_blank" rel="noreferrer">Abrir</a>
                          {l.status === 'PAID' && (
                            <RouterLink className="btn small" to={`/comprovante/${l.code}`} target="_blank">Comprovante</RouterLink>
                          )}
                          {active && <button type="button" className="small danger" onClick={() => cancel(l.id)}>Cancelar</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={links.loading ? 'Carregando...' : 'Nenhum link criado'} hint={links.loading ? undefined : 'Preencha o formulário acima para criar o primeiro link de pagamento.'} />
        )}
      </div>

      <Modal open={!!mailLink} onClose={() => setMailId(null)} title="Enviar link por e-mail">
        {mailLink && (
          <form onSubmit={sendMail} style={{ textAlign: 'left' }}>
            <p className="muted">{mailLink.description} · {formatBRL(mailLink.amountCents)}</p>
            <ErrorMessage error={mailError} />
            <Field label="E-mail do cliente">
              <input type="email" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} required maxLength={254} autoComplete="off" autoFocus placeholder="cliente@exemplo.com" />
            </Field>
            <Field label="Mensagem (opcional)">
              <input value={mail.note} onChange={(e) => setMail({ ...mail, note: e.target.value })} maxLength={500} placeholder="Ex.: Obrigado pela compra!" />
            </Field>
            <button className="primary block" disabled={mailBusy}>{mailBusy ? 'Enviando...' : 'Enviar link'}</button>
          </form>
        )}
      </Modal>

      <Modal open={!!qrLink} onClose={() => setQrId(null)} title="QR Code do link">
        {qrLink && (
          <>
            <p className="muted">{qrLink.description} · {formatBRL(qrLink.amountCents)}</p>
            <QrImage text={qrLink.checkoutUrl} size={240} />
            <p className="muted">Aponte a câmera do celular para abrir o link de pagamento.</p>
            <CopyButton className="primary" text={qrLink.checkoutUrl} label="Copiar link" />
          </>
        )}
      </Modal>
    </>
  );
}
