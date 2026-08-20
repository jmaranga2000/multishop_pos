import { defineModel, index } from "./model-definition";
import type {
  BusinessDocument,
  ShopDocument,
  UserDocument,
  CounterDocument,
} from "./model.types";

export const BusinessModel = defineModel<BusinessDocument>({
  collection: "businesses",
  required: ["name", "code"],
  defaults: {
    currency: "KES",
    timezone: "Africa/Nairobi",
    defaultReorderLevel: 10,
    defaultCriticalLevel: 5,
    offlineSessionHours: 24,
    syncIntervalMinutes: 5,
    weeklyReportDay: 5,
    weeklyReportHour: 21,
    posBarcodeScanningEnabled: true,
    quotationMpesaTill: null,
    quotationMpesaPaybill: null,
    quotationBankName: null,
    quotationBankAccountNumber: null,
    quotationBankAccountName: null,
  },
  indexes: [index({ code: 1 }, { unique: true })],
});

export const ShopModel = defineModel<ShopDocument>({
  collection: "shops",
  required: ["businessId", "name", "code"],
  defaults: {
    isActive: true,
    isArchived: false,
    mpesaEnabled: false,
    mpesaStkEnabled: false,
    mpesaPayToTillEnabled: false,
  },
  indexes: [
    index({ code: 1 }, { unique: true }),
    index({ businessId: 1, isActive: 1 }),
    index({ businessId: 1, isArchived: 1 }),
  ],
});

export const CounterModel = defineModel<CounterDocument>({
  collection: "counters",
  required: ["shopId", "name", "code"],
  defaults: { status: "ACTIVE" },
  indexes: [
    index({ shopId: 1, code: 1 }, { unique: true }),
    index({ shopId: 1, pinFingerprint: 1 }, { unique: true, partialFilterExpression: { pinFingerprint: { $type: "string" } } }),
    index({ shopId: 1, status: 1 }),
  ],
});

export const UserModel = defineModel<UserDocument>({
  collection: "users",
  required: ["businessId", "name", "email", "passwordHash", "role"],
  defaults: {
    status: "ACTIVE",
    passwordVersion: 1,
    failedLoginAttempts: 0,
    shopId: null,
    lockedUntil: null,
    lastLoginAt: null,
    createdById: null,
  },
  enums: {
    role: ["ADMIN", "SHOP"],
    status: ["ACTIVE", "SUSPENDED"],
  },
  indexes: [
    index({ email: 1 }, { unique: true }),
    index({ shopId: 1 }, { unique: true, sparse: true }),
    index({ businessId: 1, role: 1, status: 1 }),
  ],
});

export const coreModels = {
  business: BusinessModel,
  shop: ShopModel,
  counter: CounterModel,
  user: UserModel,
};
