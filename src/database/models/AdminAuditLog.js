import mongoose from 'mongoose';

const adminAuditLogSchema = new mongoose.Schema({
  adminId: { type: String, required: true, index: true },
  guildId: { type: String, default: null, index: true },
  command: { type: String, required: true, index: true },
  options: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['started', 'completed', 'failed'], default: 'started' },
  error: { type: String, default: null },
}, { timestamps: true });

export const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);
