import type { ReactNode } from 'react';
import { STATUS_LABEL, type AccountStatus } from '../lib/constants';

export function Loading({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="skeleton" />
      <div className="skeleton" style={{ height: 60 }} />
      <p className="small">{label}</p>
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div className="notice error" role="alert">{error}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function StatusBadge({ status }: { status: AccountStatus | string }) {
  const cls = status === 'approved' ? 'ok' : status === 'rejected' || status === 'blocked' ? 'bad' : status === 'needs_info' ? 'warn' : '';
  return <span className={`badge ${cls}`}>{STATUS_LABEL[status as AccountStatus] ?? status}</span>;
}

export function Avatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <div className="avatar" aria-hidden="true">
      {src ? <img src={src} alt="" /> : name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Noma’lum xato yuz berdi';
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('uz-UZ').format(n) + ' so‘m';
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
}
