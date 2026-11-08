import {
  Controller, Delete, Get, HttpCode, Param, Patch, Post, Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  cartItemBody, cartQuantityBody, checkoutBody, discountBody, licenseBody, pageQuery, productBody, productQuery,
  productUpdateBody, quickProductBody, refundDecisionBody, refundRequestBody, reviewBody, revenueShareBody, storeBody, storeUpdateBody,
} from '@faith/validators';
import { z } from 'zod';
import { Auth, AuthContext, OptionalAuth, Public, RequirePermission } from '../auth/context';
import { StorageService } from '../core/adapters';
import { ZBody, ZQuery } from '../core/zod';
import { CatalogService } from './catalog.service';
import { OrdersService } from './orders.service';
import { SellerService } from './seller.service';

const assetBody = z.object({ uploadId: z.string().min(1), kind: z.enum(['IMAGE', 'FILE', 'VIDEO']), versionId: z.string().optional() });
const versionBody = z.object({ version: z.string().trim().min(1).max(30), changelog: z.string().trim().max(4000).optional() });
const activeBody = z.object({ active: z.boolean() });
const sponsoredQuery = z.object({ placement: z.enum(['MARKETPLACE_TOP', 'PROMOTED_LISTING', 'CREATOR_DISCOVERY', 'SPONSORED_COLLECTION']).default('MARKETPLACE_TOP') });

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly catalog: CatalogService) {}

  @Public() @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Public() @Get('products')
  products(@ZQuery(productQuery) q: z.infer<typeof productQuery>) {
    return this.catalog.search(q);
  }

  @Public() @Get('products/:slug')
  product(@Param('slug') slug: string, @OptionalAuth() a?: AuthContext) {
    return this.catalog.detail(slug, a?.user.id);
  }

  @Public() @Get('stores/:slug')
  store(@Param('slug') slug: string) {
    return this.catalog.store(slug);
  }

  @Public() @Get('sponsored')
  sponsored(@ZQuery(sponsoredQuery) q: z.infer<typeof sponsoredQuery>) {
    return this.catalog.sponsored(q.placement);
  }

  @Post('reviews') @RequirePermission('marketplace.buy')
  review(@Auth() a: AuthContext, @ZBody(reviewBody) b: z.infer<typeof reviewBody>) {
    return this.catalog.addReview(a.user.id, b);
  }
}

@ApiTags('buyer')
@Controller()
export class BuyerController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly orders: OrdersService,
    private readonly storage: StorageService,
  ) {}

  @Get('cart')
  cart(@Auth() a: AuthContext) {
    return this.orders.cart(a.user.id);
  }

  @Post('cart/items') @RequirePermission('marketplace.buy')
  add(@Auth() a: AuthContext, @ZBody(cartItemBody) b: z.infer<typeof cartItemBody>) {
    return this.orders.addToCart(a.user.id, b.variantId, b.quantity);
  }

  @Patch('cart/items/:id')
  quantity(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(cartQuantityBody) b: z.infer<typeof cartQuantityBody>) {
    return this.orders.setQuantity(a.user.id, id, b.quantity);
  }

  @Delete('cart/items/:id')
  remove(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.orders.removeFromCart(a.user.id, id);
  }

  @Post('checkout') @RequirePermission('marketplace.buy')
  checkout(@Auth() a: AuthContext, @ZBody(checkoutBody) b: z.infer<typeof checkoutBody>) {
    return this.orders.checkout(a.user.id, b);
  }

  @Get('orders')
  myOrders(@Auth() a: AuthContext) {
    return this.orders.myOrders(a.user.id);
  }

  @Get('orders/:id')
  order(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.orders.order(a.user.id, id);
  }

  @Post('orders/:id/refunds')
  refund(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(refundRequestBody) b: z.infer<typeof refundRequestBody>) {
    return this.orders.requestRefund(a.user.id, id, b);
  }

  @Get('library')
  library(@Auth() a: AuthContext) {
    return this.orders.library(a.user.id);
  }

  /** Issues a five-minute signed URL only after re-checking the entitlement. */
  @Post('library/:entitlementId/assets/:assetId/download') @HttpCode(200)
  async download(@Auth() a: AuthContext, @Param('entitlementId') e: string, @Param('assetId') id: string) {
    const asset = await this.orders.assertDownload(a.user.id, e, id);
    return { url: await this.storage.store.signedUrl(asset.storageKey, { ttlSeconds: 300, filename: asset.filename }) };
  }

  @Get('wishlist')
  wishlist(@Auth() a: AuthContext) {
    return this.catalog.wishlist(a.user.id);
  }

  @Put('wishlist/:productId')
  wish(@Auth() a: AuthContext, @Param('productId') id: string) {
    return this.catalog.setWishlist(a.user.id, id, true);
  }

  @Delete('wishlist/:productId')
  unwish(@Auth() a: AuthContext, @Param('productId') id: string) {
    return this.catalog.setWishlist(a.user.id, id, false);
  }
}

