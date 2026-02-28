import { Router } from 'express';
import { healthcheck, triggerError } from '#controllers/healthcheck.controller.js';

const router = Router();

router.route('/').get(healthcheck);
router.route('/error').get(triggerError);

export default router;
