import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Extract error message from API error response
 * Handles both string errors and Pydantic validation error arrays
 */
export function getErrorMessage(error, fallback = 'An error occurred') {
  // Request never reached the API (offline, DNS, timeout, CORS)
  if (error?.isAxiosError && !error.response) {
    return 'Cannot reach the server. Check your internet connection and try again.';
  }

  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  if (!detail) {
    // Gateway/proxy answered instead of the API (backend down or not deployed)
    if ([404, 502, 503, 504].includes(status)) {
      return `The server is currently unavailable (HTTP ${status}). Please try again later.`;
    }
    return fallback;
  }
  
  // Handle Pydantic validation errors (array of objects)
  if (Array.isArray(detail)) {
    return detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  
  // Handle string errors
  if (typeof detail === 'string') {
    return detail;
  }
  
  // Handle object errors
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  
  return fallback;
}
