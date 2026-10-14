import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, ErrorMessage, errorText, PageHeader, StatusBadge, useLoad } from '../components/ui';
import { formatBRL, formatDate, METHOD_LABEL } from '../format';

interface Tx {
  id: string;
  code: string;
  description: string;
  method: string;
  brand: string | null;
  installments: number | null;
  amountCents: number;
  feePercent: number | null;
  feeCents: number;
  status: string;
  externalReference: string;
  createdAt: string;
  orderId: string | null;
  failureReason: string | null;
}

const FILTERS = [
  ['', 'Todos'],
  ['APPROVED', 'Sucesso'],
  ['DENIED', 'Falha'],
  ['EXPIRED', 'Expirado'],
  ['CANCELLED', 'Cancelado'],
  ['PENDING', 'Pendente'],
];

export default function TransactionsPage() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const txs = useLoad(() => api<Tx[]>(`/transactions${status ? `?status=${status}` : ''}`), [status]);

  const sync = async (orderId: string) => {
    try {
      await api(`/orders/${orderId}/sync`, { method: 'POST' });
      txs.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Transações" subtitle="Todas as cobranças criadas, com o resultado de cada pagamento." />
      <ErrorMessage error={error ?? txs.error} />
      <div className="card">
        <div className="row end">
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <div style={{ marginBottom: '1rem' }}><button type="button" onClick={txs.reload}>Atualizar</button></div>
        </div>

        {txs.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Descrição</th><th>Método</th><th className="num">Valor</th><th>Taxa</th><th>Status</th><th>Referência</th><th /></tr></thead>
              <tbody>
                {txs.data.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.createdAt)}</td>
                    <td>{t.description}{t.failureReason && <div className="muted">{t.failureReason}</div>}</td>
                    <td>{METHOD_LABEL[t.method]}{t.method === 'CARD' && ` · ${t.installments}x`}</td>
                    <td className="num">{formatBRL(t.amountCents)}</td>
                    <td>{t.feePercent !== null ? `${t.feePercent.toLocaleString('pt-BR')}%` : '-'}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td className="muted">{t.externalReference}</td>
                    <td>
                      <div className="actions">
                        {t.status === 'APPROVED' && <Link className="btn small" to={`/comprovante/${t.code}`} target="_blank">Comprovante</Link>}
                        {t.status === 'PENDING' && t.orderId && <button type="button" className="small" onClick={() => sync(t.orderId!)}>Verificar no gateway</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={txs.loading ? 'Carregando...' : 'Nenhuma transação encontrada'} hint={txs.loading ? undefined : 'Nenhuma cobrança com este status.'} />
        )}
      </div>
    </>
  );
}
