/**
 * apiFetch - Wrapper around fetch that prevents browser caching for API calls.
 * Adds a cache-busting timestamp parameter to every GET request.
 */
export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  // Only add cache-busting for GET requests (no body)
  if (!options || (!options.method || options.method === 'GET')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}_t=${Date.now()}`;
  }
  return fetch(url, options);
}
