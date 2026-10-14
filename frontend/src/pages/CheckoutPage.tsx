import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { MaskedInput, Field } from '../components/inputs';
import { CopyButton, ErrorMessage, errorText, QrImage } from '../components/ui';
import {
  applyMask,
  BRAND_LABEL,
  CARD_PATTERN,
  detectBrand,
  formatBRL,
  formatCardNumber,
  formatCpfCnpj,
  formatExpiry,
  parseExpiry,
} from '../format';

interface PublicLink {
  code: string;
  description: string;
  method: 'PIX' | 'CARD';
  amountCents: number;
  brand: string | null;
  installments: number | null;
  feePercent: number | null;
  status: 'ACTIVE' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  merchantName: string | null;
  order: { status: string; pixEmv: string | null; pixQrCodeBase64: string | null; failureReason: string | null } | null;
}

const FINAL_MESSAGE: Record<string, string> = {
  PAID: 'Pagamento aprovado. Obrigado!',
  FAILED: 'O pagamento foi negado. Confira os dados e tente novamente.',
  EXPIRED: 'Este link expirou. Peça um novo link ao lojista.',
  CANCELLED: 'Este link foi cancelado pelo lojista.',
};

function CardPreview({ number, holder, expiry }: { number: string; holder: string; expiry: string }) {
  const brand = detectBrand(number);
  return (
    <div className="cc" data-brand={brand ?? ''} aria-hidden="true">
      <div className="cc-top">
        <span className="cc-chip" />
        <span>{brand ? BRAND_LABEL[brand] : ''}</span>
      </div>
      <div className="cc-number">{applyMask(number, CARD_PATTERN, '•')}</div>
      <div className="cc-bottom">
        <span>{holder || 'Nome no cartão'}</span>
        <span>{applyMask(expiry, '00/00', '•')}</span>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const { code = '' } = useParams();
  const [link, setLink] = useState<PublicLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payer, setPayer] = useState({ name: '', document: '' });
  const [card, setCard] = useState({ holderName: '', number: '', expiry: '', cvv: '' });

  const load = useCallback(async () => {
    try {
      setLink(await api<PublicLink>(`/checkout/public/${code}`, { auth: false }));
    } catch (e) {
      setError(errorText(e));
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (link?.status !== 'PROCESSING') return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [link?.status, load]);

  const payPix = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (payer.document.length !== 11 && payer.document.length !== 14) {
      return setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) completo.');
    }
    setBusy(true);
    try {
      setLink(
        await api<PublicLink>(`/checkout/public/${code}/pix`, {
          auth: false,
          body: { payerName: payer.name.trim(), payerDocument: payer.document },
        }),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const payCard = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (card.number.length < 13) return setError('Informe o número completo do cartão.');
    const expiry = parseExpiry(card.expiry);
    if (!expiry) return setError('Validade inválida ou vencida. Use o formato MM/AA.');
    if (card.cvv.length < 3) return setError('Informe o código de segurança (CVV) do cartão.');
    setBusy(true);
    try {
      setLink(
        await api<PublicLink>(`/checkout/public/${code}/card`, {
          auth: false,
          body: {
            holderName: card.holderName.trim(),
            number: card.number,
            expMonth: expiry.month,
            expYear: expiry.year,
            cvv: card.cvv,
          },
        }),
      );
      setCard({ ...card, number: '', cvv: '' });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const alreadyPaid = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api<PublicLink>(`/checkout/public/${code}/check`, { method: 'POST', auth: false });
      setLink(res);
      if (res.status === 'PROCESSING') {
        setNotice('Ainda não identificamos o pagamento. Aguarde alguns instantes e toque em "Já paguei" novamente.');
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (!link) {
    return (
      <div className="pay" style={{ gridTemplateColumns: '1fr' }}>
        {error ? <ErrorMessage error={error} /> : <p className="muted">Carregando...</p>}
      </div>
    );
  }

  const checkoutUrl = `${window.location.origin}/pagar/${link.code}`;
  const emv = link.order?.pixEmv ?? null;
  const gatewayQr = link.order?.pixQrCodeBase64 ?? null;
  const gatewayQrSrc = gatewayQr ? (gatewayQr.startsWith('data:') ? gatewayQr : `data:image/png;base64,${gatewayQr}`) : null;
  const detected = detectBrand(card.number);
  const canPay = link.status === 'ACTIVE' || link.status === 'FAILED';
  const wrongBrand = !!detected && !!link.brand && detected !== link.brand;
  const unknownBrand = card.number.length >= 6 && !detected;

  return (
    <div className="pay">
      <section className="pay-summary" aria-label="Resumo da cobrança">
        <p className="merchant">{link.merchantName ?? 'Pagamento'}</p>
        <h1>{link.description}</h1>
        <div className="amount">{formatBRL(link.amountCents)}</div>
        {link.method === 'CARD' && (
          <p className="muted">
            {link.brand ? BRAND_LABEL[link.brand] : 'Cartão'} em {link.installments}x
            {link.feePercent !== null && ` · taxa de ${link.feePercent.toLocaleString('pt-BR')}% já considerada`}
          </p>
        )}
        {link.method === 'PIX' && <p className="muted">Pagamento por Pix, confirmado em instantes.</p>}
      </section>

      <section className="card pay-panel" aria-live="polite">
        <ErrorMessage error={error} />

        {FINAL_MESSAGE[link.status] && (
          <>
            <p className={`alert ${link.status === 'PAID' ? 'ok' : 'error'}`}>{FINAL_MESSAGE[link.status]}</p>
            {link.status === 'PAID' && <Link className="btn primary" to={`/comprovante/${link.code}`}>Ver comprovante</Link>}
          </>
        )}

        {link.status === 'PROCESSING' && link.method === 'PIX' && (
          <>
            <h2>Pague com Pix</h2>
            { }
            {emv ? (
              <>
                <p className="muted center-text">Escaneie o QR Code no app do seu banco ou use o Pix copia e cola.</p>
                <QrImage text={emv} />
                <div className="emv">{emv}</div>
                <p style={{ marginTop: '.75rem' }}><CopyButton className="block" text={emv} label="Copiar código Pix" /></p>
              </>
            ) : gatewayQrSrc ? (
              <>
                <p className="muted center-text">Escaneie o QR Code no app do seu banco.</p>
                <img className="qr" src={gatewayQrSrc} alt="QR Code Pix" />
              </>
            ) : (
              <>
                <p className="muted center-text">Escaneie o QR Code para abrir este link de pagamento.</p>
                <QrImage text={checkoutUrl} />
              </>
            )}
            <p className="muted center-text">Aguardando a confirmação do pagamento...</p>
            <button className="primary block" onClick={alreadyPaid} disabled={busy}>
              {busy ? 'Verificando...' : 'Já paguei'}
            </button>
            {notice && <p className="alert warn" style={{ marginTop: '.75rem' }}>{notice}</p>}
          </>
        )}

        {link.status === 'PROCESSING' && link.method === 'CARD' && (
          <p className="alert warn">Pagamento em processamento. Esta página será atualizada automaticamente.</p>
        )}

        {canPay && link.method === 'PIX' && (
          <form onSubmit={payPix}>
            <h2>Seus dados</h2>
            <Field label="Nome completo">
              <input value={payer.name} onChange={(e) => setPayer({ ...payer, name: e.target.value })} required minLength={2} autoComplete="name" />
            </Field>
            <Field label="CPF ou CNPJ">
              <MaskedInput
                value={payer.document}
                onValueChange={(document) => setPayer({ ...payer, document })}
                format={formatCpfCnpj}
                placeholder="000.000.000-00"
                autoComplete="off"
                required
              />
            </Field>
            <button className="primary block" disabled={busy}>{busy ? 'Gerando...' : 'Gerar QR Code Pix'}</button>
          </form>
        )}

        {canPay && link.method === 'CARD' && (
          <form onSubmit={payCard}>
            <h2>Pague com cartão</h2>
            <CardPreview number={card.number} holder={card.holderName} expiry={card.expiry} />
            <Field label="Número do cartão" hint={wrongBrand ? `Este link aceita apenas cartões ${BRAND_LABEL[link.brand!]}.` : unknownBrand ? 'Não reconhecemos a bandeira deste número. O gateway aceita apenas Visa, Mastercard e Elo.' : undefined}>
              <MaskedInput
                value={card.number}
                onValueChange={(number) => setCard({ ...card, number })}
                format={formatCardNumber}
                placeholder="0000-0000-0000-0000"
                autoComplete="cc-number"
                required
              />
            </Field>
            <Field label="Nome impresso no cartão">
              <input value={card.holderName} onChange={(e) => setCard({ ...card, holderName: e.target.value })} required minLength={3} maxLength={120} autoComplete="cc-name" />
            </Field>
            <div className="row">
              <Field label="Validade">
                <MaskedInput
                  value={card.expiry}
                  onValueChange={(expiry) => setCard({ ...card, expiry })}
                  format={formatExpiry}
                  placeholder="MM/AA"
                  autoComplete="cc-exp"
                  required
                />
              </Field>
              <Field label="CVV">
                <MaskedInput
                  value={card.cvv}
                  onValueChange={(cvv) => setCard({ ...card, cvv: cvv.slice(0, 4) })}
                  format={(d) => d.slice(0, 4)}
                  placeholder="000"
                  autoComplete="cc-csc"
                  required
                />
              </Field>
            </div>
            <button className="primary block" disabled={busy || wrongBrand}>{busy ? 'Processando...' : `Pagar ${formatBRL(link.amountCents)}`}</button>
            <p className="secure-note">Os dados do cartão são enviados direto para processamento e não ficam salvos.</p>
          </form>
        )}
      </section>
    </div>
  );
}
