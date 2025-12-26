// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IOptimisticOracleV2.sol";

interface IPredictionMarket {
    function endTime() external view returns (uint256);
    function question() external view returns (string memory);
    function optionCount() external view returns (uint8);
    function getOptionLabels() external view returns (string[] memory);
    function marketStatus() external view returns (uint8); // 0 = Active, 1 = Resolved, 2 = Cancelled
    function resolveMarketFromResolver(uint8[] calldata winnerIndices) external;
}

/**
 * @title UMAMarketResolver
 * @notice Resolves prediction markets using UMA's Optimistic Oracle V2
 * @dev Handles oracle requests and settlements for decentralized market resolution
 */
contract UMAMarketResolver {
    using SafeERC20 for IERC20;

    // UMA Optimistic Oracle V2 instance
    IOptimisticOracleV2 public immutable oracle;

    // Bond currency (e.g., WETH, USDC)
    IERC20 public immutable bondCurrency;

    // YES_OR_NO_QUERY identifier for binary questions
    bytes32 public constant IDENTIFIER = bytes32("YES_OR_NO_QUERY");

    // Default liveness period (2 hours for production, can be shorter for testing)
    uint256 public constant DEFAULT_LIVENESS = 7200; // 2 hours

    // Minimum bond amount
    uint256 public constant MIN_BOND = 0;

    // Request tracking
    struct ResolutionRequest {
        address market;
        uint256 requestTime;
        bytes ancillaryData;
        bool resolved;
        uint8 winningOption;
    }

    // Market => request data
    mapping(address => ResolutionRequest) public resolutionRequests;

    // Track which markets have pending requests
    mapping(address => bool) public hasPendingRequest;

    // Events
    event ResolutionRequested(
        address indexed market,
        uint256 requestTime,
        bytes ancillaryData
    );
    event ResolutionProposed(
        address indexed market,
        address indexed proposer,
        int256 proposedPrice
    );
    event MarketResolved(
        address indexed market,
        uint8 winningOption,
        int256 resolvedPrice
    );

    // Errors
    error MarketNotEnded();
    error MarketAlreadyResolved();
    error RequestAlreadyPending();
    error NoRequestPending();
    error RequestNotSettled();
    error InvalidMarket();
    error InvalidProposal();
    error OracleNotSettled();

    /**
     * @notice Constructor
     * @param _oracle Address of UMA Optimistic Oracle V2
     * @param _bondCurrency Address of the bond currency token
     */
    constructor(address _oracle, address _bondCurrency) {
        require(_oracle != address(0), "Invalid oracle address");
        require(_bondCurrency != address(0), "Invalid bond currency");
        oracle = IOptimisticOracleV2(_oracle);
        bondCurrency = IERC20(_bondCurrency);
    }

    /**
     * @notice Request resolution for a prediction market
     * @param market Address of the prediction market to resolve
     * @dev Anyone can call this after market end time
     */
    function requestResolution(address market) external {
        if (market == address(0)) revert InvalidMarket();

        IPredictionMarket pm = IPredictionMarket(market);

        // Check market has ended
        if (block.timestamp < pm.endTime()) revert MarketNotEnded();

        // Check market is still active (not already resolved/cancelled)
        if (pm.marketStatus() != 0) revert MarketAlreadyResolved();

        // Check no pending request
        if (hasPendingRequest[market]) revert RequestAlreadyPending();

        // Build ancillary data from market question and options
        bytes memory ancillaryData = _buildAncillaryData(pm);

        uint256 requestTime = block.timestamp;

        // Store request info
        resolutionRequests[market] = ResolutionRequest({
            market: market,
            requestTime: requestTime,
            ancillaryData: ancillaryData,
            resolved: false,
            winningOption: 0
        });
        hasPendingRequest[market] = true;

        // Request price from oracle (reward = 0, proposer pays bond)
        oracle.requestPrice(
            IDENTIFIER,
            requestTime,
            ancillaryData,
            bondCurrency,
            0 // No reward - proposer earns bond back if correct
        );

        // Set custom liveness period
        oracle.setCustomLiveness(
            IDENTIFIER,
            requestTime,
            ancillaryData,
            DEFAULT_LIVENESS
        );

        emit ResolutionRequested(market, requestTime, ancillaryData);
    }

    /**
     * @notice Settle the oracle request and resolve the market
     * @param market Address of the prediction market
     * @dev Can be called after liveness period has passed
     */
    function settleAndResolve(address market) external {
        if (!hasPendingRequest[market]) revert NoRequestPending();

        ResolutionRequest storage request = resolutionRequests[market];
        if (request.resolved) revert MarketAlreadyResolved();

        // Settle with the oracle
        oracle.settle(
            address(this),
            IDENTIFIER,
            request.requestTime,
            request.ancillaryData
        );

        // Get the resolved price
        IOptimisticOracleV2.Request memory oracleRequest = oracle.getRequest(
            address(this),
            IDENTIFIER,
            request.requestTime,
            request.ancillaryData
        );

        if (!oracleRequest.settled) revert OracleNotSettled();

        int256 resolvedPrice = oracleRequest.resolvedPrice;

        // Convert resolved price to winning option index
        // For binary markets: 1e18 = option 0 wins (YES), 0 = option 1 wins (NO)
        // For multi-option: price represents option index (0, 1e18, 2e18, 3e18)
        uint8 winningOption = _priceToOptionIndex(resolvedPrice, IPredictionMarket(market).optionCount());

        // Mark as resolved
        request.resolved = true;
        request.winningOption = winningOption;
        hasPendingRequest[market] = false;

        // Create winner array and resolve the market
        uint8[] memory winners = new uint8[](1);
        winners[0] = winningOption;

        IPredictionMarket(market).resolveMarketFromResolver(winners);

        emit MarketResolved(market, winningOption, resolvedPrice);
    }

    /**
     * @notice Build ancillary data for oracle request
     * @param pm The prediction market interface
     * @return ancillaryData Formatted ancillary data bytes
     */
    function _buildAncillaryData(IPredictionMarket pm) internal view returns (bytes memory) {
        string memory question = pm.question();
        string[] memory options = pm.getOptionLabels();

        // Format: "Q: <question>? Options: 0:<label0>, 1:<label1>, ... Answer with option index scaled by 1e18 (0 for first option, 1e18 for second, etc.)"
        string memory optionsStr = "";
        for (uint8 i = 0; i < options.length; i++) {
            if (i > 0) {
                optionsStr = string(abi.encodePacked(optionsStr, ", "));
            }
            optionsStr = string(abi.encodePacked(
                optionsStr,
                _uint8ToString(i),
                ":",
                options[i]
            ));
        }

        return bytes(string(abi.encodePacked(
            "Q: ",
            question,
            " Options: ",
            optionsStr,
            ". Answer with the winning option index scaled by 1e18 (0 for option 0, 1000000000000000000 for option 1, etc.). If question is unresolvable, answer with -1e18."
        )));
    }

    /**
     * @notice Convert oracle price to option index
     * @param price The resolved price from oracle
     * @param optionCount Number of options in the market
     * @return Option index (0 to optionCount-1)
     */
    function _priceToOptionIndex(int256 price, uint8 optionCount) internal pure returns (uint8) {
        // Handle unresolvable case (return first option as default, market can handle cancellation)
        if (price < 0) {
            return 0; // Could also trigger cancellation logic
        }

        // Convert from 1e18 scaled value to index
        uint256 index = uint256(price) / 1e18;

        // Clamp to valid range
        if (index >= optionCount) {
            index = optionCount - 1;
        }

        return uint8(index);
    }

    /**
     * @notice Helper to convert uint8 to string
     */
    function _uint8ToString(uint8 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        if (value == 1) return "1";
        if (value == 2) return "2";
        if (value == 3) return "3";
        return "0";
    }

    // ============ View Functions ============

    /**
     * @notice Get resolution request details
     * @param market Address of the prediction market
     */
    function getResolutionRequest(address market)
        external
        view
        returns (
            uint256 requestTime,
            bytes memory ancillaryData,
            bool resolved,
            uint8 winningOption
        )
    {
        ResolutionRequest memory request = resolutionRequests[market];
        return (
            request.requestTime,
            request.ancillaryData,
            request.resolved,
            request.winningOption
        );
    }

    /**
     * @notice Check if a market can be settled
     * @param market Address of the prediction market
     * @return canSettle Whether the market can be settled now
     */
    function canSettle(address market) external view returns (bool) {
        if (!hasPendingRequest[market]) return false;

        ResolutionRequest memory request = resolutionRequests[market];
        if (request.resolved) return false;

        // Check oracle state (6 = Settled, 4 = Expired/ready to settle)
        try oracle.getState(
            address(this),
            IDENTIFIER,
            request.requestTime,
            request.ancillaryData
        ) returns (uint8 state) {
            // State 4 = Expired (can be settled), State 6 = Already settled
            return state >= 4;
        } catch {
            return false;
        }
    }

    /**
     * @notice Get the oracle request state for a market
     * @param market Address of the prediction market
     * @return state The oracle state (0=Invalid, 1=Requested, 2=Proposed, 3=Expired, 4=Disputed, 5=Resolved, 6=Settled)
     */
    function getOracleState(address market) external view returns (uint8) {
        if (!hasPendingRequest[market]) return 0;

        ResolutionRequest memory request = resolutionRequests[market];

        return oracle.getState(
            address(this),
            IDENTIFIER,
            request.requestTime,
            request.ancillaryData
        );
    }

    /**
     * @notice Preview the ancillary data that would be generated for a market
     * @param market Address of the prediction market
     * @return ancillaryData The formatted ancillary data
     */
    function previewAncillaryData(address market) external view returns (bytes memory) {
        return _buildAncillaryData(IPredictionMarket(market));
    }
}
