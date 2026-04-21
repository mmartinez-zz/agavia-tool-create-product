import { Logger } from '@nestjs/common';
import { ToolHandler, ToolResult } from "../../common/types";
import { ProductsService } from "../../products/products.service";

const logger = new Logger('deactivateProductTool');

const TIMEOUT_MS = 5000;

export const deactivateProductTool: ToolHandler = async (
  context,
  args
): Promise<ToolResult> => {
  logger.log(`[deactivateProduct] Request - businessId: ${context.businessId}, productId: ${args.productId}`);
  logger.debug(`[deactivateProduct] Args received:`, JSON.stringify(args));

  const productId = args.productId;
  logger.debug(`[deactivateProduct] ProductId: ${productId}`);

  if (!productId) {
    logger.debug(`[deactivateProduct] Missing productId`);
    return { success: false, error: "VALIDATION_ERROR" };
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)
  );

  try {
    logger.debug(`[deactivateProduct] Calling repository.deactivateProduct`);
    const repository = ProductsService.getRepository();
    const result = await Promise.race([
      repository.deactivateProduct(context.businessId, productId),
      timeout,
    ]);

    logger.debug(`[deactivateProduct] Repository result - rowCount: ${result.rowCount}`);

    if (result.rowCount === 0) {
      logger.debug(`[deactivateProduct] Product not found or already deactivated`);
      return {
        success: true,
        data: {
          type: "BUSINESS_ERROR",
          message: "❌ No encontré un producto activo con ese ID.",
        },
      };
    }

    const product = result.product;
    logger.debug(`[deactivateProduct] Product deactivated successfully - id: ${product.id}, title: "${product.title}"`);

    return {
      success: true,
      data: {
        id: product.id,
        title: product.title,
        status: "deactivated",
        display: [
          { label: "Producto", value: product.title },
          { label: "Estado", value: "Desactivado" },
        ],
      },
    };
  } catch (error) {
    logger.error(`[deactivateProduct] Error: ${(error as Error).message}`, (error as Error).stack);
    if ((error as Error).message === "TIMEOUT") {
      logger.error(`[deactivateProduct] Timeout deactivating product`);
      return { success: false, error: "TIMEOUT" };
    }
    return {
      success: false,
      error: "INTERNAL_ERROR",
    };
  }
};