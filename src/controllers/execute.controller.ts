import { Router, Request, Response } from 'express';
import { ExecuteRequest } from '../types';
import { executeTool } from '../services/tool.service';

const router = Router();

router.post('/execute', async (req: Request, res: Response) => {
  const body: ExecuteRequest = req.body;

  console.info('[execute] Request', {
    tool: body.tool,
    businessId: body.context?.businessId,
    args: body.args
  });

  if (!body.tool || typeof body.tool !== 'string') {
    return res.json({ success: false, error: 'VALIDATION_ERROR: body.tool must be a string' });
  }

  if (!body.args || typeof body.args !== 'object') {
    return res.json({ success: false, error: 'VALIDATION_ERROR: body.args must be an object' });
  }

  if (!body.context || typeof body.context !== 'object' || !body.context.businessId) {
    return res.json({ success: false, error: 'VALIDATION_ERROR: body.context must be an object with businessId' });
  }

  console.debug('[execute] Request validated', {
    tool: body.tool,
    businessId: body.context.businessId
  });

  const result = await executeTool(body.tool, body.context, body.args);

  console.info('[execute] Response', {
    tool: body.tool,
    success: result?.success ?? false
  });

  return res.json(result);
});

export default router;
