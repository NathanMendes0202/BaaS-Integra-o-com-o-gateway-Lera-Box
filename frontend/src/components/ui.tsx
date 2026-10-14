import QRCode from 'qrcode';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';
import { LINK_STATUS_LABEL, STATUS_LABEL } from '../format';

export function ErrorMessage({ error }: { error: string | null }) {
  return error ? <p className="alert error" role="alert">{error}</p> : null;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="alert ok" role="status">{children}</p>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

export function StatusBadge({ status, link }: { status: string; link?: boolean }) {
  const label = (link ? LINK_STATUS_LABEL : STATUS_LABEL)[status] ?? status;
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

export const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Erro inesperado';

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loader());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

export function QrImage({ text, size = 220 }: { text: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then((url: string) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [text, size]);
  return src ? (
    <img className="qr" src={src} alt="QR Code" width={size} height={size} />
  ) : (
    <p className="muted center-text">Gerando QR Code...</p>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

export function CopyButton({ text, label = 'Copiar', className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await copyText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? 'Copiado!' : label}
    </button>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="modal-body">
          <header>
            <h2>{title}</h2>
            <button type="button" className="icon" aria-label="Fechar" onClick={onClose}>×</button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
