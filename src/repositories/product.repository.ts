import prisma from '../prisma';

export interface CreateProductData {
  businessId: string;
  title: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
}

export async function createProduct(data: CreateProductData) {
  return prisma.product.create({
    data: {
      businessId: data.businessId,
      title: data.title,
      description: data.description ?? null,
      price: data.price ?? 0,
      imageUrl: data.imageUrl ?? null,
      sourceUrl: data.sourceUrl ?? null,
      sourceType: data.sourceType ?? null,
    },
  });
}
