import { defineModel, index, now } from "./model-definition";
import type {
  AuditLogDocument,
  ScheduledJobLogDocument,
  SystemSettingDocument,
} from "./model.types";

export const AuditLogModel = defineModel<AuditLogDocument>({
  collection: "auditLogs",
  required: ["action", "description"],
  defaults: { createdAt: now },
  indexes: [
    index({ userId: 1, createdAt: -1 }),
    index({ shopId: 1, createdAt: -1 }),
  ],
  timestamps: false,
});

export const SystemSettingModel = defineModel<SystemSettingDocument>({
  collection: "systemSettings",
  required: ["key", "value"],
  indexes: [index({ key: 1 }, { unique: true })],
});

export const ScheduledJobLogModel = defineModel<ScheduledJobLogDocument>({
  collection: "scheduledJobLogs",
  required: ["jobType", "status"],
  defaults: { recordsProcessed: 0, recordsFailed: 0, startedAt: now },
  indexes: [index({ jobType: 1, startedAt: -1 })],
  timestamps: false,
});

export const systemModels = {
  auditLog: AuditLogModel,
  systemSetting: SystemSettingModel,
  scheduledJobLog: ScheduledJobLogModel,
};
