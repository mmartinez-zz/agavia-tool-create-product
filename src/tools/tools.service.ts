import { Injectable, Logger } from '@nestjs/common';
import { ToolContext, ToolHandler, ToolResult } from '../common/types';
import { createProductTool } from './handlers/createProduct.handler';
import { extractProductsFromImageTool } from './handlers/extractProductsFromImage.handler';
import { listProductsTool } from './handlers/listProducts.handler';
import { getProductByDisplayIdTool } from './handlers/getProductByDisplayId.handler';
import { updateProductTool } from './handlers/updateProduct.handler';
import { deactivateProductTool } from './handlers/deactivateProduct.handler';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private toolRegistry: Record<string, ToolHandler> = {
    create_product_from_chat: createProductTool,
    extract_products_from_image: extractProductsFromImageTool,
    list_products: listProductsTool,
    get_product_by_displayId: getProductByDisplayIdTool,
    update_product: updateProductTool,
    deactivate_product: deactivateProductTool,
  };

  async execute(
    tool: string,
    context: ToolContext,
    args: Record<string, any>
  ): Promise<ToolResult> {
    this.logger.debug(`[toolService] Resolving tool: ${tool}`);

    const handler = this.toolRegistry[tool];

    if (!handler) {
      this.logger.error(`[TOOL-MS] Tool not found: ${tool}`);
      return { success: false, error: 'VALIDATION_ERROR' };
    }

    this.logger.debug(`[toolService] Executing tool: ${tool}, businessId: ${context.businessId}`);

    try {
      const result = await handler(context, args);

      this.logger.debug(`[toolService] Tool execution completed: ${tool}, success: ${result?.success}`);

      return result;
    } catch (error: any) {
      this.logger.error(`[${tool}] Error: ${error.message}`);
      if (error.message === 'TIMEOUT') {
        return { success: false, error: 'TIMEOUT' };
      }
      return { success: false, error: 'INTERNAL_ERROR' };
    }
  }
}
