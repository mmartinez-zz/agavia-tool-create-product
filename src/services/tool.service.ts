import { ToolContext, ToolHandler, ToolResult } from '../types';
import { createProductTool } from '../tools/createProduct.tool';

const toolRegistry: Record<string, ToolHandler> = {
  create_product_from_chat: createProductTool,
};

export async function executeTool(
  tool: string,
  context: ToolContext,
  args: Record<string, any>
): Promise<ToolResult> {
  const handler = toolRegistry[tool];

  if (!handler) {
    return { success: false, error: 'VALIDATION_ERROR' };
  }

  try {
    return await handler(context, args);
  } catch (error: any) {
    console.error(`[${tool}] Error: ${error.message}`);
    if (error.message === 'TIMEOUT') {
      return { success: false, error: 'TIMEOUT' };
    }
    return { success: false, error: 'INTERNAL_ERROR' };
  }
}
