// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PredictionMarket.sol";

/// @title PredictionMarketFactory
/// @notice Factory contract for creating prediction markets using native MNT
contract PredictionMarketFactory {
    address public owner;
    address public defaultResolver; // UMA resolver for decentralized resolution

    // All markets created through this factory
    address[] public allMarkets;

    // Markets created by a specific address
    mapping(address => address[]) public marketsByCreator;

    // Track if an address is a valid market
    mapping(address => bool) public isValidMarket;

    event MarketCreated(
        address indexed marketAddress,
        address indexed creator,
        string question,
        uint256 endTime,
        string[] options
    );
    event DefaultResolverUpdated(address indexed newResolver);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error InvalidEndTime();
    error InvalidQuestion();
    error InvalidOptionsCount();
    error EmptyOptionLabel();
    error DuplicateOptionLabel();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Create a new prediction market with custom options (uses native MNT)
    /// @param _question The prediction question
    /// @param _endTime Unix timestamp when betting closes
    /// @param _options Array of 2-4 option labels
    function createMarket(
        string memory _question,
        uint256 _endTime,
        string[] memory _options
    ) external returns (address marketAddress) {
        if (bytes(_question).length == 0) revert InvalidQuestion();
        if (_endTime <= block.timestamp) revert InvalidEndTime();

        // Validate options count
        if (_options.length < 2 || _options.length > 4) revert InvalidOptionsCount();

        // Validate options are non-empty and unique
        for (uint256 i = 0; i < _options.length; i++) {
            if (bytes(_options[i]).length == 0) revert EmptyOptionLabel();
            for (uint256 j = i + 1; j < _options.length; j++) {
                if (keccak256(bytes(_options[i])) == keccak256(bytes(_options[j]))) {
                    revert DuplicateOptionLabel();
                }
            }
        }

        PredictionMarket newMarket = new PredictionMarket(
            msg.sender,
            _question,
            _endTime,
            _options
        );

        marketAddress = address(newMarket);

        // Set resolver if default resolver is configured
        if (defaultResolver != address(0)) {
            newMarket.setResolver(defaultResolver);
        }

        allMarkets.push(marketAddress);
        marketsByCreator[msg.sender].push(marketAddress);
        isValidMarket[marketAddress] = true;

        emit MarketCreated(
            marketAddress,
            msg.sender,
            _question,
            _endTime,
            _options
        );

        return marketAddress;
    }

    // ============ View Functions ============

    /// @notice Get total number of markets
    function getTotalMarkets() external view returns (uint256) {
        return allMarkets.length;
    }

    /// @notice Get all market addresses
    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }

    /// @notice Get markets by creator
    function getMarketsByCreator(address creator) external view returns (address[] memory) {
        return marketsByCreator[creator];
    }

    /// @notice Get paginated markets
    function getMarketsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory markets, uint256 total)
    {
        total = allMarkets.length;

        if (offset >= total) {
            return (new address[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 resultLength = end - offset;
        markets = new address[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            markets[i] = allMarkets[offset + i];
        }

        return (markets, total);
    }

    /// @notice Get active markets (not resolved or cancelled)
    function getActiveMarkets() external view returns (address[] memory) {
        uint256 activeCount = 0;

        // First pass: count active markets
        for (uint256 i = 0; i < allMarkets.length; i++) {
            PredictionMarket market = PredictionMarket(payable(allMarkets[i]));
            if (market.marketStatus() == PredictionMarket.Status.Active) {
                activeCount++;
            }
        }

        // Second pass: populate array
        address[] memory activeMarkets = new address[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < allMarkets.length; i++) {
            PredictionMarket market = PredictionMarket(payable(allMarkets[i]));
            if (market.marketStatus() == PredictionMarket.Status.Active) {
                activeMarkets[index] = allMarkets[i];
                index++;
            }
        }

        return activeMarkets;
    }

    // ============ Admin Functions ============

    /// @notice Update default resolver (can be set to address(0) to disable)
    function setDefaultResolver(address _resolver) external onlyOwner {
        defaultResolver = _resolver;
        emit DefaultResolverUpdated(_resolver);
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert NotOwner();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // ============ Emergency Admin Functions ============
    // These are needed to fix markets where factory was incorrectly set as creator

    /// @notice Resolve a market where factory is the creator (admin only)
    /// @dev This is a workaround for the bug where createMarketSimple set factory as creator
    /// @param marketAddress The market to resolve
    /// @param winnerIndices Array of winning option indices
    function adminResolveMarket(address payable marketAddress, uint8[] calldata winnerIndices) external onlyOwner {
        require(isValidMarket[marketAddress], "Not a valid market");
        PredictionMarket market = PredictionMarket(marketAddress);
        require(market.creator() == address(this), "Factory is not the creator");
        market.resolveMarket(winnerIndices);
    }

    /// @notice Cancel a market where factory is the creator (admin only)
    /// @param marketAddress The market to cancel
    function adminCancelMarket(address payable marketAddress) external onlyOwner {
        require(isValidMarket[marketAddress], "Not a valid market");
        PredictionMarket market = PredictionMarket(marketAddress);
        require(market.creator() == address(this), "Factory is not the creator");
        market.cancelMarket();
    }
}
