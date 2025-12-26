// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PredictionMarket {
    address public creator;
    address public resolver; // UMA resolver contract

    string public question;
    uint256 public endTime;
    uint256 public createdAt;

    enum Status { Active, Resolved, Cancelled }
    Status public marketStatus;

    // Custom options (2-4 options)
    uint8 public optionCount;
    string[] public optionLabels;
    bool[] public winningOptions;
    bool public hasWinners;

    // Shares per option: user => optionIndex => shares
    mapping(address => mapping(uint8 => uint256)) public shares;
    mapping(address => bool) public hasClaimed;

    // Total shares per option
    uint256[] public totalShares;

    // Reentrancy guard
    bool private locked;

    // Events
    event MarketCreated(address indexed creator, string question, uint256 endTime, string[] options);
    event SharesBought(address indexed buyer, uint8 optionIndex, uint256 amount);
    event SharesSold(address indexed seller, uint8 optionIndex, uint256 sharesAmount, uint256 payout);
    event MarketResolved(uint8[] winnerIndices, uint256 totalPool);
    event MarketCancelled(address indexed cancelledBy);
    event Claimed(address indexed user, uint256 payout);
    event Refunded(address indexed user, uint256 amount);

    // Errors
    error MarketNotActive();
    error MarketEnded();
    error MarketStillOpen();
    error MarketNotResolved();
    error MarketNotCancelled();
    error NotAuthorized();
    error InvalidOption();
    error InvalidAmount();
    error InvalidEndTime();
    error InvalidOptionsCount();
    error EmptyOptionLabel();
    error DuplicateOptionLabel();
    error NoWinnersSpecified();
    error TooManyWinners();
    error DuplicateWinner();
    error NothingToClaim();
    error NothingToRefund();
    error AlreadyClaimed();
    error TransferFailed();
    error ReentrancyGuard();
    error InsufficientShares();
    error InsufficientLiquidity();
    error NotResolver();
    error ResolverAlreadySet();

    modifier nonReentrant() {
        if (locked) revert ReentrancyGuard();
        locked = true;
        _;
        locked = false;
    }

    modifier onlyActive() {
        if (marketStatus != Status.Active) revert MarketNotActive();
        if (block.timestamp >= endTime) revert MarketEnded();
        _;
    }

    modifier onlyCreator() {
        if (msg.sender != creator) revert NotAuthorized();
        _;
    }

    modifier onlyResolver() {
        if (msg.sender != resolver) revert NotResolver();
        _;
    }

    constructor(
        address _creator,
        string memory _question,
        uint256 _endTime,
        string[] memory _options
    ) {
        if (_endTime <= block.timestamp) revert InvalidEndTime();
        if (_creator == address(0)) revert InvalidAmount();
        if (bytes(_question).length == 0) revert InvalidAmount();

        // Validate 2-4 options
        if (_options.length < 2 || _options.length > 4) revert InvalidOptionsCount();

        // Validate each option is non-empty and unique
        for (uint8 i = 0; i < _options.length; i++) {
            if (bytes(_options[i]).length == 0) revert EmptyOptionLabel();
            for (uint8 j = i + 1; j < _options.length; j++) {
                if (keccak256(bytes(_options[i])) == keccak256(bytes(_options[j]))) {
                    revert DuplicateOptionLabel();
                }
            }
        }

        creator = _creator;
        question = _question;
        endTime = _endTime;
        createdAt = block.timestamp;
        marketStatus = Status.Active;

        optionCount = uint8(_options.length);
        optionLabels = _options;
        totalShares = new uint256[](_options.length);
        winningOptions = new bool[](_options.length);

        emit MarketCreated(_creator, _question, _endTime, _options);
    }

    /// @notice Buy shares for a specific option using native MNT
    /// @param optionIndex Index of the option (0 to optionCount-1)
    function buyShares(uint8 optionIndex) external payable onlyActive nonReentrant {
        if (optionIndex >= optionCount) revert InvalidOption();
        if (msg.value == 0) revert InvalidAmount();

        shares[msg.sender][optionIndex] += msg.value;
        totalShares[optionIndex] += msg.value;

        emit SharesBought(msg.sender, optionIndex, msg.value);
    }

    /// @notice Sell shares for a specific option
    /// @param optionIndex Index of the option (0 to optionCount-1)
    /// @param sharesAmount Amount of shares to sell
    function sellShares(uint8 optionIndex, uint256 sharesAmount) external onlyActive nonReentrant {
        if (optionIndex >= optionCount) revert InvalidOption();
        if (sharesAmount == 0) revert InvalidAmount();
        if (shares[msg.sender][optionIndex] < sharesAmount) revert InsufficientShares();

        uint256 totalPool = getTotalPool();
        if (totalPool == 0) revert InsufficientLiquidity();

        // Payout = shares * (optionTotal / totalPool)
        uint256 payout = (sharesAmount * totalShares[optionIndex]) / totalPool;

        if (address(this).balance < payout) revert InsufficientLiquidity();

        // Update state before transfer (CEI pattern)
        shares[msg.sender][optionIndex] -= sharesAmount;
        totalShares[optionIndex] -= sharesAmount;

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        if (!success) revert TransferFailed();

        emit SharesSold(msg.sender, optionIndex, sharesAmount, payout);
    }

    /// @notice Resolve the market with one or more winning options
    /// @param winnerIndices Array of winning option indices
    function resolveMarket(uint8[] calldata winnerIndices) external onlyCreator {
        if (marketStatus != Status.Active) revert MarketNotActive();
        if (block.timestamp < endTime) revert MarketStillOpen();
        if (winnerIndices.length == 0) revert NoWinnersSpecified();
        if (winnerIndices.length > optionCount) revert TooManyWinners();

        // Validate and set winners
        for (uint256 i = 0; i < winnerIndices.length; i++) {
            uint8 idx = winnerIndices[i];
            if (idx >= optionCount) revert InvalidOption();
            if (winningOptions[idx]) revert DuplicateWinner();
            winningOptions[idx] = true;
        }

        hasWinners = true;
        marketStatus = Status.Resolved;

        emit MarketResolved(winnerIndices, getTotalPool());
    }

    /// @notice Cancel the market (only creator, only while active)
    function cancelMarket() external onlyCreator {
        if (marketStatus != Status.Active) revert MarketNotActive();

        marketStatus = Status.Cancelled;

        emit MarketCancelled(msg.sender);
    }

    /// @notice Set the resolver address (can only be set once by creator)
    /// @param _resolver Address of the UMA resolver contract
    function setResolver(address _resolver) external onlyCreator {
        if (resolver != address(0)) revert ResolverAlreadySet();
        if (_resolver == address(0)) revert InvalidAmount();
        resolver = _resolver;
    }

    /// @notice Resolve the market from the UMA resolver
    /// @param winnerIndices Array of winning option indices
    function resolveMarketFromResolver(uint8[] calldata winnerIndices) external onlyResolver {
        if (marketStatus != Status.Active) revert MarketNotActive();
        if (block.timestamp < endTime) revert MarketStillOpen();
        if (winnerIndices.length == 0) revert NoWinnersSpecified();
        if (winnerIndices.length > optionCount) revert TooManyWinners();

        // Validate and set winners
        for (uint256 i = 0; i < winnerIndices.length; i++) {
            uint8 idx = winnerIndices[i];
            if (idx >= optionCount) revert InvalidOption();
            if (winningOptions[idx]) revert DuplicateWinner();
            winningOptions[idx] = true;
        }

        hasWinners = true;
        marketStatus = Status.Resolved;

        emit MarketResolved(winnerIndices, getTotalPool());
    }

    /// @notice Claim winnings after market is resolved (paid in native MNT)
    function claimWinnings() external nonReentrant {
        if (marketStatus != Status.Resolved) revert MarketNotResolved();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        // Calculate user's winning shares and total winning shares
        uint256 userWinningShares = 0;
        uint256 totalWinningShares = 0;

        for (uint8 i = 0; i < optionCount; i++) {
            if (winningOptions[i]) {
                userWinningShares += shares[msg.sender][i];
                totalWinningShares += totalShares[i];
            }
        }

        if (userWinningShares == 0) revert NothingToClaim();

        // Payout = (userWinningShares / totalWinningShares) * totalPool
        uint256 totalPool = getTotalPool();
        uint256 payout = (userWinningShares * totalPool) / totalWinningShares;

        // Mark as claimed and clear shares (CEI pattern)
        hasClaimed[msg.sender] = true;
        for (uint8 i = 0; i < optionCount; i++) {
            shares[msg.sender][i] = 0;
        }

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        if (!success) revert TransferFailed();

        emit Claimed(msg.sender, payout);
    }

    /// @notice Claim refund if market was cancelled (paid in native MNT)
    function claimRefund() external nonReentrant {
        if (marketStatus != Status.Cancelled) revert MarketNotCancelled();

        uint256 refundAmount = 0;
        for (uint8 i = 0; i < optionCount; i++) {
            refundAmount += shares[msg.sender][i];
            shares[msg.sender][i] = 0;
        }

        if (refundAmount == 0) revert NothingToRefund();

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit Refunded(msg.sender, refundAmount);
    }

    // ============ View Functions ============

    /// @notice Get complete market information
    function getMarketInfo() external view returns (
        address _creator,
        string memory _question,
        uint256 _endTime,
        uint256 _createdAt,
        Status _status,
        uint8 _optionCount,
        string[] memory _optionLabels,
        uint256[] memory _totalShares,
        bool[] memory _winningOptions,
        uint256 _totalPool
    ) {
        return (
            creator,
            question,
            endTime,
            createdAt,
            marketStatus,
            optionCount,
            optionLabels,
            totalShares,
            winningOptions,
            getTotalPool()
        );
    }

    /// @notice Get user's position in the market
    function getUserPosition(address user) external view returns (
        uint256[] memory _shares,
        bool _hasClaimed
    ) {
        uint256[] memory userShares = new uint256[](optionCount);
        for (uint8 i = 0; i < optionCount; i++) {
            userShares[i] = shares[user][i];
        }
        return (userShares, hasClaimed[user]);
    }

    /// @notice Get total pool size
    function getTotalPool() public view returns (uint256) {
        uint256 total = 0;
        for (uint8 i = 0; i < optionCount; i++) {
            total += totalShares[i];
        }
        return total;
    }

    /// @notice Get option label by index
    function getOptionLabel(uint8 index) external view returns (string memory) {
        if (index >= optionCount) revert InvalidOption();
        return optionLabels[index];
    }

    /// @notice Get all option labels
    function getOptionLabels() external view returns (string[] memory) {
        return optionLabels;
    }

    /// @notice Get total shares for all options
    function getTotalShares() external view returns (uint256[] memory) {
        return totalShares;
    }

    /// @notice Get winning options array
    function getWinningOptions() external view returns (bool[] memory) {
        return winningOptions;
    }

    /// @notice Calculate potential payout for a user if specific options win
    function calculatePotentialPayout(address user, uint8[] calldata winnerIndices) external view returns (uint256) {
        uint256 totalPool = getTotalPool();
        if (totalPool == 0) return 0;

        uint256 userWinningShares = 0;
        uint256 totalWinningShares = 0;

        for (uint256 i = 0; i < winnerIndices.length; i++) {
            uint8 idx = winnerIndices[i];
            if (idx < optionCount) {
                userWinningShares += shares[user][idx];
                totalWinningShares += totalShares[idx];
            }
        }

        if (totalWinningShares == 0) return 0;
        return (userWinningShares * totalPool) / totalWinningShares;
    }

    /// @notice Get current odds for all options (returns basis points, 10000 = 100%)
    function getOdds() external view returns (uint256[] memory) {
        uint256 totalPool = getTotalPool();
        uint256[] memory odds = new uint256[](optionCount);

        if (totalPool == 0) {
            uint256 equalOdds = 10000 / optionCount;
            for (uint8 i = 0; i < optionCount; i++) {
                odds[i] = equalOdds;
            }
        } else {
            for (uint8 i = 0; i < optionCount; i++) {
                odds[i] = (totalShares[i] * 10000) / totalPool;
            }
        }

        return odds;
    }

    /// @notice Get price for a specific option (basis points, 10000 = 100%)
    function getOptionPrice(uint8 optionIndex) external view returns (uint256) {
        if (optionIndex >= optionCount) revert InvalidOption();
        uint256 totalPool = getTotalPool();
        if (totalPool == 0) return 10000 / optionCount;
        return (totalShares[optionIndex] * 10000) / totalPool;
    }

    /// @notice Check if market is still active and open for betting
    function isOpenForBetting() external view returns (bool) {
        return marketStatus == Status.Active && block.timestamp < endTime;
    }

    /// @notice Get time remaining until market ends (0 if ended)
    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }

    /// @notice Get contract's MNT balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Calculate payout for selling shares at current price
    /// @param optionIndex Index of the option
    /// @param sharesAmount Amount of shares to sell
    /// @return payout Amount of collateral user would receive
    function calculateSellPayout(uint8 optionIndex, uint256 sharesAmount) external view returns (uint256 payout) {
        if (optionIndex >= optionCount) return 0;
        uint256 totalPool = getTotalPool();
        if (totalPool == 0) return 0;
        return (sharesAmount * totalShares[optionIndex]) / totalPool;
    }

    /// @notice Get user's shares for a specific option
    function getUserShares(address user, uint8 optionIndex) external view returns (uint256) {
        if (optionIndex >= optionCount) return 0;
        return shares[user][optionIndex];
    }

    /// @notice Allow contract to receive MNT
    receive() external payable {}
}
