import { FormEvent, useState } from 'react';
import { api } from '../api';
import { Field, MaskedInput } from '../components/inputs';
import { ErrorMessage, errorText, Notice, PageHeader, useLoad } from '../components/ui';
import { formatCep, formatCnpj, formatCpf, formatCpfCnpj, formatDate, formatPhone } from '../format';

interface AccountInfo {
  connected: boolean;
  document?: string;
  clientCode?: string | null;
  storeKeyHint?: string | null;
  connectedAt?: string;
}

const emptyReg = { personType: 'PF', name: '', document: '', email: '', phone: '', zipCode: '', address: '', number: '', neighborhood: '', city: '', state: '' };

export default function GatewayPage() {
  const account = useLoad(() => api<AccountInfo>('/gateway/account'));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [document, setDocument] = useState('');
  const [password, setPassword] = useState('');
  const [reg, setReg] = useState(emptyReg);

  const isPF = reg.personType === 'PF';
  const docLength = isPF ? 11 : 14;

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (document.length !== 11 && document.length !== 14) return setError('Informe o CPF ou CNPJ completo da conta do gateway.');
    try {
      await api('/gateway/connect', { body: { document, password } });
      setPassword('');
      setMessage('Conta do gateway conectada.');
      account.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const register = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (reg.document.length !== docLength) return setError(`Informe o ${isPF ? 'CPF (11 dígitos)' : 'CNPJ (14 dígitos)'} completo.`);
    if (reg.phone.length < 10) return setError('Informe o telefone com DDD.');
    if (reg.zipCode.length !== 8) return setError('Informe o CEP completo (8 dígitos).');
    try {
      const res = await api<{ message: string }>('/gateway/register', {
        body: { ...reg, name: reg.name.trim(), state: reg.state.toUpperCase() },
      });
      setMessage(res.message);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const disconnect = async () => {
    if (!confirm('Desconectar a conta do gateway? Você não poderá criar links nem sacar até reconectar.')) return;
    try {
      await api('/gateway/account', { method: 'DELETE' });
      account.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const info = account.data;
  const set = (patch: Partial<typeof reg>) => setReg({ ...reg, ...patch });

  return (
    <>
      <PageHeader title="Conta no gateway" subtitle="O gateway processa seus pagamentos. Conecte uma conta existente ou crie uma nova." />
      <ErrorMessage error={error ?? account.error} />
      {message && <Notice>{message}</Notice>}

      {info?.connected && (
        <div className="card balance-card">
          <div className="card-head">
            <h2>Conta conectada</h2>
            <button type="button" className="small danger" onClick={disconnect}>Desconectar</button>
          </div>
          <p>Documento: <strong>{formatCpfCnpj(info.document ?? '')}</strong></p>
          <p>Código do cliente: <strong>{info.clientCode ?? '-'}</strong> · Chave da loja: <strong>{info.storeKeyHint ?? '-'}</strong></p>
          <p className="muted">Conectada em {formatDate(info.connectedAt)}. O token fica guardado criptografado no servidor.</p>
        </div>
      )}

      <form className="card" onSubmit={connect}>
        <h2>{info?.connected ? 'Reconectar' : 'Já tenho conta no gateway'}</h2>
        <div className="row">
          <Field label="CPF ou CNPJ">
            <MaskedInput value={document} onValueChange={setDocument} format={formatCpfCnpj} placeholder="000.000.000-00" required />
          </Field>
          <Field label="Senha do gateway">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="off" />
          </Field>
        </div>
        <p className="muted">A senha é enviada uma única vez ao nosso servidor, que a guarda criptografada. Ela nunca volta ao navegador.</p>
        <button className="primary">Conectar</button>
      </form>

      <form className="card" onSubmit={register}>
        <h2>Criar conta no gateway</h2>
        <p className="muted">Use e-mail e telefone reais: o gateway envia documento, senha, CodigoCliente e ChaveLoja por e-mail. CPF e CNPJ podem ser fictícios.</p>
        <div className="row">
          <Field label="Tipo de pessoa">
            <select value={reg.personType} onChange={(e) => set({ personType: e.target.value, document: reg.document.slice(0, e.target.value === 'PF' ? 11 : 14) })}>
              <option value="PF">Pessoa física</option>
              <option value="PJ">Pessoa jurídica</option>
            </select>
          </Field>
          <Field label={isPF ? 'Nome completo' : 'Razão social'}>
            <input value={reg.name} onChange={(e) => set({ name: e.target.value })} required minLength={2} />
          </Field>
        </div>
        <div className="row">
          <Field label={isPF ? 'CPF' : 'CNPJ'}>
            <MaskedInput value={reg.document} onValueChange={(d) => set({ document: d })} format={isPF ? formatCpf : formatCnpj} placeholder={isPF ? '000.000.000-00' : '00.000.000/0000-00'} required />
          </Field>
          <Field label="E-mail">
            <input type="email" value={reg.email} onChange={(e) => set({ email: e.target.value })} required autoComplete="email" />
          </Field>
          <Field label="Telefone com DDD">
            <MaskedInput type="tel" value={reg.phone} onValueChange={(d) => set({ phone: d })} format={formatPhone} placeholder="(00) 00000-0000" autoComplete="tel-national" required />
          </Field>
        </div>
        <div className="row">
          <Field label="CEP">
            <MaskedInput value={reg.zipCode} onValueChange={(d) => set({ zipCode: d })} format={formatCep} placeholder="00000-000" autoComplete="postal-code" required />
          </Field>
          <Field label="Endereço">
            <input value={reg.address} onChange={(e) => set({ address: e.target.value })} required minLength={3} autoComplete="address-line1" />
          </Field>
          <Field label="Número">
            <input value={reg.number} onChange={(e) => set({ number: e.target.value })} required />
          </Field>
        </div>
        <div className="row">
          <Field label="Bairro">
            <input value={reg.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} required minLength={2} />
          </Field>
          <Field label="Cidade">
            <input value={reg.city} onChange={(e) => set({ city: e.target.value })} required minLength={2} autoComplete="address-level2" />
          </Field>
          <Field label="UF">
            <input value={reg.state} maxLength={2} onChange={(e) => set({ state: e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase() })} required minLength={2} autoComplete="address-level1" />
          </Field>
        </div>
        <button className="primary">Cadastrar no gateway</button>
      </form>
    </>
  );
}
