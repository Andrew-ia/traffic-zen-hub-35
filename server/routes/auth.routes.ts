import { Router } from 'express';
import { login, me, createUser } from '../api/auth';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/me', authMiddleware, me);
router.post('/users', authMiddleware, adminOnly, createUser);

export default router;
