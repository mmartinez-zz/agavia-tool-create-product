import { Logger } from "@nestjs/common";
import { ToolHandler, ToolResult } from "../types";
import { db } from "../db/db-client";

const logger = new Logger("getProductByDisplayIdTool");

export const getProductByDisplayIdTool: ToolHandler = async (
  context,
  args,
): Promise<ToolResult> => {
  logger.log(
    `[getProductByDisplayId] Request - businessId: ${context.businessId}, displayId: ${args.displayId}`,
  );

  const displayId = args.displayId;

  if (
    typeof displayId !== "number" ||
    !Number.isInteger(displayId) ||
    displayId <= 0
  ) {
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message: `El dato que ingresaste es incorrecto.`,
      },
    };
  }

  const result = await db.query(
    `SELECT id, "businessId", "displayId", title, description, price, "imageUrl"
     FROM products
     WHERE "businessId" = $1 AND "displayId" = $2 AND is_active = true
     LIMIT 1`,
    [context.businessId, displayId],
  );

  const product = result.rows[0];

  if (!product) {
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message: `No se encontró un producto con ID ${displayId}`,
      },
    };
  }

  const response = {
    success: true,
    data: {
      product: {
        productId: product.id,
        displayId: product.displayId,
        title: product.title,
        price: product.price,
      },
      display: [
        { label: "ID", value: product.displayId },
        { label: "Título", value: product.title },
        { label: "Precio", value: `$${product.price.toLocaleString()}` },
        ...(product.description
          ? [{ label: "Descripción", value: product.description }]
          : []),
      ],
      imageUrl: product.imageUrl || null,
    },
  };

  logger.log(
    `[getProductByDisplayId] Response - success: true, displayId: ${product.displayId}`,
  );
  return response;
};
