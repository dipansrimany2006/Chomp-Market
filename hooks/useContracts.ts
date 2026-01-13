'use client';

import { useState, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import {
  CONTRACTS,
  MANTLE_SEPOLIA,
  FACTORY_ABI,
  MARKET_ABI,
  BATCH_PREDICTION_ABI,
  MarketInfo,
  UserPosition,
  MarketStatus,
  fetchMarketInfo,
  fetchUserPosition,
  fetchAllMarkets,
  fetchActiveMarkets,
  parseTokenAmount,
  formatTokenAmount,
} from '@/lib/contracts';

// Hook to get an ethers signer from Privy wallet
export function useEthersSigner() {
  const { wallets } = useWallets();

  const getSigner = useCallback(async () => {
    // First try to find embedded/privy wallet, then fall back to any connected wallet
    let wallet = wallets.find((w) => w.walletClientType === 'privy' || w.connectorType === 'embedded');

    // If no embedded wallet, use the first available wallet (external wallets like MetaMask)
    if (!wallet && wallets.length > 0) {
      wallet = wallets[0];
    }

    if (!wallet) {
      throw new Error('No wallet found. Please connect your wallet.');
    }

    const ethereumProvider = await wallet.getEthereumProvider();

    // Check current chain and switch to Mantle Sepolia if needed
    try {
      const currentChainId = await ethereumProvider.request({ method: 'eth_chainId' });
      const mantleChainIdHex = `0x${MANTLE_SEPOLIA.chainId.toString(16)}`;

      if (currentChainId !== mantleChainIdHex) {
        try {
          // Try to switch to Mantle Sepolia
          await ethereumProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: mantleChainIdHex }],
          });
        } catch (switchError: unknown) {
          // If chain doesn't exist, add it
          if ((switchError as { code?: number })?.code === 4902) {
            await ethereumProvider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: mantleChainIdHex,
                  chainName: MANTLE_SEPOLIA.name,
                  nativeCurrency: MANTLE_SEPOLIA.currency,
                  rpcUrls: [MANTLE_SEPOLIA.rpcUrl],
                  blockExplorerUrls: [MANTLE_SEPOLIA.blockExplorer],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }
    } catch (error) {
      console.error('Error switching chain:', error);
      throw new Error('Please switch to Mantle Sepolia network in your wallet.');
    }

    const provider = new ethers.BrowserProvider(ethereumProvider);

    // Verify network connection
    const network = await provider.getNetwork();
    console.log('Connected to network:', {
      chainId: Number(network.chainId),
      name: network.name,
      expectedChainId: MANTLE_SEPOLIA.chainId,
    });

    if (Number(network.chainId) !== MANTLE_SEPOLIA.chainId) {
      throw new Error(`Wrong network. Expected Mantle Sepolia (${MANTLE_SEPOLIA.chainId}) but got ${network.chainId}`);
    }

    return provider.getSigner();
  }, [wallets]);

  return { getSigner };
}

