/**
 * Convert a date string (YYYY-MM-DD) to ISO format with timezone
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} ISO formatted date string
 */
export function toISODateWithTimezone(dateString) {
  if (!dateString) return null
  
  // Create date from string and convert to ISO
  const date = new Date(dateString)
  return date.toISOString()
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
