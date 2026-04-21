import { Controller, Post, Body } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ToolsService } from '../tools/tools.service';
import { ExecuteRequest, ToolResult } from '../common/types';

@Controller()
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly toolsService: ToolsService,
  ) {}

  @Post('/execute')
  async execute(@Body() body: ExecuteRequest): Promise<ToolResult> {
    console.info('[execute] Request', {
      tool: body.tool,
      businessId: body.context?.businessId,
      args: body.args,
    });

    if (!body.tool || typeof body.tool !== 'string') {
      return { success: false, error: 'VALIDATION_ERROR' };
    }

    if (!body.args || typeof body.args !== 'object') {
      return { success: false, error: 'VALIDATION_ERROR' };
    }

    if (!body.context || typeof body.context !== 'object' || !body.context.businessId) {
      return { success: false, error: 'VALIDATION_ERROR' };
    }

    console.debug('[execute] Request validated', {
      tool: body.tool,
      businessId: body.context.businessId,
    });

    const result = await this.toolsService.execute(body.tool, body.context, body.args);

    console.info('[execute] Response', {
      tool: body.tool,
      success: result?.success,
    });

    return result;
  }
}