// Hook for factory contract interactions
export function useFactory() {
  const { getSigner } = useEthersSigner();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Updated to accept options array
  const createMarket = useCallback(
    async (question: string, endTime: Date, options: string[]): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const signer = await getSigner();
        const factory = new ethers.Contract(CONTRACTS.FACTORY, FACTORY_ABI, signer);

        // Convert end date to Unix timestamp
        const endTimeUnix = Math.floor(endTime.getTime() / 1000);

        // Create market with options (uses native MNT)
        const tx = await factory.createMarket(question, endTimeUnix, options);
        const receipt = await tx.wait();

        // Find the MarketCreated event to get the new market address
        const event = receipt.logs.find((log: ethers.Log) => {
          try {
            const parsed = factory.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            return parsed?.name === 'MarketCreated';
          } catch {
            return false;
          }
        });

        if (event) {
          const parsed = factory.interface.parseLog({
            topics: event.topics as string[],
            data: event.data,
          });
          return parsed?.args.marketAddress;
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create market';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getSigner]
  );

  const getAllMarkets = useCallback(async (): Promise<string[]> => {
    return fetchAllMarkets();
  }, []);

  const getActiveMarkets = useCallback(async (): Promise<string[]> => {
    return fetchActiveMarkets();
  }, []);

  return {
    createMarket,
    getAllMarkets,
    getActiveMarkets,
    isLoading,
    error,
  };
}

// Hook for market contract interactions
export function useMarket(marketAddress: string) {
  const { getSigner } = useEthersSigner();
  const { user } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMarketInfo = useCallback(async (): Promise<MarketInfo> => {
    return fetchMarketInfo(marketAddress);
  }, [marketAddress]);

  const getUserPosition = useCallback(async (): Promise<UserPosition | null> => {
    if (!user?.wallet?.address) return null;
    return fetchUserPosition(marketAddress, user.wallet.address);
  }, [marketAddress, user?.wallet?.address]);

  // Buy shares with native MNT
  const buyShares = useCallback(
    async (optionIndex: number, amount: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const signer = await getSigner();
        const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);

        const amountWei = parseTokenAmount(amount);

        // Buy shares for specific option - send MNT value directly
        const tx = await market.buyShares(optionIndex, { value: amountWei });
        await tx.wait();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to buy shares';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getSigner, marketAddress]
  );

  // Updated to accept optionIndex instead of 'yes'/'no'
  const sellShares = useCallback(
    async (optionIndex: number, shares: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const signer = await getSigner();
        const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);

        const sharesWei = parseTokenAmount(shares);

        // Sell shares for specific option
        const tx = await market.sellShares(optionIndex, sharesWei);
        await tx.wait();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to sell shares';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getSigner, marketAddress]
  );

  // Updated to accept optionIndex instead of 'yes'/'no'
  const getSellPayout = useCallback(
    async (optionIndex: number, shares: string): Promise<string> => {
      try {
        const provider = new ethers.JsonRpcProvider(MANTLE_SEPOLIA.rpcUrl);
        const market = new ethers.Contract(marketAddress, MARKET_ABI, provider);

        const sharesWei = parseTokenAmount(shares);
        const payout = await market.calculateSellPayout(optionIndex, sharesWei);

        return formatTokenAmount(payout);
      } catch (err) {
        console.error('Error calculating sell payout:', err);
        return '0';
      }
    },
    [marketAddress]
  );

  const claimWinnings = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);

      const tx = await market.claimWinnings();
      await tx.wait();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim winnings';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getSigner, marketAddress]);

  const claimRefund = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);

      const tx = await market.claimRefund();
      await tx.wait();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim refund';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getSigner, marketAddress]);

  // Updated to accept array of winning option indices
  const resolveMarket = useCallback(
    async (winnerIndices: number[]): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const signer = await getSigner();
        const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);

        const tx = await market.resolveMarket(winnerIndices);
        await tx.wait();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to resolve market';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getSigner, marketAddress]
  );

  const cancelMarket = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);

      const tx = await market.cancelMarket();
      await tx.wait();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel market';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getSigner, marketAddress]);

  return {
    getMarketInfo,
    getUserPosition,
    buyShares,
    sellShares,
    getSellPayout,
    claimWinnings,
    claimRefund,
    resolveMarket,
    cancelMarket,
    isLoading,
    error,
  };
}

// Hook for native MNT balance
export function useToken() {
  const { user } = usePrivy();

  const getBalance = useCallback(async (): Promise<string> => {
    if (!user?.wallet?.address) return '0';

    const provider = new ethers.JsonRpcProvider(MANTLE_SEPOLIA.rpcUrl);
    const balance = await provider.getBalance(user.wallet.address);
    return formatTokenAmount(balance);
  }, [user?.wallet?.address]);

  return {
    getBalance,
  };
}

// Hook for batch prediction contract
export interface BatchPredictionInput {
  marketAddress: string;
  optionIndex: number;
  amount: string; // Amount in MNT (will be converted to wei)
}

