import { Logger } from "@nestjs/common";
import { ToolHandler, ToolResult } from "../../common/types";
import { ProductsService } from "../../products/products.service";

const logger = new Logger("updateProductTool");

export const updateProductTool: ToolHandler = async (
  context,
  args,
): Promise<ToolResult> => {
  logger.log(`[updateProduct] Request - businessId: ${context.businessId}`);
  logger.debug(`[updateProduct] Args received:`, JSON.stringify(args));

  const productId = args.productId;
  logger.debug(`[updateProduct] ProductId: ${productId}`);

  if (typeof productId !== "string") {
    logger.debug(`[updateProduct] Invalid productId type: ${typeof productId}`);
    return {
      success: false,
      error: "VALIDATION_ERROR",
    };
  }

  logger.debug(`[updateProduct] Calling repository.getProductById`);
  const repository = ProductsService.getRepository();
  const existing = await repository.getProductById(context.businessId, productId);

  if (!existing) {
    logger.debug(`[updateProduct] Product not found`);
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message: "❌ No encontré ese producto para actualizar.",
      },
    };
  }

  logger.debug(`[updateProduct] Product found - id: ${existing.id}, displayId: ${existing.displayId}`);

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

  logger.debug(`[updateProduct] Fields to update:`, Object.keys(dataToUpdate));

  if (Object.keys(dataToUpdate).length === 0) {
    logger.debug(`[updateProduct] No fields to update`);
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message:
          "⚠️ Indícame qué quieres actualizar (precio, título, descripción o imagen).",
      },
    };
  }

  logger.debug(`[updateProduct] Calling repository.updateProduct`);
  const updated = await repository.updateProduct({
    id: existing.id,
    businessId: context.businessId,
    title: dataToUpdate.title,
    price: dataToUpdate.price,
    description: dataToUpdate.description,
    imageUrl: dataToUpdate.imageUrl,
  });

  if (!updated) {
    logger.error(`[updateProduct] Update failed - no result from repository`);
    return {
      success: false,
      error: "INTERNAL_ERROR",
    };
  }

  logger.debug(`[updateProduct] Product updated successfully - id: ${updated.id}`);

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
