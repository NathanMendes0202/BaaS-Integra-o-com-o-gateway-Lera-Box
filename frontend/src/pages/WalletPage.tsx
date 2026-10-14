import { FormEvent, useState } from 'react';
import { api } from '../api';
import { CurrencyInput, Field, MaskedInput } from '../components/inputs';
import { EmptyState, ErrorMessage, errorText, Notice, PageHeader, StatusBadge, useLoad } from '../components/ui';
import { formatBRL, formatCpf, formatDate } from '../format';

interface StatementItem {
  gatewayId: string;
  type: string | null;
  status: string;
  amountCents: number;
  externalReference: string | null;
  description: string | null;
  occurredAt: string | null;
  reconciled: boolean;
  local: { kind: string; linkCode?: string | null } | null;
}

interface Withdrawal {
  id: string;
  externalReference: string;
  amountCents: number;
  destinationType: 'PIX';
  destination: Record<string, string>;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

export default function WalletPage() {
  const balance = useLoad(() => api<{ balanceCents: number }>('/wallet'));
  const [filters, setFilters] = useState({ status: '', type: '', limit: '50' });
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const statement = useLoad(() => api<StatementItem[]>(`/wallet/transactions?${query}`), [query]);
  const withdrawals = useLoad(() => api<Withdrawal[]>('/withdrawals'));

  const [form, setForm] = useState({ cents: 0, pixKey: '', document: '' });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (form.cents < 1) return setError('Informe o valor do saque, por exemplo 100,00.');
    if (form.document.length !== 11) return setError('Informe o CPF completo do titular da chave Pix (11 dígitos).');
    setBusy(true);
    try {
      await api('/withdrawals', {
        body: { amountCents: form.cents, pixKey: form.pixKey.trim(), document: form.document },
      });
      setMessage('Saque solicitado. O resultado final chega por webhook; você também pode atualizar o status abaixo.');
      setForm({ ...form, cents: 0, pixKey: '' });
      withdrawals.reload();
      balance.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async (id: string) => {
    try {
      await api(`/withdrawals/${id}`);
      withdrawals.reload();
      balance.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const f = form;
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  return (
    <>
      <PageHeader title="Carteira e saques" subtitle="Acompanhe o saldo, retire o dinheiro por Pix e confira o extrato do gateway." />
      <ErrorMessage error={error ?? balance.error ?? statement.error ?? withdrawals.error} />
      {message && <Notice>{message}</Notice>}

      <div className="card balance-card">
        <h2>Saldo disponível</h2>
        <div className="balance">{balance.data ? formatBRL(balance.data.balanceCents) : '-'}</div>
        <button type="button" className="small" onClick={balance.reload}>Atualizar saldo</button>
      </div>

      <form className="card" onSubmit={submit}>
        <h2>Solicitar saque</h2>
        <div className="row">
          <Field label="Valor do saque">
            <CurrencyInput value={f.cents} onValueChange={(cents) => set({ cents })} required aria-label="Valor do saque em reais" />
          </Field>
          <Field label="Chave Pix de destino">
            <input value={f.pixKey} onChange={(e) => set({ pixKey: e.target.value })} required minLength={3} placeholder="CPF, e-mail, telefone ou chave aleatória" />
          </Field>
          <Field label="CPF do titular da chave">
            <MaskedInput value={f.document} onValueChange={(document) => set({ document })} format={formatCpf} placeholder="000.000.000-00" required />
          </Field>
        </div>
        <button className="primary" disabled={busy}>{busy ? 'Enviando...' : 'Solicitar saque'}</button>
      </form>

      <div className="card">
        <h2>Saques</h2>
        {withdrawals.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Destino</th><th className="num">Valor</th><th>Status</th><th /></tr></thead>
              <tbody>
                {withdrawals.data.map((w) => (
                  <tr key={w.id}>
                    <td>{formatDate(w.createdAt)}</td>
                    <td>Pix: {w.destination.pixKey}</td>
                    <td className="num">{formatBRL(w.amountCents)}</td>
                    <td><StatusBadge status={w.status} />{w.failureReason && <div className="muted">{w.failureReason}</div>}</td>
                    <td>{w.status === 'PENDING' && <button onClick={() => refresh(w.id)}>Atualizar status</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum saque solicitado" hint="Os saques que você pedir aparecem aqui com o status atualizado." />
        )}
      </div>

      <div className="card">
        <h2>Extrato do gateway</h2>
        <div className="row" style={{ alignItems: 'end' }}>
          <label>Status
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Todos</option>
              <option value="APPROVED">Sucesso</option>
              <option value="DENIED">Falha</option>
              <option value="PENDING">Pendente</option>
            </select>
          </label>
          <label>Tipo<input value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} placeholder="ex.: PIX" /></label>
          <label>Limite
            <select value={filters.limit} onChange={(e) => setFilters({ ...filters, limit: e.target.value })}>
              <option>20</option><option>50</option><option>100</option>
            </select>
          </label>
          <div><button type="button" onClick={statement.reload}>Atualizar</button></div>
        </div>
        {statement.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th className="num">Valor</th><th>Status</th><th>Conciliação</th></tr></thead>
              <tbody>
                {statement.data.map((t) => (
                  <tr key={t.gatewayId}>
                    <td>{formatDate(t.occurredAt)}</td>
                    <td>{t.type ?? '-'}</td>
                    <td>{t.description ?? '-'}<div className="muted">{t.externalReference}</div></td>
                    <td className="num">{formatBRL(t.amountCents)}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>{t.reconciled ? (t.local?.kind === 'ORDER' ? `Pedido (link ${t.local.linkCode})` : 'Saque') : <span className="muted">Sem vínculo local</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={statement.loading ? 'Carregando...' : 'Nenhuma movimentação encontrada'} hint={statement.loading ? undefined : 'Tente mudar os filtros do extrato.'} />
        )}
      </div>
    </>
  );
}
