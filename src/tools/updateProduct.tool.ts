import { Logger } from "@nestjs/common";
import { ToolHandler, ToolResult } from "../types";
import { db } from "../db/db-client";

const logger = new Logger("updateProductTool");

export const updateProductTool: ToolHandler = async (
  context,
  args,
): Promise<ToolResult> => {
  logger.log(`[updateProduct] Request - businessId: ${context.businessId}`);

  const productId = args.productId;

  if (typeof productId !== "string") {
    return {
      success: false,
      error: "VALIDATION_ERROR",
    };
  }

  const existingResult = await db.query(
    `SELECT id, "businessId", "displayId", title, description, price, "imageUrl"
     FROM products
     WHERE "businessId" = $1 AND id = $2 AND is_active = true
     LIMIT 1`,
    [context.businessId, productId],
  );

  const existing = existingResult.rows[0];

  if (!existing) {
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message: "❌ No encontré ese producto para actualizar.",
      },
    };
  }

  // 🔧 BUILD UPDATE
  const dataToUpdate: any = {};

  if (typeof args.title === "string" && args.title.trim() !== "") {
    dataToUpdate.title = args.title.trim();
  }

  if (typeof args.price === "number" && args.price > 0) {
    dataToUpdate.price = args.price;
  }

  if (typeof args.description === "string") {
    dataToUpdate.description = args.description;
  }

  if (typeof args.imageUrl === "string" && args.imageUrl.startsWith("http")) {
    dataToUpdate.imageUrl = args.imageUrl;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message:
          "⚠️ Indícame qué quieres actualizar (precio, título, descripción o imagen).",
      },
    };
  }

  const setClauses: string[] = [];
  const updateParams: any[] = [];
  let paramIndex = 1;

  if (dataToUpdate.title) {
    setClauses.push(`title = $${paramIndex}`);
    updateParams.push(dataToUpdate.title);
    paramIndex++;
  }

  if (dataToUpdate.price !== undefined) {
    setClauses.push(`price = $${paramIndex}`);
    updateParams.push(dataToUpdate.price);
    paramIndex++;
  }

  if (dataToUpdate.description !== undefined) {
    setClauses.push(`description = $${paramIndex}`);
    updateParams.push(dataToUpdate.description);
    paramIndex++;
  }

  if (dataToUpdate.imageUrl) {
    setClauses.push(`"imageUrl" = $${paramIndex}`);
    updateParams.push(dataToUpdate.imageUrl);
    paramIndex++;
  }

  setClauses.push(`"updatedAt" = NOW()`);

  const whereIdIndex = paramIndex;
  const whereBusinessIndex = paramIndex + 1;

  updateParams.push(existing.id);
  updateParams.push(context.businessId);

  const updatedResult = await db.query(
    `UPDATE products
   SET ${setClauses.join(", ")}
   WHERE id = $${whereIdIndex} AND "businessId" = $${whereBusinessIndex}
   RETURNING *`,
    updateParams,
  );
  if (!updatedResult.rows.length) {
    return {
      success: false,
      error: "INTERNAL_ERROR",
    };
  }
  const updated = updatedResult.rows[0];

  if (!updated) {
    return {
      success: false,
      error: "INTERNAL_ERROR",
    };
  }

  // 🎯 RESPONSE UNIFICADA (MISMO CONTRATO QUE CREATE)
  const result = {
    success: true,
    data: {
      id: updated.id,
      displayId: updated.displayId,
      title: updated.title,
      price: updated.price,
      description: updated.description ?? null,

      ...(updated.imageUrl ? { imageUrl: updated.imageUrl } : {}),

      display: [
        { label: "ID", value: updated.displayId },
        { label: "Título", value: updated.title },
        { label: "Precio", value: `$${updated.price.toLocaleString()}` },
      ],
    },
  };

  logger.log(
    `[updateProduct] Response - success: true, displayId: ${updated.displayId}`,
  );
  return result;
};