@ApiTags('seller')
@Controller('seller')
export class SellerController {
  constructor(private readonly seller: SellerService, private readonly orders: OrdersService) {}

  @Get('stores')
  stores(@Auth() a: AuthContext) {
    return this.seller.myStores(a.user.id);
  }

  @Post('stores') @RequirePermission('store.manage')
  createStore(@Auth() a: AuthContext, @ZBody(storeBody) b: z.infer<typeof storeBody>) {
    return this.seller.createStore(a.user.id, b);
  }

  @Patch('stores/:id') @RequirePermission('store.manage')
  updateStore(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(storeUpdateBody) b: z.infer<typeof storeUpdateBody>) {
    return this.seller.updateStore(id, a.user.id, b);
  }

  @Get('stores/:id/products')
  products(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.products(id, a.user.id);
  }

  @Post('stores/:id/products') @RequirePermission('product.manage')
  createProduct(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(productBody) b: z.infer<typeof productBody>) {
    return this.seller.createProduct(id, a.user.id, b);
  }

  @Post('stores/:id/products/quick') @RequirePermission('product.manage')
  quickProduct(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(quickProductBody) b: z.infer<typeof quickProductBody>) {
    const { variantName, priceMinor, ...rest } = b;
    return this.seller.createProduct(id, a.user.id, { ...rest, variants: [{ name: variantName, priceMinor, active: true }] });
  }

  @Get('products/:id')
  product(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.productForEdit(id, a.user.id);
  }

  @Patch('products/:id') @RequirePermission('product.manage')
  updateProduct(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(productUpdateBody) b: z.infer<typeof productUpdateBody>) {
    return this.seller.updateProduct(id, a.user.id, b);
  }

  @Post('products/:id/publish') @HttpCode(200) @RequirePermission('product.manage')
  publish(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.publish(id, a.user.id);
  }

  @Post('products/:id/archive') @HttpCode(200) @RequirePermission('product.manage')
  archive(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.archive(id, a.user.id);
  }

  @Post('products/:id/versions') @RequirePermission('product.manage')
  version(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(versionBody) b: z.infer<typeof versionBody>) {
    return this.seller.addVersion(id, a.user.id, b.version, b.changelog);
  }

  @Post('products/:id/assets') @RequirePermission('product.manage')
  attach(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(assetBody) b: z.infer<typeof assetBody>) {
    return this.seller.attachAsset(id, a.user.id, b.uploadId, b.kind, b.versionId);
  }

  @Delete('products/:id/assets/:assetId') @RequirePermission('product.manage')
  detach(@Auth() a: AuthContext, @Param('id') id: string, @Param('assetId') assetId: string) {
    return this.seller.removeAsset(id, a.user.id, assetId);
  }

  @Post('products/:id/revenue-shares') @RequirePermission('product.manage')
  share(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(revenueShareBody) b: z.infer<typeof revenueShareBody>) {
    return this.seller.addRevenueShare(id, a.user.id, b);
  }

  @Get('stores/:id/discounts')
  discounts(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.discounts(id, a.user.id);
  }

  @Post('stores/:id/discounts') @RequirePermission('store.manage')
  discount(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(discountBody) b: z.infer<typeof discountBody>) {
    return this.seller.createDiscount(id, a.user.id, b);
  }

  @Patch('stores/:id/discounts/:discountId') @RequirePermission('store.manage')
  discountActive(@Auth() a: AuthContext, @Param('id') id: string, @Param('discountId') d: string, @ZBody(activeBody) b: z.infer<typeof activeBody>) {
    return this.seller.setDiscountActive(id, a.user.id, d, b.active);
  }

  @Get('stores/:id/licenses')
  licenses(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.licenses(id, a.user.id);
  }

  @Post('stores/:id/licenses') @RequirePermission('store.manage')
  license(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(licenseBody) b: z.infer<typeof licenseBody>) {
    return this.seller.createLicense(id, a.user.id, b);
  }

  @Get('stores/:id/orders') @RequirePermission('order.sell.read')
  storeOrders(@Auth() a: AuthContext, @Param('id') id: string, @ZQuery(pageQuery) q: z.infer<typeof pageQuery>) {
    return this.seller.orders(id, a.user.id, q);
  }

  @Get('stores/:id/customers') @RequirePermission('order.sell.read')
  customers(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.customers(id, a.user.id);
  }

  @Get('stores/:id/analytics') @RequirePermission('order.sell.read')
  analytics(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.analytics(id, a.user.id);
  }

  @Get('stores/:id/earnings') @RequirePermission('order.sell.read')
  earnings(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.seller.earnings(id, a.user.id);
  }

  @Get('stores/:id/refunds') @RequirePermission('refund.manage')
  refunds(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.orders.storeRefunds(id, a.user.id);
  }

  @Post('refunds/:id/decide') @HttpCode(200) @RequirePermission('refund.manage')
  decide(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(refundDecisionBody) b: z.infer<typeof refundDecisionBody>) {
    return this.orders.decideRefund(id, a.user.id, b.approve, b.note);
  }
}
