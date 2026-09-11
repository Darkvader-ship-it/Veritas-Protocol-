// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPlatformAdapter} from "../interfaces/IPlatformAdapter.sol";

/**
 * @title SXBetAdapter
 * @notice Adapter for SX Bet (SX Network) — on-chain sports betting
 * @dev SX Bet is EVM on SX Network (chain 416). This adapter reads via SX Bet's
 *      BetManager contract. Live market data via frontend/app/api/sxbet/route.ts (api.sx.bet).
 *      Pattern mirrors AzuroAdapter/DreamDEX — admin registry + core read.
 * @author Veritas Team
 */

interface ISXBetCore {
    struct Bet {
        address bettor;
        bytes32 marketId;
        bytes32 outcomeId;
        uint256 amount;
        uint256 odds; // decimal odds * 1e18
        uint256 timestamp;
        bool resolved;
        bool won;
    }
    function getBetsByUser(address user, uint256 offset, uint256 limit) external view returns (Bet[] memory, uint256 total);
    function isMarketResolved(bytes32 marketId) external view returns (bool);
    function getWinningOutcome(bytes32 marketId) external view returns (bytes32 outcomeId);
}

contract SXBetAdapter is IPlatformAdapter {
    ISXBetCore public immutable sxCore;
    address public owner;
    bytes32[] public allMarkets;
    mapping(bytes32 => bool) public isKnownMarket;

    error NotOwner();
    error AlreadyKnown();
    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    constructor(address sxCore_) {
        require(sxCore_ != address(0), "zero sx");
        sxCore = ISXBetCore(sxCore_);
        owner = msg.sender;
    }

    function registerMarket(bytes32 marketId) external onlyOwner {
        if (isKnownMarket[marketId]) revert AlreadyKnown();
        isKnownMarket[marketId] = true;
        allMarkets.push(marketId);
    }

    function platformName() external pure override returns (string memory) { return "SX Bet"; }
    function platformAddress() external view override returns (address) { return address(sxCore); }

    function isMarketResolved(bytes32 marketId) external view override returns (bool) {
        try sxCore.isMarketResolved(marketId) returns (bool r) { return r; } catch { return false; }
    }

    function getMarketOutcome(bytes32 marketId) external view override returns (uint8) {
        bytes32 winning = sxCore.getWinningOutcome(marketId);
        // Encode 0/1 via outcomeId hash: if winning == marketId-derived? Simplified: winning 0 => 0 else 1
        return winning == bytes32(0) ? 0 : 1;
    }

    function fetchUserPredictions(address user, uint256 startIndex, uint256 count)
        external
        view
        override
        returns (PredictionData[] memory predictions, uint256 totalCount)
    {
        try sxCore.getBetsByUser(user, startIndex, count) returns (ISXBetCore.Bet[] memory bets, uint256 total) {
            totalCount = total;
            predictions = new PredictionData[](bets.length);
            for (uint256 i = 0; i < bets.length; i++) {
                ISXBetCore.Bet memory b = bets[i];
                predictions[i] = PredictionData({
                    predictionId: b.marketId,
                    predictor: user,
                    marketId: b.marketId,
                    outcome: b.outcomeId == bytes32(uint256(1)) ? 1 : 0,
                    amount: b.amount,
                    timestamp: b.timestamp,
                    resolved: b.resolved,
                    correct: b.won
                });
            }
            return (predictions, totalCount);
        } catch {
            uint256 totalMarkets = allMarkets.length;
            if (totalMarkets == 0 || startIndex >= totalMarkets) return (new PredictionData[](0), totalMarkets);
            uint256 end = startIndex + count > totalMarkets ? totalMarkets : startIndex + count;
            predictions = new PredictionData[](end - startIndex);
            totalCount = totalMarkets;
            for (uint256 i = 0; i < predictions.length; i++) {
                bytes32 mid = allMarkets[startIndex + i];
                predictions[i] = PredictionData({predictionId: mid, predictor: user, marketId: mid, outcome: 0, amount: 0, timestamp: 0, resolved: false, correct: false});
            }
        }
    }

    function getUserStats(address user) external view override returns (UserStats memory stats) {
        try sxCore.getBetsByUser(user, 0, 1000) returns (ISXBetCore.Bet[] memory bets, uint256) {
            uint256 wins = 0; uint256 vol = 0; uint256 active = 0;
            for (uint256 i = 0; i < bets.length; i++) {
                vol += bets[i].amount;
                if (bets[i].resolved) { if (bets[i].won) wins++; } else { active++; }
            }
            return UserStats({totalPredictions: bets.length - active, correctPredictions: wins, totalVolume: vol, activeMarkets: active});
        } catch {
            return UserStats({totalPredictions: 0, correctPredictions: 0, totalVolume: 0, activeMarkets: 0});
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }
}
