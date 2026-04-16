import { Logger } from "@nestjs/common";
import { ToolHandler, ToolResult } from "../types";
import { createProduct } from "../repositories/product.repository";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { db } from "../db/db-client";

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

async function getBusinessCredentials(businessId: string) {
  const result = await db.query(
    `SELECT "twilioAccountSid", "twilioAuthToken" FROM businesses WHERE id = $1 LIMIT 1`,
    [businessId],
  );

  if (result.rows.length === 0) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const business = result.rows[0];

  return {
    twilioAccountSid: business.twilioAccountSid,
    twilioAuthToken: business.twilioAuthToken,
  };
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
      const credentials = await getBusinessCredentials(businessId);

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

  const title = typeof args.title === "string" ? args.title.trim() : "";

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
    finalImageUrl = await processImage(args.imageUrl, context.businessId);
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS),
  );

  if (typeof args.price !== "number") {
    return {
      success: true,
      data: {
        type: "BUSINESS_ERROR",
        message: "⚠️ Necesito un precio válido para crear el producto.",
      },
    };
  }

  let product;

  try {
    product = await Promise.race([
      createProduct({
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
      return { success: false, error: "TIMEOUT" };
    }

    logger.error(`[createProduct] Error - ${error.message}`);

    return { success: false, error: "INTERNAL_ERROR" };
  }

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
