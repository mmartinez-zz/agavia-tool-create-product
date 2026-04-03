import { ToolHandler, ToolResult } from '../types';
import { createProduct } from '../repositories/product.repository';

const TIMEOUT_MS = 3000;

export const createProductTool: ToolHandler = async (
  context,
  args
): Promise<ToolResult> => {
  const title = typeof args.title === 'string' ? args.title.trim() : '';

  if (!title) {
    return { success: false, error: 'VALIDATION_ERROR' };
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
  );

  const product = await Promise.race([
    createProduct({
      businessId: context.businessId,
      title,
      description: args.description ?? null,
      price: typeof args.price === 'number' ? args.price : 0,
      imageUrl: args.imageUrl ?? null,
      sourceUrl: args.sourceUrl ?? null,
      sourceType: args.sourceType ?? null,
    }),
    timeout,
  ]);

  return {
    success: true,
    data: { id: product.id, title: product.title },
  };
};
