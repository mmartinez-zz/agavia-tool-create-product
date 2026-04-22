import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ToolsService } from '../tools/tools.service';
import { ProductRepository } from '../repositories/product.repository';
import { DatabaseService } from '../infrastructure/db/database.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ToolsService, ProductRepository, DatabaseService],
  exports: [ProductRepository],
})
export class ProductsModule {}
