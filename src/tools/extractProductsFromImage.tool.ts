import { ToolHandler, ToolResult } from "../types";
import { createProduct } from "../repositories/product.repository";

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
  description: string;
}

async function callOpenAI(imageUrl: string): Promise<ExtractedProduct[]> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
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

  const outputText =
    data.output_text || data.output?.[0]?.content?.[0]?.text || "";
  if (!outputText) {
    return [];
  }

  try {
    const jsonMatch = outputText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
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

    let created = 0;
    for (const product of validProducts) {
      try {
        await createProduct({
          businessId: context.businessId,
          title: product.title.trim(),
          description: product.description || null,
          price: product.price,
          imageUrl: args.imageUrl,
          sourceType: "image_extraction",
        });
        created++;
      } catch (error) {
        console.error(`Failed to create product: ${error}`);
      }
    }

    return {
      success: true,
      data: { created },
    };
  } catch (error: any) {
    if (error.message === "TIMEOUT") {
      throw error;
    }
    return { success: false, error: "INTERNAL_ERROR" };
  }
};
