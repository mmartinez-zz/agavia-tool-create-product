import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ExecuteRequest } from '../types';
import { ToolsService } from './tools.service';

@Controller()
export class ToolsController {
  private readonly logger = new Logger(ToolsController.name);

  constructor(private readonly toolsService: ToolsService) {}

  @Post('execute')
  async execute(@Body() body: ExecuteRequest) {
    this.logger.log(`[execute] Request - tool: ${body.tool}, businessId: ${body.context?.businessId}`);

    if (!body.tool || typeof body.tool !== 'string') {
      return { success: false, error: 'VALIDATION_ERROR: body.tool must be a string' };
    }

    if (!body.args || typeof body.args !== 'object') {
      return { success: false, error: 'VALIDATION_ERROR: body.args must be an object' };
    }

    if (!body.context || typeof body.context !== 'object' || !body.context.businessId) {
      return { success: false, error: 'VALIDATION_ERROR: body.context must be an object with businessId' };
    }

    this.logger.debug(`[execute] Request validated - tool: ${body.tool}, businessId: ${body.context.businessId}`);

    const result = await this.toolsService.execute(body.tool, body.context, body.args);

    this.logger.log(`[execute] Response - tool: ${body.tool}, success: ${result?.success ?? false}`);

    return result;
  }
}
