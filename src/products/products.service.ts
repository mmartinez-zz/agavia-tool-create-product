import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../repositories/product.repository';

@Injectable()
export class ProductsService {
  private static instance: ProductRepository;

  constructor(private readonly productRepository: ProductRepository) {
    ProductsService.instance = productRepository;
  }

  static getRepository(): ProductRepository {
    return ProductsService.instance;
  }
}
