import { Router } from 'express';
import {
  getPersonByPAN,
  getPersonSummary,
  exportPersonData,
  searchPAN,
  getAllPersons
} from '../controllers/personController';
import { authenticate } from '../middleware/auth';
import { validatePANParam } from '../middleware/validate';

const router = Router();

// Search and list
router.get('/search', authenticate, searchPAN);
router.get('/list', authenticate, getAllPersons);

// Individual person routes (must come after /search and /list)
router.get('/:pan', authenticate, validatePANParam, getPersonByPAN);
router.get('/:pan/summary', authenticate, validatePANParam, getPersonSummary);
router.get('/:pan/export', authenticate, validatePANParam, exportPersonData);

export default router;