export function useBatchPrediction() {
  const { getSigner } = useEthersSigner();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate predictions before execution
  const validatePredictions = useCallback(
    async (predictions: BatchPredictionInput[]): Promise<{ valid: boolean[]; totalAmount: string }> => {
      if (!CONTRACTS.BATCH_PREDICTION) {
        throw new Error('BatchPrediction contract not deployed');
      }

      const provider = new ethers.JsonRpcProvider(MANTLE_SEPOLIA.rpcUrl);
      const batchContract = new ethers.Contract(
        CONTRACTS.BATCH_PREDICTION,
        BATCH_PREDICTION_ABI,
        provider
      );

      const markets = predictions.map((p) => p.marketAddress);
      const amounts = predictions.map((p) => parseTokenAmount(p.amount));

      const result = await batchContract.validatePredictions(markets, amounts);
      return {
        valid: result.valid as boolean[],
        totalAmount: formatTokenAmount(result.totalAmount),
      };
    },
    []
  );

  // Execute batch predictions
  const executeBatchPrediction = useCallback(
    async (predictions: BatchPredictionInput[]): Promise<string> => {
      if (!CONTRACTS.BATCH_PREDICTION) {
        throw new Error('BatchPrediction contract not deployed. Please deploy the contract first.');
      }

      setIsLoading(true);
      setError(null);

      try {
        const signer = await getSigner();
        const signerAddress = await signer.getAddress();
        const batchContract = new ethers.Contract(
          CONTRACTS.BATCH_PREDICTION,
          BATCH_PREDICTION_ABI,
          signer
        );

        // Prepare arrays for batchPredictSimple
        const markets = predictions.map((p) => p.marketAddress);
        const optionIndices = predictions.map((p) => p.optionIndex);
        const amounts = predictions.map((p) => parseTokenAmount(p.amount));

        // Calculate total amount
        const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0n);

        console.log('=== BatchPrediction Debug ===');
        console.log('Signer:', signerAddress);
        console.log('Contract:', CONTRACTS.BATCH_PREDICTION);
        console.log('Markets:', markets);
        console.log('Option Indices:', optionIndices);
        console.log('Amounts (wei):', amounts.map(a => a.toString()));
        console.log('Total Amount (wei):', totalAmount.toString());
        console.log('Total Amount (MNT):', formatTokenAmount(totalAmount));

        // Check signer balance
        const provider = signer.provider;
        if (provider) {
          const balance = await provider.getBalance(signerAddress);
          console.log('Signer Balance (MNT):', formatTokenAmount(balance));
          if (balance < totalAmount) {
            throw new Error(`Insufficient balance. You have ${formatTokenAmount(balance)} MNT but need ${formatTokenAmount(totalAmount)} MNT`);
          }
        }

        // Try to estimate gas first
        console.log('Estimating gas...');
        let gasLimit: bigint | undefined;
        try {
          const gasEstimate = await batchContract.batchPredictSimple.estimateGas(
            markets,
            optionIndices,
            amounts,
            { value: totalAmount }
          );
          console.log('Gas estimate:', gasEstimate.toString());
          // Add 20% buffer
          gasLimit = (gasEstimate * 120n) / 100n;
        } catch (gasError) {
          console.error('Gas estimation failed, using manual gas limit:', gasError);
          // Use a high manual gas limit as fallback (500M gas - Mantle has high limits)
          gasLimit = 500000000n;
          console.log('Using fallback gas limit:', gasLimit.toString());
        }

        // Execute batch prediction
        console.log('Sending transaction with gas limit:', gasLimit?.toString());
        const tx = await batchContract.batchPredictSimple(
          markets,
          optionIndices,
          amounts,
          { value: totalAmount, gasLimit }
        );

        console.log('Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt.hash);
        return receipt.hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to execute batch prediction';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getSigner]
  );

  return {
    validatePredictions,
    executeBatchPrediction,
    isLoading,
    error,
  };
}

export { MarketStatus, formatTokenAmount, parseTokenAmount };
export type { MarketInfo, UserPosition };
