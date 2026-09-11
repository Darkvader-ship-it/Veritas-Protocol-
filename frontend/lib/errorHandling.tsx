import { toast } from '@/hooks/use-toast';

export enum ErrorType {
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  USER_REJECTED = 'USER_REJECTED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_REGISTERED = 'NOT_REGISTERED',
  ALREADY_REGISTERED = 'ALREADY_REGISTERED',
  UNKNOWN = 'UNKNOWN',
}

interface ErrorDetails {
  type: ErrorType;
  title: string;
  message: string;
  action?: string;
}

// Parse error and return user-friendly message
export function parseError(error: any): ErrorDetails {
  const errorString = error?.message || error?.toString() || '';
  const errorCode = error?.code;

  // User rejected transaction
  if (
    errorString.includes('User rejected') ||
    errorString.includes('user rejected') ||
    errorCode === 4001 ||
    errorCode === 'ACTION_REJECTED'
  ) {
    return {
      type: ErrorType.USER_REJECTED,
      title: 'Transaction Cancelled',
      message: 'You cancelled the transaction in your wallet.',
      action: 'Please try again when ready.',
    };
  }

  // Insufficient funds
  if (
    errorString.includes('insufficient funds') ||
    errorString.includes('insufficient balance')
  ) {
    return {
      type: ErrorType.INSUFFICIENT_FUNDS,
      title: 'Insufficient Funds',
      message: 'You don\'t have enough STT to complete this transaction.',
      action: 'Add more STT to your wallet and try again.',
    };
  }

  // Network/RPC errors
  if (
    errorString.includes('network') ||
    errorString.includes('fetch') ||
    errorString.includes('timeout') ||
    errorCode === 'NETWORK_ERROR'
  ) {
    return {
      type: ErrorType.NETWORK_ERROR,
      title: 'Network Error',
      message: 'Unable to connect to the blockchain network.',
      action: 'Check your internet connection and try again.',
    };
  }

  // Rate limiting
  if (
    errorString.includes('rate limit') ||
    errorString.includes('too many requests') ||
    errorString.includes('1 hour')
  ) {
    return {
      type: ErrorType.RATE_LIMIT,
      title: 'Rate Limit Exceeded',
      message: 'You\'ve made too many requests. Please wait before trying again.',
      action: 'Rate limit: 1 hour between imports.',
    };
  }

  // Already registered
  if (errorString.includes('already registered') || errorString.includes('AlreadyRegistered')) {
    return {
      type: ErrorType.ALREADY_REGISTERED,
      title: 'Already Registered',
      message: 'This wallet is already registered on Veritas.',
      action: 'Go to your dashboard to view your profile.',
    };
  }

  // Not registered
  if (errorString.includes('not registered') || errorString.includes('NotRegistered')) {
    return {
      type: ErrorType.NOT_REGISTERED,
      title: 'Not Registered',
      message: 'You need to register before performing this action.',
      action: 'Register to create your profile and mint your NFT.',
    };
  }

  // Wallet not connected
  if (errorString.includes('wallet') && errorString.includes('connect')) {
    return {
      type: ErrorType.WALLET_NOT_CONNECTED,
      title: 'Wallet Not Connected',
      message: 'Please connect your wallet to continue.',
      action: 'Click "Connect Wallet" in the top right.',
    };
  }

  // Invalid input
  if (errorString.includes('invalid') || errorString.includes('Invalid')) {
    return {
      type: ErrorType.INVALID_INPUT,
      title: 'Invalid Input',
      message: 'The data provided is invalid.',
      action: 'Please check your input and try again.',
    };
  }

  // Contract-specific errors
  if (
    errorString.includes('revert') ||
    errorString.includes('execution reverted') ||
    errorString.includes('contract')
  ) {
    // Try to extract revert reason
    const revertMatch = errorString.match(/reason="([^"]+)"/);
    const reason = revertMatch ? revertMatch[1] : 'Transaction failed';

    return {
      type: ErrorType.CONTRACT_ERROR,
      title: 'Transaction Failed',
      message: reason,
      action: 'Please check the transaction details and try again.',
    };
  }

  // Unknown error
  return {
    type: ErrorType.UNKNOWN,
    title: 'Something Went Wrong',
    message: errorString || 'An unexpected error occurred.',
    action: 'Please try again or contact support if the issue persists.',
  };
}

// Show error toast with parsed message
export function showErrorToast(error: any) {
  const errorDetails = parseError(error);

  toast({
    variant: 'destructive',
    title: errorDetails.title,
    description: (
      <div className="space-y-2">
        <p>{errorDetails.message}</p>
        {errorDetails.action && (
          <p className="text-xs opacity-80">{errorDetails.action}</p>
        )}
      </div>
    ),
  });

  // Log full error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error details:', error);
  }
}

// Show success toast
export function showSuccessToast(title: string, message?: string) {
  toast({
    title,
    description: message,
    className: 'border-green-500 bg-green-50 dark:bg-green-950',
  });
}

// Show info toast
export function showInfoToast(title: string, message?: string) {
  toast({
    title,
    description: message,
  });
}

// Wrap async function with error handling
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: {
    successTitle?: string;
    successMessage?: string;
    onSuccess?: (result: T) => void;
    onError?: (error: any) => void;
  }
): Promise<T | null> {
  try {
    const result = await fn();

    if (options?.successTitle) {
      showSuccessToast(options.successTitle, options.successMessage);
    }

    if (options?.onSuccess) {
      options.onSuccess(result);
    }

    return result;
  } catch (error) {
    showErrorToast(error);

    if (options?.onError) {
      options.onError(error);
    }

    return null;
  }
}

// Get shortened error message for UI display
export function getErrorMessage(error: any): string {
  const errorDetails = parseError(error);
  return errorDetails.message;
}

// Check if error is user rejection (don't show toast for this)
export function isUserRejection(error: any): boolean {
  const errorDetails = parseError(error);
  return errorDetails.type === ErrorType.USER_REJECTED;
}

// Format transaction hash for display
export function formatTxHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

// Get block explorer URL
export function getExplorerUrl(hash: string, chainId?: number): string {
  const isBscTestnet = chainId === 97;
  const baseUrl = isBscTestnet
    ? 'https://testnet.bscscan.com'
    : 'https://bscscan.com';

  return `${baseUrl}/tx/${hash}`;
}
