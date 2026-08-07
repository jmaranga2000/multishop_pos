import { defineModel, index } from "./model-definition";
import type {
  BrandDocument,
  CategoryDocument,
  ProductDocument,
  ProductPricingUnitDocument,
  SalespersonProfileDocument,
  SalespersonBiometricCredentialDocument,
  SalespersonBiometricChallengeDocument,
  UnitDocument,
} from "./model.types";

export const SalespersonProfileModel = defineModel<SalespersonProfileDocument>({
  collection: "salespersonProfiles",
  required: ["shopId", "name", "pinHash", "code"],
  defaults: { isActive: true },
  indexes: [
    index({ shopId: 1, code: 1 }, { unique: true }),
    index({ shopId: 1, isActive: 1 }),
  ],
});

export const SalespersonBiometricCredentialModel = defineModel<SalespersonBiometricCredentialDocument>({
  collection: "salespersonBiometricCredentials",
  required: ["salespersonId", "credentialId", "publicKey", "counter"],
  defaults: { transports: [], deviceType: null, backedUp: false, lastUsedAt: null },
  indexes: [
    index({ credentialId: 1 }, { unique: true }),
    index({ salespersonId: 1, createdAt: 1 }),
  ],
});

export const SalespersonBiometricChallengeModel = defineModel<SalespersonBiometricChallengeDocument>({
  collection: "salespersonBiometricChallenges",
  required: ["salespersonId", "shopId", "purpose", "challenge", "expiresAt"],
  enums: { purpose: ["REGISTRATION", "AUTHENTICATION"] },
  indexes: [
    index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    index({ salespersonId: 1, purpose: 1, expiresAt: 1 }),
  ],
});

export const CategoryModel = defineModel<CategoryDocument>({
  collection: "categories",
  required: ["businessId", "name", "slug"],
  defaults: { isActive: true },
  indexes: [index({ businessId: 1, slug: 1 }, { unique: true })],
});

export const BrandModel = defineModel<BrandDocument>({
  collection: "brands",
  required: ["businessId", "name"],
  defaults: { isActive: true },
  indexes: [index({ businessId: 1, name: 1 }, { unique: true })],
});

export const UnitModel = defineModel<UnitDocument>({
  collection: "units",
  required: ["businessId", "name", "symbol"],
  indexes: [index({ businessId: 1, symbol: 1 }, { unique: true })],
});

export const ProductModel = defineModel<ProductDocument>({
  collection: "products",
  required: ["businessId", "name", "sku", "defaultCostPrice", "defaultSellingPrice"],
  defaults: { taxRate: 0, trackStock: true, status: "ACTIVE" },
  enums: { status: ["ACTIVE", "INACTIVE"] },
  indexes: [
    index({ businessId: 1, sku: 1 }, { unique: true }),
    index(
      { businessId: 1, barcode: 1 },
      { unique: true, partialFilterExpression: { barcode: { $type: "string" } } },
    ),
    index({ businessId: 1, status: 1, name: 1 }),
  ],
});

export const ProductPricingUnitModel = defineModel<ProductPricingUnitDocument>({
  collection: "productPricingUnits",
  required: ["productId", "unitId", "costPrice", "sellingPrice"],
  defaults: { multiplier: 1 },
  indexes: [
    index({ productId: 1, unitId: 1 }, { unique: true }),
    index({ unitId: 1 }),
  ],
  timestamps: false,
});

export const catalogModels = {
  salespersonProfile: SalespersonProfileModel,
  salespersonBiometricCredential: SalespersonBiometricCredentialModel,
  salespersonBiometricChallenge: SalespersonBiometricChallengeModel,
  category: CategoryModel,
  brand: BrandModel,
  unit: UnitModel,
  product: ProductModel,
  productPricingUnit: ProductPricingUnitModel,
};
