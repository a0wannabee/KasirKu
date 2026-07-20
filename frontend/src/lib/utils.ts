export function formatIDR(amount: number | string | undefined | null): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num === undefined || num === null || isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'OWNER':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'MANAGER':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'KASIR':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'GUDANG':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    default:
      return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
}

export function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'POSTED':
    case 'VERIFIED':
    case 'SUCCESS':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'NEEDS_VERIFICATION':
    case 'PENDING':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'VOID':
    case 'FAILED':
    case 'DAMAGED':
    case 'LOST':
    case 'EXPIRED':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    case 'PARTIALLY_RETURNED':
    case 'STOCK_OPNAME':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}
