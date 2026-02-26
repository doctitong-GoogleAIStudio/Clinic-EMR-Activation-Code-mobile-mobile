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
  const detail = error?.response?.data?.detail;
  if (!detail) return fallback;
  
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
