import { Logger } from "@nestjs/common";
import { ToolHandler, ToolResult } from "../types";

const logger = new Logger("extractProductsFromImageTool");

const TIMEOUT_MS = 3000;

const PROMPT = `Analiza la imagen y extrae TODOS los productos visibles.

Devuelve SOLO un JSON válido con este formato:

[
  {
    "title": "string",
    "price": number,
    "description": "string"
  }
]

Reglas:

* Cada producto debe ser independiente
* El precio debe estar en pesos colombianos (COP)
* El precio debe ser un número entero sin puntos ni comas (ej: 1399000)
* NO inventes información
* NO incluyas productos sin precio visible
* NO mezcles datos entre productos
* Si no estás seguro del precio, NO incluyas ese producto

Devuelve SOLO el JSON, sin texto adicional.`;

interface ExtractedProduct {
  title: string;
  price: number;
  description?: string;
}

async function callOpenAI(imageUrl: string): Promise<ExtractedProduct[]> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: PROMPT,
            },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("OPENAI_ERROR");
  }

  const data: any = await response.json();

  logger.debug("[extractProductsFromImage] OpenAI raw response received");

  const outputText =
    data.output_text || data.output?.[0]?.content?.[0]?.text || "";

  logger.debug(
    `[extractProductsFromImage] OpenAI output text: ${outputText.substring(0, 100)}...`,
  );
  if (!outputText) {
    logger.debug("[extractProductsFromImage] No products extracted from image");
    return [];
  }

  try {
    const jsonMatch = outputText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.debug(
        "[extractProductsFromImage] Failed to parse OpenAI response",
      );
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const products = Array.isArray(parsed) ? parsed : [];
    logger.debug(
      `[extractProductsFromImage] Parsed products count: ${products.length}`,
    );
    return products;
  } catch {
    logger.debug("[extractProductsFromImage] Failed to parse OpenAI response");
    return [];
  }
}

function isValidProduct(product: any): product is ExtractedProduct {
  return (
    typeof product.title === "string" &&
    product.title.trim().length > 0 &&
    typeof product.price === "number" &&
    Number.isFinite(product.price) &&
    product.price > 0
  );
}

export const extractProductsFromImageTool: ToolHandler = async (
  context,
  args,
): Promise<ToolResult> => {
  logger.log(
    `[extractProductsFromImage] Request - businessId: ${context.businessId}`,
  );

  if (!args.imageUrl || typeof args.imageUrl !== "string") {
    return { success: false, error: "VALIDATION_ERROR" };
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS),
  );

  try {
    const extractedProducts = await Promise.race([
      callOpenAI(args.imageUrl),
      timeout,
    ]);

    const validProducts = extractedProducts.filter(isValidProduct);

    logger.debug(
      `[extractProductsFromImage] Valid products count: ${validProducts.length}`,
    );

    if (validProducts.length === 0) {
      return {
        success: true,
        data: {
          type: "BUSINESS_ERROR",
          message: "⚠️ No encontré productos válidos en la imagen.",
        },
      };
    }
    const normalizedProducts = validProducts.map((p) => ({
      title: p.title.trim(),
      price: p.price,
      description:
        typeof p.description === "string" ? p.description.trim() : "",
    }));
    const result = {
      success: true,
      data: {
        products: normalizedProducts,
        count: normalizedProducts.length,
        display: normalizedProducts.map((p, i) => ({
          label: `${i + 1}. ${p.title}`,
          value: `$${p.price.toLocaleString()}`,
        })),
      },
    };

    logger.log(
      `[extractProductsFromImage] Response - success: true, count: ${validProducts.length}`,
    );
    return result;
  } catch (error: any) {
    logger.log(
      `[extractProductsFromImage] Response - success: false, error: ${error.message}`,
    );

    if (error.message === "TIMEOUT") {
      return { success: false, error: "TIMEOUT" };
    }
    return { success: false, error: "INTERNAL_ERROR" };
  }
};
