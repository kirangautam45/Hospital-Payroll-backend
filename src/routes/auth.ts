import { Router } from 'express';
import { register, login, refresh, logout, logoutAll, getAllUsers } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/users', getAllUsers);

export default router;
