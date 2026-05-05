import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../infrastructure/db/database.service';

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

export interface ListProductsParams {
  businessId: string;
  whereClauses: string[];
  params: any[];
  orderClause: string;
  limit: number;
  offset: number;
  paramIndex: number;
}

export interface UpdateProductData {
  id: string;
  businessId: string;
  title?: string;
  price?: number;
  description?: string;
  imageUrl?: string;
}

@Injectable()
export class ProductRepository {
  constructor(private readonly db: DatabaseService) {}

  async createProduct(data: CreateProductData) {
    const lastResult = await this.db.query(
      `SELECT "displayId" FROM products WHERE "businessId" = $1 ORDER BY "displayId" DESC LIMIT 1`,
      [data.businessId]
    );

    const nextDisplayId = (lastResult.rows[0]?.displayId || 0) + 1;

    const normalizedKeywords = (data.keywords || [])
      .map(k => k.toLowerCase().trim())
      .filter(k => k.length > 2);

    const id = crypto.randomUUID();
    const now = new Date();

    const result = await this.db.query(
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

  async getBusinessCredentials(businessId: string) {
    const result = await this.db.query(
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

  async listProducts(queryParams: ListProductsParams) {
    const { whereClauses, params, orderClause, limit, offset, paramIndex } = queryParams;
    const whereClause = whereClauses.join(" AND ");

    const [productsResult, countResult] = await Promise.all([
      this.db.query(
        `SELECT id, "businessId", "displayId", title, description, price, "imageUrl", "createdAt"
         FROM products
         WHERE ${whereClause}
         ORDER BY ${orderClause}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset],
      ),
      this.db.query(
        `SELECT COUNT(*) as count FROM products WHERE ${whereClause}`,
        [...params],
      ),
    ]);

    return {
      products: productsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async getProductByDisplayId(businessId: string, displayId: number) {
    const result = await this.db.query(
      `SELECT id, "businessId", "displayId", title, description, price, "imageUrl"
       FROM products
       WHERE "businessId" = $1 AND "displayId" = $2 AND is_active = true
       LIMIT 1`,
      [businessId, displayId],
    );

    return result.rows[0] || null;
  }

  async getProductById(businessId: string, productId: string) {
    const result = await this.db.query(
      `SELECT id, "businessId", "displayId", title, description, price, "imageUrl"
       FROM products
       WHERE "businessId" = $1 AND id = $2 AND is_active = true
       LIMIT 1`,
      [businessId, productId],
    );

    return result.rows[0] || null;
  }

  async updateProduct(data: UpdateProductData) {
    const setClauses: string[] = [];
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (data.title) {
      setClauses.push(`title = $${paramIndex}`);
      updateParams.push(data.title);
      paramIndex++;
    }

    if (data.price !== undefined) {
      setClauses.push(`price = $${paramIndex}`);
      updateParams.push(data.price);
      paramIndex++;
    }

    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      updateParams.push(data.description);
      paramIndex++;
    }

    if (data.imageUrl) {
      setClauses.push(`"imageUrl" = $${paramIndex}`);
      updateParams.push(data.imageUrl);
      paramIndex++;
    }

    setClauses.push(`"updatedAt" = NOW()`);

    const whereIdIndex = paramIndex;
    const whereBusinessIndex = paramIndex + 1;

    updateParams.push(data.id);
    updateParams.push(data.businessId);

    const result = await this.db.query(
      `UPDATE products
     SET ${setClauses.join(", ")}
     WHERE id = $${whereIdIndex} AND "businessId" = $${whereBusinessIndex}
     RETURNING *`,
      updateParams,
    );

    return result.rows[0] || null;
  }

  async updateKeywords(productId: string, businessId: string, keywords: string[]) {
    const normalizedKeywords = keywords
      .map((k) => k.toLowerCase().trim())
      .filter((k) => k.length > 2);

    await this.db.query(
      `UPDATE products SET keywords = $1, "updatedAt" = NOW() WHERE id = $2 AND "businessId" = $3`,
      [normalizedKeywords, productId, businessId],
    );
  }

  async deactivateProduct(businessId: string, productId: string) {
    const result = await this.db.query(
      `UPDATE products
      SET
        is_active = false,
        deleted_at = NOW()
      WHERE id = $1
        AND "businessId" = $2
        AND is_active = true
      RETURNING id, title`,
      [productId, businessId]
    );

    return {
      rowCount: result.rowCount || 0,
      product: result.rows[0] || null,
    };
  }
}
