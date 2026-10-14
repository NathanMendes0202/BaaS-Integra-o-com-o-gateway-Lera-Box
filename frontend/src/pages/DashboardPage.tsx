import { Link } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, useLoad } from '../components/ui';
import { formatBRL, formatDate, METHOD_LABEL } from '../format';

interface Tx {
  id: string;
  code: string;
  description: string;
  method: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const account = useLoad(() => api<{ connected: boolean }>('/gateway/account'));
  const connected = account.data?.connected;
  const balance = useLoad(
    () => (connected ? api<{ balanceCents: number }>('/wallet') : Promise.resolve(null)),
    [connected],
  );
  const txs = useLoad(() => api<Tx[]>('/transactions?limit=5'));

  return (
    <>
      <PageHeader title="Painel" subtitle="Seu saldo e as últimas vendas." />
      {account.data && !connected && (
        <p className="alert warn">
          Conecte sua conta do gateway para criar links e ver o saldo. <Link to="/gateway">Conectar agora</Link>
        </p>
      )}
      <ErrorMessage error={balance.error ?? txs.error} />

      <div className="card balance-card">
        <h2>Saldo na carteira</h2>
        <div className="balance">{connected && balance.data ? formatBRL(balance.data.balanceCents) : '-'}</div>
        <Link className="btn" to="/carteira">Ver extrato e solicitar saque</Link>
      </div>

      <div className="card">
        <h2>Últimas transações</h2>
        {txs.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Descrição</th><th>Método</th><th className="num">Valor</th><th>Status</th></tr></thead>
              <tbody>
                {txs.data.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.createdAt)}</td>
                    <td>{t.description}</td>
                    <td>{METHOD_LABEL[t.method]}</td>
                    <td className="num">{formatBRL(t.amountCents)}</td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhuma transação ainda" hint="Crie um link de pagamento e envie ao seu primeiro cliente." action={<Link className="btn primary" to="/links">Criar link de pagamento</Link>} />
        )}
      </div>
    </>
  );
}
