const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  statusCode: number;
  error: string;
  code?: string;
  restriction?: any;

  constructor(message: string, statusCode: number, error: string, code?: string, restriction?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.code = code;
    this.restriction = restriction;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('news_share_admin_token') : null;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null as T;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let message = 'Request failed';
    let error = response.statusText || 'Error';
    let code: string | undefined;
    let restriction: any;

    if (data && typeof data === 'object') {
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      } else if (data.message) {
        message = data.message;
      }
      error = data.error || error;
      code = data.code;
      restriction = data.restriction;
    }

    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('news_share_admin_token');
      localStorage.removeItem('news_share_admin_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    throw new ApiError(message, response.status, error, code, restriction);
  }

  return data as T;
}
