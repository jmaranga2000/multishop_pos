import { useState } from "react";
import { AppError } from "@/lib/errors/app-error";

interface CreditLimitOverrideModalProps {
  isOpen: boolean;
  customerId: string;
  saleId: string;
  amountMinor: number;
  creditLimitMinor: number;
  onApprove: (reason: string) => Promise<void>;
  onCancel: () => void;
}

export function CreditLimitOverrideModal({
  isOpen,
  customerId,
  saleId,
  amountMinor,
  creditLimitMinor,
  onApprove,
  onCancel,
}: CreditLimitOverrideModalProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!reason.trim()) {
      setError("Please enter a reason for the override");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onApprove(reason);
      setReason("");
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
      } else {
        setError("Failed to approve override");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const exceedByMinor = amountMinor - creditLimitMinor;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold mb-4">Credit Limit Override</h2>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
          <p className="text-sm text-yellow-800 mb-2">
            This credit sale exceeds the customer's credit limit.
          </p>
          <p className="text-sm font-semibold text-yellow-900">
            Sale Amount: ${(amountMinor / 100).toFixed(2)}
          </p>
          <p className="text-sm font-semibold text-yellow-900">
            Credit Limit: ${(creditLimitMinor / 100).toFixed(2)}
          </p>
          <p className="text-sm font-semibold text-red-600">
            Exceeds limit by: ${(exceedByMinor / 100).toFixed(2)}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Override Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this credit sale should be approved..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel Sale
          </button>
          <button
            onClick={handleApprove}
            disabled={isLoading || !reason.trim()}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Approving..." : "Approve Override"}
          </button>
        </div>
      </div>
    </div>
  );
}
