import { Router } from 'express';
import { authController } from '#controllers/auth.controller.js';
import { authMiddleware } from '#middlewares/auth.middleware.js';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/profile', authMiddleware, authController.profile);

export default router;