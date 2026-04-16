import { Logger } from "@nestjs/common";
import { ToolHandler, ToolResult } from "../types";
import { db } from "../db/db-client";

const logger = new Logger("listProductsTool");

function buildDateFilter(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } | null {
  const from = parseISODate(dateFrom);
  const to = parseISODate(dateTo);

  if (!from && !to) return null;
  if (from && to && from > to) return null;

  const filter: { gte?: Date; lte?: Date } = {};
  if (from) filter.gte = from;
  if (to) filter.lte = to;

  return filter;
}

function parseISODate(value?: string): Date | null {
  if (!value) return null;

  const date = new Date(value);

  if (isNaN(date.getTime())) return null;

  return date;
}

export const listProductsTool: ToolHandler = async (
  context,

  args,
): Promise<ToolResult> => {
  logger.log(`[listProducts] Request - businessId: ${context.businessId}`);

  const limit = Math.min(args.limit || 10, 50);
  const offset = Math.max(args.offset || 0, 0);
  const filters = args.filters || {};
  const text: string | undefined = filters.text?.trim();
  const businessId = context.businessId;
  const orderField = args.orderBy || "createdAt";
  const orderDirection = args.orderDirection || "desc";

  const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo);

  const searchTokens = text
    ? text
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0)
    : [];

  let whereClauses: string[] = [`"businessId" = $1`, `is_active = true`];
  const params: any[] = [businessId];
  let paramIndex = 2;

  if (dateFilter) {
    if (dateFilter.gte) {
      whereClauses.push(`"createdAt" >= $${paramIndex}`);
      params.push(dateFilter.gte);
      paramIndex++;
    }
    if (dateFilter.lte) {
      whereClauses.push(`"createdAt" <= $${paramIndex}`);
      params.push(dateFilter.lte);
      paramIndex++;
    }
  }

  if (searchTokens.length > 0) {
    const tokenConditions = searchTokens.map((token) => {
      const tokenParam = `%${token}%`;
      const condition = `(LOWER(title) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex + 1} OR $${paramIndex + 2} = ANY(COALESCE(keywords, ARRAY[]::text[])))`;
      params.push(tokenParam, tokenParam, token);
      paramIndex += 3;
      return condition;
    });
    whereClauses.push(`(${tokenConditions.join(" AND ")})`);
  }

  const whereClause = whereClauses.join(" AND ");
  const allowedOrderFields = ["createdAt", "price", "title", "displayId"];
  const allowedDirections = ["asc", "desc"];

  const safeOrderField = allowedOrderFields.includes(orderField)
    ? orderField
    : "createdAt";

  const normalizedDirection = orderDirection.toLowerCase();

  const safeOrderDirection = allowedDirections.includes(normalizedDirection)
    ? normalizedDirection
    : "desc";

  const orderClause = `"${safeOrderField}" ${safeOrderDirection.toUpperCase()}`;

  const [productsResult, countResult] = await Promise.all([
    db.query(
      `SELECT id, "businessId", "displayId", title, description, price, "imageUrl", "createdAt"
       FROM products
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    ),
    db.query(
      `SELECT COUNT(*) as count FROM products WHERE ${whereClause}`,
      [...params],
    ),
  ]);

  const products = productsResult.rows;
  const total = parseInt(countResult.rows[0].count, 10);

  const result = products.map((p) => ({
    id: p.id,
    displayId: p.displayId,
    title: p.title,
    price: p.price,
    imageUrl: p.imageUrl || null,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
  }));

  const display = result.map((p) => ({
    label: `${p.displayId}. ${p.title}`,
    value: `$${p.price.toLocaleString()}`,
  }));

  const hasMore = offset + result.length < total;

  const response = {
    success: true,
    data: {
      products: result,
      count: result.length,
      total,
      limit,
      offset,
      hasMore,
      display,
      ...(result.length === 1 && result[0].imageUrl
        ? { imageUrl: result[0].imageUrl }
        : {}),
    },
  };

  logger.log(
    `[listProducts] Response - success: true, count: ${result.length}, total: ${total}`,
  );
  return response;
};
