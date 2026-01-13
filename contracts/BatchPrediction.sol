// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BatchPrediction
 * @notice Allows users to place multiple predictions across different markets in a single transaction
 * @dev This contract acts as a router to batch multiple buyShares calls
 */

interface IPredictionMarket {
    function buyShares(uint8 optionIndex) external payable;
    function isOpenForBetting() external view returns (bool);
}

contract BatchPrediction {
    // Struct to hold prediction data
    struct Prediction {
        address market;      // Market contract address
        uint8 optionIndex;   // Option index to bet on
        uint256 amount;      // Amount of MNT to bet
    }

    // Events
    event BatchPredictionExecuted(
        address indexed user,
        uint256 totalAmount,
        uint256 marketsCount
    );

    event PredictionPlaced(
        address indexed user,
        address indexed market,
        uint8 optionIndex,
        uint256 amount
    );

    event PredictionFailed(
        address indexed user,
        address indexed market,
        uint8 optionIndex,
        uint256 amount,
        string reason
    );

    // Owner for emergency functions
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @notice Execute multiple predictions in a single transaction
     * @param predictions Array of Prediction structs containing market, option, and amount
     * @dev The total msg.value must equal the sum of all prediction amounts
     */
    function batchPredict(Prediction[] calldata predictions) external payable {
        require(predictions.length > 0, "No predictions provided");
        require(predictions.length <= 20, "Too many predictions (max 20)");

        uint256 totalRequired = 0;
        for (uint256 i = 0; i < predictions.length; i++) {
            totalRequired += predictions[i].amount;
        }
        require(msg.value >= totalRequired, "Insufficient MNT sent");

        uint256 successCount = 0;
        uint256 totalSpent = 0;

        for (uint256 i = 0; i < predictions.length; i++) {
            Prediction calldata pred = predictions[i];

            // Skip if amount is 0
            if (pred.amount == 0) continue;

            // Check if market is valid and open
            try IPredictionMarket(pred.market).isOpenForBetting() returns (bool isOpen) {
                if (!isOpen) {
                    emit PredictionFailed(msg.sender, pred.market, pred.optionIndex, pred.amount, "Market not open");
                    continue;
                }
            } catch {
                emit PredictionFailed(msg.sender, pred.market, pred.optionIndex, pred.amount, "Invalid market");
                continue;
            }

            // Execute the prediction
            try IPredictionMarket(pred.market).buyShares{value: pred.amount}(pred.optionIndex) {
                emit PredictionPlaced(msg.sender, pred.market, pred.optionIndex, pred.amount);
                successCount++;
                totalSpent += pred.amount;
            } catch Error(string memory reason) {
                emit PredictionFailed(msg.sender, pred.market, pred.optionIndex, pred.amount, reason);
            } catch {
                emit PredictionFailed(msg.sender, pred.market, pred.optionIndex, pred.amount, "Unknown error");
            }
        }

        require(successCount > 0, "All predictions failed");

        emit BatchPredictionExecuted(msg.sender, totalSpent, successCount);

        // Refund excess MNT
        uint256 refund = msg.value - totalSpent;
        if (refund > 0) {
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Execute multiple predictions with a simpler interface
     * @param markets Array of market addresses
     * @param optionIndices Array of option indices
     * @param amounts Array of amounts in wei
     */
    function batchPredictSimple(
        address[] calldata markets,
        uint8[] calldata optionIndices,
        uint256[] calldata amounts
    ) external payable {
        require(markets.length == optionIndices.length && markets.length == amounts.length, "Array length mismatch");
        require(markets.length > 0, "No predictions provided");
        require(markets.length <= 20, "Too many predictions (max 20)");

        Prediction[] memory predictions = new Prediction[](markets.length);
        for (uint256 i = 0; i < markets.length; i++) {
            predictions[i] = Prediction({
                market: markets[i],
                optionIndex: optionIndices[i],
                amount: amounts[i]
            });
        }

        // Calculate total required
        uint256 totalRequired = 0;
        for (uint256 i = 0; i < predictions.length; i++) {
            totalRequired += predictions[i].amount;
        }
        require(msg.value >= totalRequired, "Insufficient MNT sent");

        uint256 successCount = 0;
        uint256 totalSpent = 0;

        for (uint256 i = 0; i < predictions.length; i++) {
            Prediction memory pred = predictions[i];

            if (pred.amount == 0) continue;

            try IPredictionMarket(pred.market).isOpenForBetting() returns (bool isOpen) {
                if (!isOpen) {
                    emit PredictionFailed(msg.sender, pred.market, pred.optionIndex, pred.amount, "Market not open");
                    continue;
                }
            } catch {
                emit PredictionFailed(msg.sender, pred.market, pred.optionIndex, pred.amount, "Invalid market");
                continue;
            }

            try IPredictionMarket(pred.market).buyShares{value: pred.amount}(pred.optionIndex) {
                emit PredictionPlaced(msg.sender, pred.market, pred.optionIndex, pred.amount);
                successCount++;
                totalSpent += pred.amount;
            } catch Error(string memory reason) {
                emit PredictionFailed(msg.sender, pred.market, pred.optionIndex, pred.amount, reason);
            } catch {
                emit PredictionFailed(msg.sender, pred.market, pred.optionIndex, pred.amount, "Unknown error");
            }
        }

        require(successCount > 0, "All predictions failed");

        emit BatchPredictionExecuted(msg.sender, totalSpent, successCount);

        uint256 refund = msg.value - totalSpent;
        if (refund > 0) {
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Validate predictions before execution (view function)
     * @param markets Array of market addresses
     * @param amounts Array of amounts
     * @return valid Array of booleans indicating if each market is valid and open
     * @return totalAmount Total amount required
     */
    function validatePredictions(
        address[] calldata markets,
        uint256[] calldata amounts
    ) external view returns (bool[] memory valid, uint256 totalAmount) {
        require(markets.length == amounts.length, "Array length mismatch");

        valid = new bool[](markets.length);
        totalAmount = 0;

        for (uint256 i = 0; i < markets.length; i++) {
            try IPredictionMarket(markets[i]).isOpenForBetting() returns (bool isOpen) {
                valid[i] = isOpen && amounts[i] > 0;
            } catch {
                valid[i] = false;
            }
            totalAmount += amounts[i];
        }
    }

    /**
     * @notice Emergency withdraw function for stuck funds
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdraw failed");
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    // Allow contract to receive MNT
    receive() external payable {}
}
