import { Logger } from "@nestjs/common";
import { ToolHandler, ToolResult } from "../../common/types";
import { ProductsService } from "../../products/products.service";

const logger = new Logger("listProductsTool");

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/s\b/g, "") // singular básico
    .trim();
}

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
  logger.debug(`[listProducts] Args received:`, JSON.stringify(args));

const limit = Math.min(args.limit || 10, 50);
  const offset = Math.max(args.offset || 0, 0);
  const filters = args.filters || {};
  const text: string | undefined = filters.text?.trim();
  const businessId = context.businessId;
  const orderField = args.orderBy || "createdAt";
  const orderDirection = args.orderDirection || "desc";

  logger.debug(`[listProducts] Pagination - limit: ${limit}, offset: ${offset}`);
  logger.debug(`[listProducts] Search text: "${text || 'none'}"`);
  logger.debug(`[listProducts] Order: ${orderField} ${orderDirection}`);

  const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo);
  logger.debug(`[listProducts] Date filter:`, dateFilter);

  const stopwords = ["de", "la", "el", "los", "las", "y", "con"];

  const searchTokens = text
    ? normalize(text)
        .split(/\s+/)
        .filter((t) => t.length > 2 && !stopwords.includes(t))
    : [];

  logger.debug(`[listProducts] Search tokens:`, searchTokens);

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

  const tokenConditions = searchTokens.map((token) => {
    const tokenParam = `%${token}%`;

    const condition = `
    (
      unaccent(lower(title)) LIKE unaccent(lower($${paramIndex})) OR
      unaccent(lower(description)) LIKE unaccent(lower($${paramIndex + 1})) OR
      unaccent(lower($${paramIndex + 2})) = ANY(COALESCE(keywords, ARRAY[]::text[]))
    )
  `;

    params.push(tokenParam, tokenParam, token);
    paramIndex += 3;

    return condition;
  });

  const joinOperator = searchTokens.length > 1 ? "AND" : "OR";
  if (tokenConditions.length > 0) {
    whereClauses.push(`(${tokenConditions.join(` ${joinOperator} `)})`);
  }

  logger.debug(`[listProducts] WHERE clauses count: ${whereClauses.length}`);
  logger.debug(`[listProducts] Query params count: ${params.length}`);

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

  logger.debug(`[listProducts] Calling repository.listProducts`);
  const repository = ProductsService.getRepository();
  const { products, total } = await repository.listProducts({
    businessId,
    whereClauses,
    params,
    orderClause,
    limit,
    offset,
    paramIndex,
  });

  logger.debug(`[listProducts] Query result - found: ${products.length}, total: ${total}`);

  const result = products.map((p) => ({
    id: p.id,
    displayId: p.displayId,
    title: p.title,
    price: p.price,
    imageUrl: p.imageUrl || null,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
  }));

  const display = result.map((p) => ({
    displayId: p.displayId,
    title: p.title,
    price: p.price.toLocaleString(),
  }));

  const hasMore = offset + result.length < total;
  logger.debug(`[listProducts] Has more: ${hasMore}`);

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
