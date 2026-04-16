import { db } from '../db/db-client';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProductData {
  businessId: string;
  title: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  keywords?: string[];
}

export async function createProduct(data: CreateProductData) {
  const lastResult = await db.query(
    `SELECT "displayId" FROM products WHERE "businessId" = $1 ORDER BY "displayId" DESC LIMIT 1`,
    [data.businessId]
  );

  const nextDisplayId = (lastResult.rows[0]?.displayId || 0) + 1;

  const normalizedKeywords = (data.keywords || [])
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length > 2);

  const id = uuidv4();
  const now = new Date();

  const result = await db.query(
    `INSERT INTO products (
      id, "businessId", "displayId", title, description, price, "imageUrl", "sourceUrl", "sourceType", keywords, "createdAt", "updatedAt", is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      id,
      data.businessId,
      nextDisplayId,
      data.title,
      data.description || null,
      data.price || 0,
      data.imageUrl || null,
      data.sourceUrl || null,
      data.sourceType || null,
      normalizedKeywords,
      now,
      now,
      true
    ]
  );

  return result.rows[0];
}
