import { Router, Request, Response } from 'express';
import { ExecuteRequest } from '../types';
import { executeTool } from '../services/tool.service';

const router = Router();

router.post('/execute', async (req: Request, res: Response) => {
  const body: ExecuteRequest = req.body;

  if (!body.tool || typeof body.tool !== 'string') {
    return res.json({ success: false, error: 'VALIDATION_ERROR' });
  }

  if (!body.args || typeof body.args !== 'object') {
    return res.json({ success: false, error: 'VALIDATION_ERROR' });
  }

  if (!body.context || typeof body.context !== 'object' || !body.context.businessId) {
    return res.json({ success: false, error: 'VALIDATION_ERROR' });
  }

  const result = await executeTool(body.tool, body.context, body.args);
  return res.json(result);
});

export default router;
