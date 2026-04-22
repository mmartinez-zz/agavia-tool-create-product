import { Logger } from "@nestjs/common";
import { ToolHandler, ToolResult } from "../../common/types";
import { ProductsService } from "../../products/products.service";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const logger = new Logger("createProductTool");

const TIMEOUT_MS = 5000;

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return supabaseClient;
}

async function processImage(
  imageUrl: string,
  businessId: string,
): Promise<string> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("INVALID_IMAGE_URL");
  }

  if (parsedUrl.hostname.includes("supabase")) {
    return imageUrl;
  }

  const isTwilio = parsedUrl.hostname.includes("twilio");
  try {
    let response;

    if (isTwilio) {
      const repository = ProductsService.getRepository();
      const credentials = await repository.getBusinessCredentials(businessId);

      if (!credentials.twilioAccountSid || !credentials.twilioAuthToken) {
        throw new Error("MISSING_TWILIO_CREDENTIALS");
      }

      const auth = Buffer.from(
        `${credentials.twilioAccountSid}:${credentials.twilioAuthToken}`,
      ).toString("base64");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        response = await fetch(imageUrl, {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        response = await fetch(imageUrl, {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!response.ok) {
      throw new Error("IMAGE_DOWNLOAD_FAILED");
    }

    const contentType = response.headers.get("content-type");

    if (!contentType || !contentType.startsWith("image/")) {
      throw new Error("INVALID_IMAGE_TYPE");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error("IMAGE_TOO_LARGE");
    }

    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    const fileName = `products/${businessId}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.jpg`;

    const supabase = getSupabaseClient();

    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(fileName, optimizedBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      throw new Error("SUPABASE_UPLOAD_FAILED");
    }

    const { data: publicUrl } = supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .getPublicUrl(fileName);

    return publicUrl.publicUrl;
  } catch (error) {
    logger.error(
      `[processImage] Failed - error: ${(error as Error).message}, imageUrl: ${imageUrl}, businessId: ${businessId}, isTwilio: ${isTwilio}`,
    );

    return imageUrl;
  }
}

export const createProductTool: ToolHandler = async (
  context,
  args,
): Promise<ToolResult> => {
  logger.log(`[createProduct] Request - businessId: ${context.businessId}`);
  logger.debug(`[createProduct] Args received:`, JSON.stringify(args));

  const title = typeof args.title === "string" ? args.title.trim() : "";
  logger.debug(`[createProduct] Title extracted: "${title}"`);

  if (!title) {
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message: "⚠️ Necesito un título para crear el producto.",
      },
    };
  }

  let finalImageUrl: string | null = null;

  if (args.imageUrl) {
    logger.debug(`[createProduct] Processing image: ${args.imageUrl}`);
    finalImageUrl = await processImage(args.imageUrl, context.businessId);
    logger.debug(`[createProduct] Image processed: ${finalImageUrl}`);
  } else {
    logger.debug(`[createProduct] No image provided`);
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS),
  );

  if (typeof args.price !== "number") {
    logger.debug(`[createProduct] Invalid price type: ${typeof args.price}`);
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message: "⚠️ Necesito un precio válido para crear el producto.",
      },
    };
  }

  logger.debug(`[createProduct] Price validated: ${args.price}`);

  let product;

  try {
    logger.debug(`[createProduct] Calling repository.createProduct`);
    const repository = ProductsService.getRepository();
    product = await Promise.race([
      repository.createProduct({
        businessId: context.businessId,
        title,
        description: args.description ?? null,
        price: typeof args.price === "number" ? args.price : 0,
        imageUrl: finalImageUrl,
        sourceUrl: args.sourceUrl ?? null,
        sourceType: args.sourceType ?? null,
        keywords: context.keywords || [],
      }),
      timeout,
    ]);
  } catch (error: any) {
    if (error.message === "TIMEOUT") {
      logger.error(`[createProduct] Timeout creating product`);
      return { success: false, error: "TIMEOUT" };
    }

    logger.error(`[createProduct] Error - ${error.message}`, error.stack);

    return { success: false, error: "INTERNAL_ERROR" };
  }

  logger.debug(`[createProduct] Product created successfully - id: ${product.id}, displayId: ${product.displayId}`);

  const result = {
    success: true,
    data: {
      id: product.id,
      displayId: product.displayId,
      title: product.title,
      price: product.price,
      imageUrl: product.imageUrl,
      description: product.description,
      display: [
        { label: "ID", value: product.displayId },
        { label: "Título", value: product.title },
        { label: "Precio", value: `$${product.price}` },
        ...(product.description
          ? [{ label: "Descripción", value: product.description }]
          : []),
      ],
    },
  };

  logger.log(
    `[createProduct] Response - success: ${result.success}, displayId: ${product.displayId}`,
  );
  return result;
};
