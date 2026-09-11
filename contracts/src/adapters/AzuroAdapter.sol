// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPlatformAdapter} from "../interfaces/IPlatformAdapter.sol";

/**
 * @title AzuroAdapter
 * @notice Adapter for Azuro Protocol on Polygon (also Gnosis/Arbitrum)
 * @dev Implements IPlatformAdapter for Veritas. Azuro is an on-chain sports prediction protocol
 *      using LP pools. This adapter reads via Azuro's core contracts on Polygon:
 *      AzuroBet (0x...), LP (0x...). For Veritas MVP we use a registry pattern
 *      similar to DreamDEXAdapter — admin registers marketIds, adapter checks
 *      user positions via Azuro's bet storage.
 *      Live market data via frontend/app/api/azuro/route.ts (api.azuro.org) — adapter provides
 *      on-chain verifiable getUserStats for ReputationNFT.
 * @author Veritas Team
 */

interface IAzuroCore {
    struct Bet {
        address bettor;
        bytes32 conditionId;
        bytes32 outcomeId;
        uint256 amount;
        uint256 timestamp;
        bool resolved;
        bool won;
    }
    function getBetsByUser(address user, uint256 offset, uint256 limit) external view returns (Bet[] memory, uint256 total);
    function getBetResult(bytes32 conditionId, bytes32 outcomeId) external view returns (bool resolved, bool won);
    function bets(bytes32 betId) external view returns (Bet memory);
}

contract AzuroAdapter is IPlatformAdapter {
    IAzuroCore public immutable azuroCore;
    address public immutable AZURO_LP = 0x2B35345b8d4e4A93c3cB5A5FA5dBEd89ef413624; // Azuro LP Polygon example
    address public owner;
    bytes32[] public allMarkets;
    mapping(bytes32 => bool) public isKnownMarket;
    mapping(bytes32 => uint256) public marketIndex;

    error NotOwner();
    error AlreadyKnown();
    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    constructor(address azuroCore_) {
        require(azuroCore_ != address(0), "zero azuro");
        azuroCore = IAzuroCore(azuroCore_);
        owner = msg.sender;
    }

    // Admin registry (mirrors DreamDEXAdapter)
    function registerMarket(bytes32 marketId) external onlyOwner {
        if (isKnownMarket[marketId]) revert AlreadyKnown();
        isKnownMarket[marketId] = true;
        marketIndex[marketId] = allMarkets.length + 1;
        allMarkets.push(marketId);
    }

    function registerMarkets(bytes32[] calldata ids) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            if (!isKnownMarket[ids[i]]) {
                isKnownMarket[ids[i]] = true;
                marketIndex[ids[i]] = allMarkets.length + 1;
                allMarkets.push(ids[i]);
            }
        }
    }

    function platformName() external pure override returns (string memory) { return "Azuro"; }
    function platformAddress() external view override returns (address) { return address(azuroCore); }

    function isMarketResolved(bytes32 marketId) external view override returns (bool) {
        // Check via Azuro core — condition resolved?
        // For MVP, if market known and has bet result, assume resolved
        try azuroCore.getBetResult(marketId, bytes32(0)) returns (bool resolved, bool) {
            return resolved;
        } catch { return false; }
    }

    function getMarketOutcome(bytes32 marketId) external view override returns (uint8) {
        (bool resolved, bool won) = azuroCore.getBetResult(marketId, bytes32(0));
        require(resolved, "not resolved");
        return won ? 0 : 1; // 0 = Yes wins, 1 = No
    }

    function fetchUserPredictions(address user, uint256 startIndex, uint256 count)
        external
        view
        override
        returns (PredictionData[] memory predictions, uint256 totalCount)
    {
        // Try live Azuro core
        try azuroCore.getBetsByUser(user, startIndex, count) returns (IAzuroCore.Bet[] memory bets, uint256 total) {
            totalCount = total;
            predictions = new PredictionData[](bets.length);
            for (uint256 i = 0; i < bets.length; i++) {
                IAzuroCore.Bet memory b = bets[i];
                bool correct = false;
                if (b.resolved) {
                    // won already set
                    correct = b.won;
                }
                predictions[i] = PredictionData({
                    predictionId: b.conditionId,
                    predictor: user,
                    marketId: b.conditionId,
                    outcome: b.outcomeId == bytes32(uint256(1)) ? 1 : 0,
                    amount: b.amount,
                    timestamp: b.timestamp,
                    resolved: b.resolved,
                    correct: correct
                });
            }
            return (predictions, totalCount);
        } catch {
            // Fallback to registry scan (local)
            uint256 totalMarkets = allMarkets.length;
            if (totalMarkets == 0 || startIndex >= totalMarkets) return (new PredictionData[](0), totalMarkets);
            uint256 end = startIndex + count > totalMarkets ? totalMarkets : startIndex + count;
            uint256 size = end - startIndex;
            predictions = new PredictionData[](size);
            totalCount = totalMarkets;
            // Not enough on-chain data without external call — return empty predictions but count
            // Indexer will populate via off-chain API; on-chain view is best-effort
            for (uint256 i = 0; i < size; i++) {
                bytes32 mid = allMarkets[startIndex + i];
                predictions[i] = PredictionData({
                    predictionId: mid,
                    predictor: user,
                    marketId: mid,
                    outcome: 0,
                    amount: 0,
                    timestamp: 0,
                    resolved: false,
                    correct: false
                });
            }
        }
    }

    function getUserStats(address user) external view override returns (UserStats memory stats) {
        try azuroCore.getBetsByUser(user, 0, 1000) returns (IAzuroCore.Bet[] memory bets, uint256) {
            uint256 total = bets.length;
            uint256 wins = 0;
            uint256 vol = 0;
            uint256 active = 0;
            for (uint256 i = 0; i < bets.length; i++) {
                vol += bets[i].amount;
                if (bets[i].resolved) {
                    if (bets[i].won) wins++;
                } else {
                    active++;
                }
            }
            uint256 totalPred = total - active;
            return UserStats({totalPredictions: totalPred, correctPredictions: wins, totalVolume: vol, activeMarkets: active});
        } catch {
            return UserStats({totalPredictions: 0, correctPredictions: 0, totalVolume: 0, activeMarkets: 0});
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }
}
