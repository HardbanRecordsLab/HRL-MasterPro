import axios from 'axios';

// Pobieranie adresu API z Biblii 2026 / .env
const HRL_API_URL = import.meta.env.VITE_HRL_API_URL || 'https://api-sync.hardbanrecordslab.online';

/**
 * HRL BRIDGE CLIENT
 * Udaje strukturę Supabase SDK, ale przesyła dane do zunifikowanego backendu na VPS.
 */
class HRLBridge {
  private tableName: string = '';

  from(table: string) {
    this.tableName = table;
    return this;
  }

  async select(columns: string = '*') {
    try {
      const response = await axios.get(`${HRL_API_URL}/api/${this.tableName}`, {
        params: { select: columns },
        headers: this.getHeaders()
      });
      return { data: response.data, error: null };
    } catch (err: any) {
      return { data: null, error: err.response?.data || err.message };
    }
  }

  async insert(values: any) {
    try {
      const response = await axios.post(`${HRL_API_URL}/api/${this.tableName}`, values, {
        headers: this.getHeaders()
      });
      return { data: response.data, error: null };
    } catch (err: any) {
      return { data: null, error: err.response?.data || err.message };
    }
  }

  async update(values: any) {
    return { 
      eq: async (column: string, value: any) => {
        try {
          const response = await axios.patch(`${HRL_API_URL}/api/${this.tableName}`, values, {
            params: { [column]: value },
            headers: this.getHeaders()
          });
          return { data: response.data, error: null };
        } catch (err: any) {
          return { data: null, error: err.response?.data || err.message };
        }
      }
    };
  }

  async delete() {
     return { 
      eq: async (column: string, value: any) => {
        try {
          await axios.delete(`${HRL_API_URL}/api/${this.tableName}`, {
            params: { [column]: value },
            headers: this.getHeaders()
          });
          return { data: true, error: null };
        } catch (err: any) {
          return { data: null, error: err.response?.data || err.message };
        }
      }
    };
  }

  // Symulacja API Auth Supabase
  auth = {
    getUser: async () => {
       const token = localStorage.getItem('hrl_token');
       if (!token) return { data: { user: null }, error: 'No session' };
       // Tutaj docelowo weryfikacja w Twoim SSO Hub na porcie 9107
       return { data: { user: { id: 'vps-user-id' } }, error: null };
    },
    signInWithPassword: async (creds: any) => {
       const response = await axios.post(`${HRL_API_URL}/api/auth/login`, creds);
       localStorage.setItem('hrl_token', response.data.token);
       return { data: response.data, error: null };
    }
  }

  private getHeaders() {
    const token = localStorage.getItem('hrl_token');
    return {
      'Authorization': `Bearer ${token}`,
      'X-HRL-Source': 'VPS-Direct'
    };
  }
}

export const supabase = new HRLBridge() as any;