import { PaymentVerification } from '../database/models/PaymentVerification.js';
import { syncPaymentToGoogleSheet } from './googleSheetsService.js';

export async function syncVerifiedPaymentToSheet(paymentRequest, user) {
  const claimed = await PaymentVerification.findOneAndUpdate(
    {
      _id: paymentRequest._id,
      status: 'verified',
      sheetSyncStatus: { $in: ['pending', 'failed'] },
    },
    {
      $set: { sheetSyncStatus: 'syncing', sheetSyncError: null },
      $inc: { sheetSyncAttempts: 1 },
    },
    { new: true }
  );

  if (!claimed) return false;

  try {
    await syncPaymentToGoogleSheet({ paymentRequest: claimed, user });
    await PaymentVerification.updateOne(
      { _id: claimed._id, sheetSyncStatus: 'syncing' },
      { $set: { sheetSyncStatus: 'synced', sheetSyncedAt: new Date(), sheetSyncError: null } }
    );
    return true;
  } catch (error) {
    await PaymentVerification.updateOne(
      { _id: claimed._id, sheetSyncStatus: 'syncing' },
      { $set: { sheetSyncStatus: 'failed', sheetSyncError: String(error?.message || error).slice(0, 500) } }
    );
    console.error(`Google Sheet sync failed for payment ${claimed.requestId}:`, error);
    return false;
  }
}
