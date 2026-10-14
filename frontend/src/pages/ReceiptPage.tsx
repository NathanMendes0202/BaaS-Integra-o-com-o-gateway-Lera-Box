import { useParams } from 'react-router-dom';
import { api } from '../api';
import { ErrorMessage, useLoad } from '../components/ui';
import { formatBRL, formatDate, METHOD_LABEL } from '../format';

interface Receipt {
  code: string;
  merchantName: string | null;
  description: string;
  method: string;
  amountCents: number;
  installments: number | null;
  payerName: string | null;
  reference: string;
  paidAt: string | null;
}
export default function ReceiptPage() {
  const { code = '' } = useParams();
  const { data, error } = useLoad(() => api<Receipt>(`/checkout/public/${code}/receipt`, { auth: false }), [code]);

  return (
    <div className="receipt-wrap receipt">
      <ErrorMessage error={error} />
      {data && (
        <div className="card">
          <h1>Comprovante de pagamento</h1>
          <dl>
            <dt>Recebedor:</dt><dd>{data.merchantName ?? '-'}</dd>
            <dt>Descrição:</dt><dd>{data.description}</dd>
            <dt>Valor:</dt><dd><strong>{formatBRL(data.amountCents)}</strong></dd>
            <dt>Forma de pagamento:</dt>
            <dd>{METHOD_LABEL[data.method]}{data.method === 'CARD' && data.installments ? ` em ${data.installments}x` : ''}</dd>
            <dt>Pagador:</dt><dd>{data.payerName ?? '-'}</dd>
            <dt>Data:</dt><dd>{formatDate(data.paidAt)}</dd>
            <dt>Referência:</dt><dd>{data.reference}</dd>
          </dl>
          <button type="button" className="no-print primary" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>
        </div>
      )}
    </div>
  );
}
