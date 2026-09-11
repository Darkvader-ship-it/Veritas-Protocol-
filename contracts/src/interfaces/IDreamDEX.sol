// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IDreamDEX
 * @notice Interfaces for DreamDEX Event Contracts on Somnia
 * @dev Shannon Testnet 50312 + Mainnet 5031 — CREATE3 addresses (testnet=mainnet)
 * @author Veritas Team
 */

// ============================================
// Core Market Struct (BinaryMarketsModule)
// ============================================

struct DreamDEXMarket {
    bytes32 marketId;
    address pool;
    uint8 status; // 0 Listed, 1 Trading, 2 Locked, 3 Settling, 4 Resolved, 5 Voided, 6 Finalized
    uint64 lockTime;
    uint64 expiry;
    bytes32 venueId;
}

// ============================================
// BinaryMarketsModule
// CREATE3: 0x3ecC694Cef705358864a646142ac17A90E29e388
// ============================================

interface IBinaryMarketsModule {
    function getMarket(bytes32 marketId) external view returns (DreamDEXMarket memory);
    function markets(bytes32 marketId) external view returns (address pool);
    function getMarketOnchain(bytes32 marketId) external view returns (DreamDEXMarket memory);
    function marketCount() external view returns (uint256);
    function getAllMarketIds(uint256 start, uint256 count) external view returns (bytes32[] memory);
}

// ============================================
// OutcomeToken6909 — ERC6909 singleton
// CREATE3: 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9
// ============================================

interface IOutcomeToken6909 {
    function balanceOf(address owner, uint256 id) external view returns (uint256);
    function allowance(address owner, address spender, uint256 id) external view returns (uint256);
    function isOperator(address owner, address spender) external view returns (bool);
    function setOperator(address spender, bool approved) external returns (bool);
    function transfer(address receiver, uint256 id, uint256 amount) external returns (bool);
    function transferFrom(address sender, address receiver, uint256 id, uint256 amount) external returns (bool);
    function approve(address spender, uint256 id, uint256 amount) external returns (bool);

    // DreamDEX-specific: mint/burn via CollateralRouter
    event Transfer(address indexed caller, address indexed sender, address indexed receiver, uint256 id, uint256 amount);
    event OperatorSet(address indexed owner, address indexed spender, bool approved);
    event Redeemed(address indexed user, bytes32 indexed marketId, uint8 outcome, uint256 amount);
}

// ============================================
// BinarySettlement
// CREATE3: 0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23
// ============================================

interface IBinarySettlement {
    function redeem(bytes32 marketId) external;
    function redeemMany(bytes32[] calldata marketIds) external;
    function winningOutcome(bytes32 marketId) external view returns (uint8);
    function isMarketFinalized(bytes32 marketId) external view returns (bool);
    function payoutNumerators(bytes32 marketId) external view returns (uint256[] memory);
    function payoutDenominator() external view returns (uint256);
    function isVoided(bytes32 marketId) external view returns (bool);
    function claimable(address user, bytes32 marketId) external view returns (uint256);

    event Redeemed(address indexed user, bytes32 indexed marketId, uint8 indexed outcome, uint256 amount);
    event MarketResolved(bytes32 indexed marketId, uint8 winningOutcome, uint256 payoutDenominator, uint256[] payoutNumerators);
    event MarketVoided(bytes32 indexed marketId);
}

// ============================================
// CollateralRouter
// CREATE3: 0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C
// ============================================

interface ICollateralRouter {
    function mintCompleteSet(bytes32 marketId, uint256 amount) external;
    function mergeCompleteSet(bytes32 marketId, uint256 amount) external;
    function collateral() external view returns (address);
    function outcomeToken() external view returns (address);
}

// ============================================
// MarketsCore
// CREATE3: 0x2802504314685D89bF6C992CA5a8e7cC78bc0294
// ============================================

interface IMarketsCore {
    function markets(bytes32 marketId) external view returns (address pool);
    function getMarket(bytes32 marketId) external view returns (DreamDEXMarket memory);
}

// ============================================
// OracleHub
// CREATE3: 0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b
// ============================================

interface IOracleHub {
    function getAnswer(bytes32 questionId) external view returns (int256 answer, bool resolved);
    function isQuestionResolved(bytes32 questionId) external view returns (bool);
}

// ============================================
// ERC20 (tUSDC 6dec / USDso 18dec) — dynamic decimals
// Shannon tUSDC: 0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E
// Mainnet USDso: 0x00000022dA...008A
// ============================================

interface IERC20DreamDEX {
    function decimals() external view returns (uint8);
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
}
