// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Simplified interface for UMA Optimistic Oracle V2
 * @notice Contains only the functions needed for prediction market resolution
 */
interface IOptimisticOracleV2 {
    // Struct to store request data
    struct Request {
        address proposer;
        address disputer;
        IERC20 currency;
        bool settled;
        bool refundOnDispute;
        int256 proposedPrice;
        int256 resolvedPrice;
        uint256 expirationTime;
        uint256 reward;
        uint256 finalFee;
        uint256 bond;
        uint256 customLiveness;
    }

    /**
     * @notice Requests a new price
     * @param identifier Price identifier
     * @param timestamp Timestamp of the price request
     * @param ancillaryData Additional data for the request (question text)
     * @param currency ERC20 token used for payment of rewards and fees
     * @param reward Reward offered to proposers
     * @return totalBond The bond currency amount required
     */
    function requestPrice(
        bytes32 identifier,
        uint256 timestamp,
        bytes memory ancillaryData,
        IERC20 currency,
        uint256 reward
    ) external returns (uint256 totalBond);

    /**
     * @notice Set custom liveness for a request
     * @param identifier Price identifier
     * @param timestamp Request timestamp
     * @param ancillaryData Request ancillary data
     * @param customLiveness Custom liveness in seconds
     */
    function setCustomLiveness(
        bytes32 identifier,
        uint256 timestamp,
        bytes memory ancillaryData,
        uint256 customLiveness
    ) external;

    /**
     * @notice Proposes a price value for an existing request
     * @param requester Address that made the original request
     * @param identifier Price identifier
     * @param timestamp Request timestamp
     * @param ancillaryData Request ancillary data
     * @param proposedPrice Proposed price value
     * @return totalBond The bond currency amount
     */
    function proposePrice(
        address requester,
        bytes32 identifier,
        uint256 timestamp,
        bytes memory ancillaryData,
        int256 proposedPrice
    ) external returns (uint256 totalBond);

    /**
     * @notice Settles a request after liveness period
     * @param requester Address that made the original request
     * @param identifier Price identifier
     * @param timestamp Request timestamp
     * @param ancillaryData Request ancillary data
     * @return payout The payout amount
     */
    function settle(
        address requester,
        bytes32 identifier,
        uint256 timestamp,
        bytes memory ancillaryData
    ) external returns (uint256 payout);

    /**
     * @notice Get the request data
     * @param requester Address that made the original request
     * @param identifier Price identifier
     * @param timestamp Request timestamp
     * @param ancillaryData Request ancillary data
     * @return request The request struct
     */
    function getRequest(
        address requester,
        bytes32 identifier,
        uint256 timestamp,
        bytes memory ancillaryData
    ) external view returns (Request memory);

    /**
     * @notice Check if request has resolved price
     * @param requester Address that made the original request
     * @param identifier Price identifier
     * @param timestamp Request timestamp
     * @param ancillaryData Request ancillary data
     * @return hasPrice Whether price has been resolved
     */
    function hasPrice(
        address requester,
        bytes32 identifier,
        uint256 timestamp,
        bytes memory ancillaryData
    ) external view returns (bool);

    /**
     * @notice Get state of the request
     * @param requester Address that made the original request
     * @param identifier Price identifier
     * @param timestamp Request timestamp
     * @param ancillaryData Request ancillary data
     * @return state The state of the request
     */
    function getState(
        address requester,
        bytes32 identifier,
        uint256 timestamp,
        bytes memory ancillaryData
    ) external view returns (uint8);
}
