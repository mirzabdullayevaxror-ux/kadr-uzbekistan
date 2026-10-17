import { useEffect, useState } from 'react';

// Hash-based routing: #/talent/username, #/vacancy/<id>, ...
function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function useHashRoute(): [string, (path: string) => void] {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = (p: string) => {
    window.location.hash = p;
    window.scrollTo({ top: 0 });
  };
  return [path, navigate];
}

export function go(path: string) {
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
}

// Simple route matcher: match('/talent/:username', path) -> { username }
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('?')[0].split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) out[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return out;
}
