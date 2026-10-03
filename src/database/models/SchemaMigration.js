import mongoose from 'mongoose';

const schemaMigrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const SchemaMigration = mongoose.model('SchemaMigration', schemaMigrationSchema);
