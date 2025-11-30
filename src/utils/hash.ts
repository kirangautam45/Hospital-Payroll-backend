import crypto from 'crypto';

export const computeRowHash = (
  pan: string,
  employer: string,
  effectiveFrom: Date | string | null,
  salaryAmount: number
): string => {
  const effectiveFromISO = effectiveFrom
    ? new Date(effectiveFrom).toISOString()
    : '';

  const data = `${pan.trim()}|${employer || ''}|${effectiveFromISO}|${salaryAmount}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};
