export const formatNumber = (num: number | string, mode: 'short' | 'full' = 'short'): string => {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';

  if (mode === 'full') {
    return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  if (Math.abs(n) >= 1000000000000) {
    return `${(n / 1000000000000).toFixed(2)} 兆`;
  }
  if (Math.abs(n) >= 100000000) {
    return `${(n / 100000000).toFixed(2)} 億`;
  }
  if (Math.abs(n) >= 10000) {
    return `${(n / 10000).toFixed(2)} 萬`;
  }

  // Max 2 decimal places for values < 10000
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const formatCurrency = (num: number | string): string => {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
