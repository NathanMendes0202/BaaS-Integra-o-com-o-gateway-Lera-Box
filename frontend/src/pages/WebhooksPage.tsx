import { useState } from 'react';
import { api } from '../api';
import { CopyButton, EmptyState, ErrorMessage, errorText, Notice, PageHeader, useLoad } from '../components/ui';
import { formatDate } from '../format';

interface Config {
  callbackUrl: string;
  events: string[];
  hooks: { id: string; url: string | null; event: string | null }[];
}
interface EventRow {
  id: string;
  eventType: string | null;
  status: string;
  signatureValid: boolean;
  gatewayStatus: string | null;
  reference: string | null;
  error: string | null;
  createdAt: string;
}

const GATEWAY_STATUS: Record<string, string> = {
  APPROVED: 'Aprovado',
  DENIED: 'Negado',
  CANCELLED: 'Cancelado',
  CANCELED: 'Cancelado',
  EXPIRED: 'Expirado',
  PENDING: 'Pendente',
};

const EVENT_STATUS: Record<string, string> = {
  PROCESSED: 'Processado',
  IGNORED: 'Ignorado',
  FAILED: 'Falhou',
  RECEIVED: 'Recebido',
};

export default function WebhooksPage() {
  const config = useLoad(() => api<Config>('/webhooks/config'));
  const events = useLoad(() => api<EventRow[]>('/webhooks/events'));
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const register = async () => {
    setError(null);
    setMessage(null);
    setWarning(null);
    setBusy(true);
    try {
      const res = await api<{ warning?: string }>('/webhooks/config', { method: 'POST', body: baseUrl ? { baseUrl } : {} });
      setMessage('Webhooks PAYMENT_PIX, PAYMENT_CARD e WITHDRAWAL cadastrados no gateway.');
      setWarning(res.warning ?? null);
      config.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/webhooks/config/${encodeURIComponent(id)}`, { method: 'DELETE' });
      config.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Webhooks" subtitle="É por aqui que o gateway avisa quando um pagamento ou saque termina." />
      <ErrorMessage error={error ?? config.error ?? events.error} />
      {message && <Notice>{message}</Notice>}
      {warning && <p className="alert warn">{warning}</p>}

      <div className="card">
        <h2>Cadastrar no gateway</h2>
        <p className="muted">
          O gateway precisa alcançar a API pela internet. Em ambiente local use um túnel (ngrok, cloudflared) e informe abaixo a URL pública da SUA API (nunca a do gateway).
          Se o webhook não chegar, use "Verificar no gateway" em Transações.
        </p>
        <label>URL pública da API (opcional)
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://meu-tunel.ngrok.app" />
        </label>
        {config.data && (
          <p>URL que será cadastrada: <code>{config.data.callbackUrl}</code> <CopyButton text={config.data.callbackUrl} /></p>
        )}
        <button className="primary" onClick={register} disabled={busy}>{busy ? 'Cadastrando...' : 'Cadastrar webhooks'}</button>
      </div>

      <div className="card">
        <h2>Webhooks cadastrados no gateway</h2>
        {config.data?.hooks.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Evento</th><th>URL</th><th /></tr></thead>
              <tbody>
                {config.data.hooks.map((h) => (
                  <tr key={h.id}>
                    <td>{h.event}</td>
                    <td style={{ wordBreak: 'break-all' }}>{h.url}</td>
                    <td><button type="button" className="small danger" onClick={() => remove(h.id)}>Remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum webhook cadastrado" hint="Cadastre os webhooks acima para receber os resultados automaticamente." />
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Eventos recebidos</h2>
          <button type="button" className="small" onClick={events.reload}>Atualizar</button>
        </div>
        {events.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Recebido em</th><th>Evento</th><th>Status no gateway</th><th>Referência</th><th>Assinatura</th><th>Processamento</th></tr></thead>
              <tbody>
                {events.data.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.createdAt)}</td>
                    <td>{e.eventType ?? '-'}</td>
                    <td>{e.gatewayStatus ? (GATEWAY_STATUS[e.gatewayStatus] ?? e.gatewayStatus) : '-'}</td>
                    <td className="muted">{e.reference ?? '-'}</td>
                    <td>{e.signatureValid ? 'Válida' : 'Não verificada'}</td>
                    <td>{EVENT_STATUS[e.status] ?? e.status}{e.error && <div className="muted">{e.error}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum evento recebido ainda" hint="Quando o gateway chamar a API, o evento aparece aqui." />
        )}
      </div>
    </>
  );
}
