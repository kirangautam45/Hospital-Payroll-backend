import { Request, Response, NextFunction } from 'express';

// Nepali PAN format: 9 digits, or account number: 13-17 digits
const PAN_REGEX = /^[0-9]{9}$/;
const ACCOUNT_REGEX = /^[0-9]{13,17}$/;

// More flexible validation: any numeric string with 1-17 digits
const FLEXIBLE_PAN_REGEX = /^[0-9]{1,17}$/;

export const validatePAN = (pan: string): boolean => {
  const trimmed = pan.trim();
  return PAN_REGEX.test(trimmed) || ACCOUNT_REGEX.test(trimmed);
};

// Flexible validation for Excel uploads - accepts any numeric string
export const validatePANFlexible = (pan: string): boolean => {
  const trimmed = pan.trim();
  return FLEXIBLE_PAN_REGEX.test(trimmed) && trimmed.length > 0;
};

// Normalize PAN: pad with leading zeros if less than 9 digits
export const normalizePAN = (pan: string): string => {
  const trimmed = pan.trim().replace(/[^0-9]/g, '');
  if (trimmed.length === 0) return '';
  // If it's 1-8 digits, pad to 9 digits (standard PAN)
  if (trimmed.length < 9) {
    return trimmed.padStart(9, '0');
  }
  return trimmed;
};

export const validatePANParam = (req: Request, res: Response, next: NextFunction): void => {
  const { pan } = req.params;

  if (!pan || !validatePAN(pan)) {
    res.status(400).json({ error: 'Invalid PAN format. Expected 9 digits.' });
    return;
  }

  req.params.pan = pan.trim();
  next();
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
