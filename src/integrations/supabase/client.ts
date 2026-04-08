// HRL Bridge — zastepuje Supabase SDK wywolaniami do backendu VPS
// Module: masterpro
// Nie zawiera zadnych kluczy API ani sekretow

const MODULE_URL = (import.meta.env.VITE_ACCESS_MANAGER_URL as string)
  .replace('hrl-access', 'masterpro');

class HRLBridge {
  from(table: string) {
    return {
      select: async (columns = '*') => {
        try {
          const res = await fetch(`${MODULE_URL}/api/${table}?select=${columns}`, { credentials: 'include' });
          return { data: await res.json(), error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
      },
      insert: async (values: any) => {
        try {
          const res = await fetch(`${MODULE_URL}/api/${table}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(values) });
          return { data: await res.json(), error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
      },
      update: (values: any) => ({ eq: async (col: string, val: any) => {
        try {
          const res = await fetch(`${MODULE_URL}/api/${table}?${col}=${encodeURIComponent(val)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(values) });
          return { data: await res.json(), error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
      }}),
      delete: () => ({ eq: async (col: string, val: any) => {
        try {
          await fetch(`${MODULE_URL}/api/${table}?${col}=${encodeURIComponent(val)}`, { method: 'DELETE', credentials: 'include' });
          return { data: true, error: null };
        } catch (err: any) { return { data: null, error: err.message }; }
      }}),
    };
  }
  auth = {
    getSession: async () => {
      try {
        const res = await fetch(`${MODULE_URL}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) return { data: { session: null }, error: 'Unauthorized' };
        return { data: { session: { user: await res.json() } }, error: null };
      } catch (err: any) { return { data: { session: null }, error: err.message }; }
    },
    getUser: async () => {
      try {
        const res = await fetch(`${MODULE_URL}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) return { data: { user: null }, error: 'Unauthorized' };
        return { data: { user: await res.json() }, error: null };
      } catch (err: any) { return { data: { user: null }, error: err.message }; }
    },
    signOut: async () => {
      try { await fetch(`${MODULE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }); } catch {}
      return { error: null };
    },
  };
  async rpc(fn: string, params?: Record<string, any>) {
    try {
      const res = await fetch(`${MODULE_URL}/api/rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(params ?? {}) });
      return { data: await res.json(), error: null };
    } catch (err: any) { return { data: null, error: err.message }; }
  }
}

export const supabase = new HRLBridge();
