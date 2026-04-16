import { Logger } from '@nestjs/common';
import { ToolHandler, ToolResult } from "../types";
import { db } from "../db/db-client";

const logger = new Logger('deactivateProductTool');

const TIMEOUT_MS = 5000;

export const deactivateProductTool: ToolHandler = async (
  context,
  args
): Promise<ToolResult> => {
  logger.log(`[deactivateProduct] Request - businessId: ${context.businessId}, productId: ${args.productId}`);

  const productId = args.productId;

  if (!productId) {
    return { success: false, error: "VALIDATION_ERROR" };
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([
      db.query(
        `
        UPDATE products
        SET
          is_active = false,
          deleted_at = NOW()
        WHERE id = $1
          AND "businessId" = $2
          AND is_active = true
        RETURNING id, title
        `,
        [productId, context.businessId]
      ),
      timeout,
    ]);

    if (result.rowCount === 0) {
      return {
        success: true,
        data: {
          type: "BUSINESS_ERROR",
          message: "❌ No encontré un producto activo con ese ID.",
        },
      };
    }

    const product = result.rows[0];

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
    logger.error(`[deactivateProduct] Error: ${(error as Error).message}`);
    if ((error as Error).message === "TIMEOUT") {
      return { success: false, error: "TIMEOUT" };
    }
    return {
      success: false,
      error: "INTERNAL_ERROR",
    };
  }
};