import { Request, Response, NextFunction } from 'express';

// Nepali PAN format: 9 digits, or account number: 13-17 digits
const PAN_REGEX = /^[0-9]{9}$/;
const ACCOUNT_REGEX = /^[0-9]{13,17}$/;

export const validatePAN = (pan: string): boolean => {
  const trimmed = pan.trim();
  return PAN_REGEX.test(trimmed) || ACCOUNT_REGEX.test(trimmed);
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
