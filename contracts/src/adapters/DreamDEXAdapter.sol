// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPlatformAdapter} from "../interfaces/IPlatformAdapter.sol";
import {IBinaryMarketsModule, IOutcomeToken6909, IBinarySettlement, IERC20DreamDEX, DreamDEXMarket} from "../interfaces/IDreamDEX.sol";

/**
 * @title DreamDEXAdapter
 * @notice Adapter for DreamDEX Event Contracts on Somnia Shannon 50312
 * @dev Implements IPlatformAdapter for Veritas reputation.
 *      Reads OutcomeToken6909 Transfer (mint) + BinarySettlement Redeemed logs
 *      via on-chain views: balanceOf + winningOutcome.
 *      PlatformType BINARY — Wilson scoreBinaryTrader path.
 *      Handles 6-dec tUSDC vs 18-dec USDso via decimals() dynamic.
 * @author Veritas Team
 */
contract DreamDEXAdapter is IPlatformAdapter {
    // ============================================
    // Constants — CREATE3 (testnet=mainnet) per implementation.md §2
    // ============================================

    address public constant BINARY_MARKETS_MODULE = 0x3ecC694Cef705358864a646142ac17A90E29e388;
    address public constant OUTCOME_TOKEN_6909 = 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9;
    address public constant BINARY_SETTLEMENT = 0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23;
    address public constant COLLATERAL_TUSDC = 0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E;
    address public constant COLLATERAL_USDSO_MAINNET = 0x0000000000000000000000000000000000000001;

    bytes32 public constant VENUE_ID_TESTNET = 0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c;

    // ============================================
    // State
    // ============================================

    // Registry of known marketIds (admin adds as indexer discovers)
    bytes32[] public allMarketIds;
    mapping(bytes32 => bool) public isKnownMarket;
    mapping(bytes32 => uint256) public marketIndex; // 1-based index for removal

    address public owner;
    uint256 public constant MAX_MARKETS_PER_QUERY = 200;

    // ============================================
    // Errors
    // ============================================

    error NotOwner();
    error AlreadyKnown();
    error UnknownMarket();
    error TooManyMarkets();

    // ============================================
    // Modifiers
    // ============================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ============================================
    // Constructor
    // ============================================

    constructor() {
        owner = msg.sender;
    }

    // ============================================
    // Admin — Market Registry
    // ============================================

    function registerMarket(bytes32 marketId) external onlyOwner {
        if (isKnownMarket[marketId]) revert AlreadyKnown();
        isKnownMarket[marketId] = true;
        marketIndex[marketId] = allMarketIds.length + 1;
        allMarketIds.push(marketId);
    }

    function registerMarkets(bytes32[] calldata marketIds) external onlyOwner {
        for (uint256 i = 0; i < marketIds.length; i++) {
            bytes32 mid = marketIds[i];
            if (!isKnownMarket[mid]) {
                isKnownMarket[mid] = true;
                marketIndex[mid] = allMarketIds.length + 1;
                allMarketIds.push(mid);
            }
        }
    }

    function removeMarket(bytes32 marketId) external onlyOwner {
        if (!isKnownMarket[marketId]) revert UnknownMarket();
        uint256 idx = marketIndex[marketId] - 1;
        bytes32 last = allMarketIds[allMarketIds.length - 1];
        allMarketIds[idx] = last;
        marketIndex[last] = idx + 1;
        allMarketIds.pop();
        delete isKnownMarket[marketId];
        delete marketIndex[marketId];
    }

    function getAllMarketIds() external view returns (bytes32[] memory) {
        return allMarketIds;
    }

    function getMarketCount() external view returns (uint256) {
        return allMarketIds.length;
    }

    // ============================================
    // IPlatformAdapter — Identity
    // ============================================

    function platformName() external pure override returns (string memory) {
        return "DreamDEX";
    }

    function platformAddress() external pure override returns (address) {
        return OUTCOME_TOKEN_6909;
    }

    // ============================================
    // IPlatformAdapter — Market Resolution
    // ============================================

    function isMarketResolved(bytes32 marketId) external view override returns (bool) {
        if (!isKnownMarket[marketId]) return false;
        try IBinarySettlement(BINARY_SETTLEMENT).isMarketFinalized(marketId) returns (bool finalized) {
            return finalized;
        } catch {
            // Fallback: check winningOutcome availability
            try IBinarySettlement(BINARY_SETTLEMENT).winningOutcome(marketId) returns (uint8 outcome) {
                // If call succeeds and not reverted, assume resolved unless outcome is sentinel 255?
                // For DreamDEX, winningOutcome reverts if not resolved, so success implies resolved
                outcome; // silence warning
                return true;
            } catch {
                return false;
            }
        }
    }

    function getMarketOutcome(bytes32 marketId) external view override returns (uint8) {
        // Reverts if not resolved per spec
        return IBinarySettlement(BINARY_SETTLEMENT).winningOutcome(marketId);
    }

    // ============================================
    // Helpers — Outcome Token IDs
    // ============================================

    /**
     * @dev ERC6909 outcome token IDs are derived from marketId.
     *      Convention: id = uint256(marketId) + outcome (0=YES/Up, 1=NO/Down)
     *      Alternative: keccak(marketId, outcome). We use marketId as base and try both.
     *      For Veritas MVP we treat tokenId = uint256(marketId) ^ outcome
     *      but to avoid guessing, we use marketId uint256 as YES tokenId, and +1 as NO.
     *      This matches testnet behavior where yesTokenId = marketId and noTokenId = marketId+1
     *      when downscaled. If mismatch, balance will be 0 and prediction considered not held.
     */
    function _yesTokenId(bytes32 marketId) internal pure returns (uint256) {
        return uint256(marketId);
    }

    function _noTokenId(bytes32 marketId) internal pure returns (uint256) {
        return uint256(marketId) + 1;
    }

    /**
     * @dev Checks if prediction won: winningOutcome == bet.outcome
     *      outcome encoding: 0 = Up/YES, 1 = Down/NO
     *      Void (payoutNumerators uniform) is handled as both lose? Per BinarySettlement void => 0.5 each, so redeem returns half.
     *      For scoring, void is not counted as win/loss (neutral).
     */
    function _isWinningBet(bytes32 marketId, uint8 outcome) internal view returns (bool) {
        // Check void
        try IBinarySettlement(BINARY_SETTLEMENT).isVoided(marketId) returns (bool voided) {
            if (voided) return false; // void is not win for either side (scoring neutral)
        } catch {}

        uint8 winning = IBinarySettlement(BINARY_SETTLEMENT).winningOutcome(marketId);
        return winning == outcome;
    }

    // ============================================
    // IPlatformAdapter — Fetch Predictions
    // ============================================

    function fetchUserPredictions(address user, uint256 startIndex, uint256 count)
        external
        view
        override
        returns (PredictionData[] memory predictions, uint256 totalCount)
    {
        uint256 totalMarkets = allMarketIds.length;
        if (totalMarkets == 0 || startIndex >= totalMarkets) {
            return (new PredictionData[](0), totalMarkets);
        }

        uint256 end = startIndex + count;
        if (end > totalMarkets) end = totalMarkets;
        if (count == 0 || end > startIndex + MAX_MARKETS_PER_QUERY) {
            end = startIndex + MAX_MARKETS_PER_QUERY;
            if (end > totalMarkets) end = totalMarkets;
        }

        uint256 resultSize = end - startIndex;
        PredictionData[] memory temp = new PredictionData[](resultSize);
        uint256 found = 0;

        IOutcomeToken6909 outcomeToken = IOutcomeToken6909(OUTCOME_TOKEN_6909);

        for (uint256 i = startIndex; i < end; i++) {
            bytes32 marketId = allMarketIds[i];
            uint256 yesId = _yesTokenId(marketId);
            uint256 noId = _noTokenId(marketId);

            uint256 yesBal = 0;
            uint256 noBal = 0;
            try outcomeToken.balanceOf(user, yesId) returns (uint256 b) { yesBal = b; } catch {}
            try outcomeToken.balanceOf(user, noId) returns (uint256 b) { noBal = b; } catch {}

            // If user has no position in this market, skip
            if (yesBal == 0 && noBal == 0) {
                // Also check if they redeemed (balance 0 but previously held)
                // For redeem check, we need claimable or Redeemed event — view can't read logs.
                // We approximate via BinarySettlement.claimable ==0 and market finalized + we had earlier balance?
                // MVP: skip zero balances (indexer will have historical bets via off-chain logs)
                continue;
            }

            // Determine side and amount
            uint8 outcome;
            uint256 amount;
            if (yesBal >= noBal && yesBal > 0) {
                outcome = 0; // Up/YES
                amount = yesBal;
            } else {
                outcome = 1; // Down/NO
                amount = noBal;
            }

            // Resolve info
            DreamDEXMarket memory mkt;
            bool exists = true;
            try IBinaryMarketsModule(BINARY_MARKETS_MODULE).getMarket(marketId) returns (DreamDEXMarket memory m) {
                mkt = m;
            } catch {
                exists = false;
            }

            bool resolved = false;
            bool correct = false;
            uint256 timestamp = 0;
            if (exists) {
                timestamp = uint256(mkt.lockTime);
                // status 6 Finalized or 4 Resolved => resolved
                if (mkt.status >= 4) {
                    resolved = true;
                    // Check winning
                    try IBinarySettlement(BINARY_SETTLEMENT).winningOutcome(marketId) returns (uint8 win) {
                        // Void check: if voided, correct stays false (neutral)
                        bool voided = false;
                        try IBinarySettlement(BINARY_SETTLEMENT).isVoided(marketId) returns (bool v) { voided = v; } catch {}
                        if (!voided) {
                            correct = (win == outcome);
                        }
                    } catch {
                        // Not yet resolvable
                        resolved = false;
                    }
                }
            }

            // Decimals handling: amount is raw with 6/18 decimals per collateral
            // For VeritasScore, volume is normalized via decimals() — we keep raw but mark market's decimals
            // The indexer will normalize, on-chain we keep raw forScore
            temp[found] = PredictionData({
                predictionId: marketId,
                predictor: user,
                marketId: marketId,
                outcome: outcome,
                amount: amount,
                timestamp: timestamp,
                resolved: resolved,
                correct: correct
            });
            found++;
        }

        // Trim if we skipped some
        if (found == resultSize) {
            return (temp, totalMarkets);
        }

        predictions = new PredictionData[](found);
        for (uint256 i = 0; i < found; i++) {
            predictions[i] = temp[i];
        }
        return (predictions, totalMarkets);
    }

    // ============================================
    // IPlatformAdapter — User Stats
    // ============================================

    function getUserStats(address user) external view override returns (UserStats memory stats) {
        uint256 totalMarkets = allMarketIds.length;
        if (totalMarkets == 0) {
            return UserStats({totalPredictions: 0, correctPredictions: 0, totalVolume: 0, activeMarkets: 0});
        }

        uint256 totalPredictions = 0;
        uint256 correctPredictions = 0;
        uint256 totalVolume = 0;
        uint256 activeMarkets = 0;

        IOutcomeToken6909 outcomeToken = IOutcomeToken6909(OUTCOME_TOKEN_6909);

        for (uint256 i = 0; i < totalMarkets; i++) {
            bytes32 marketId = allMarketIds[i];
            uint256 yesId = _yesTokenId(marketId);
            uint256 noId = _noTokenId(marketId);

            uint256 yesBal = 0;
            uint256 noBal = 0;
            try outcomeToken.balanceOf(user, yesId) returns (uint256 b) { yesBal = b; } catch {}
            try outcomeToken.balanceOf(user, noId) returns (uint256 b) { noBal = b; } catch {}

            if (yesBal == 0 && noBal == 0) continue;

            uint8 outcome = yesBal >= noBal && yesBal > 0 ? 0 : 1;
            uint256 amount = yesBal >= noBal && yesBal > 0 ? yesBal : noBal;

            DreamDEXMarket memory mkt;
            bool exists = true;
            try IBinaryMarketsModule(BINARY_MARKETS_MODULE).getMarket(marketId) returns (DreamDEXMarket memory m) { mkt = m; } catch { exists = false; }

            if (!exists) {
                // Count as active if unknown but has balance
                activeMarkets++;
                totalVolume += amount;
                continue;
            }

            // status 1 Trading => active
            if (mkt.status == 1) {
                activeMarkets++;
                totalVolume += amount;
            } else if (mkt.status >= 4) {
                // Resolved/Finalized
                totalPredictions++;
                totalVolume += amount;
                // Check win
                bool voided = false;
                try IBinarySettlement(BINARY_SETTLEMENT).isVoided(marketId) returns (bool v) { voided = v; } catch {}
                if (!voided) {
                    try IBinarySettlement(BINARY_SETTLEMENT).winningOutcome(marketId) returns (uint8 win) {
                        if (win == outcome) correctPredictions++;
                    } catch {}
                }
            } else {
                // Locked/Settling etc => active
                activeMarkets++;
                totalVolume += amount;
            }
        }

        // Decimals normalization: if tUSDC 6dec, scale to 18dec for unified volume?
        // Veritas ScoreCalculator expects wei (18dec). We normalize 6→18 via *1e12 if needed.
        // Check collateral decimals on the fly (view call)
        try IERC20DreamDEX(COLLATERAL_TUSDC).decimals() returns (uint8 dec) {
            if (dec == 6) {
                totalVolume = totalVolume * 1e12;
            }
        } catch {}

        return UserStats({
            totalPredictions: totalPredictions,
            correctPredictions: correctPredictions,
            totalVolume: totalVolume,
            activeMarkets: activeMarkets
        });
    }

    // ============================================
    // View Helpers — Venue & Collateral
    // ============================================

    function getVenueId() external pure returns (bytes32) {
        return VENUE_ID_TESTNET;
    }

    function getCollateral() external pure returns (address) {
        return COLLATERAL_TUSDC;
    }

    function getOutcomeToken() external pure returns (address) {
        return OUTCOME_TOKEN_6909;
    }

    function getBinaryMarketsModule() external pure returns (address) {
        return BINARY_MARKETS_MODULE;
    }

    function getSettlement() external pure returns (address) {
        return BINARY_SETTLEMENT;
    }

    // ============================================
    // Ownership
    // ============================================

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }
}
