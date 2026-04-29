// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BatchTransfer {
    function disperseEther(address[] calldata recipients, uint256[] calldata values) external payable {
        require(recipients.length == values.length, "Length mismatch");
        uint256 totalSent = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            totalSent += values[i];
            payable(recipients[i]).transfer(values[i]);
        }
        require(msg.value >= totalSent, "Insufficient ETH sent");
        if (msg.value > totalSent) {
            payable(msg.sender).transfer(msg.value - totalSent);
        }
    }
}