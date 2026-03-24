
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Skip client creation if the URL is not a valid HTTP/HTTPS URL
const isValidUrl = (url: string) => {
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

// Create a mock that allows chaining and is awaitable
const createMockProxy = (): any => {
  const mockResult = { data: [], error: null, count: 0, head: null, status: 200, statusText: 'OK' };
  const target = () => {};
  
  return new Proxy(target, {
    get: (t, prop) => {
      if (prop === 'then') {
        return (resolve: any) => Promise.resolve(mockResult).then(resolve);
      }
      // Return a function that returns the proxy to allow chaining: .from('table').select('*')
      return () => createMockProxy();
    }
  });
};

export const supabase = isValidUrl(supabaseUrl) && !supabaseUrl.includes('your_supabase_url')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockProxy();
