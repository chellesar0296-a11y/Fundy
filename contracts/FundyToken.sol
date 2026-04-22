// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FundyToken (FDY)
 * @notice Platform-internal reward token.
 *         After FundyCrowdfunding.init(), ownership transfers to the
 *         crowdfunding contract, so all onlyOwner calls come from there.
 */
contract FundyToken is ERC20, Ownable {
    uint256 public constant TOKENS_PER_ETH = 100;

    address public crowdfundingContract;

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event CrowdfundingContractSet(address indexed contractAddr);

    constructor() ERC20("Fundy Token", "FDY") Ownable(msg.sender) {}

    // Called once during FundyCrowdfunding.init()
    function setCrowdfundingContract(address _contract) external onlyOwner {
        require(_contract != address(0), "Zero address");
        crowdfundingContract = _contract;
        emit CrowdfundingContractSet(_contract);
    }

    /**
     * @notice Mint FDY proportional to ETH donated.
     *         Callable by owner (= FundyCrowdfunding after init).
     */
    function mintForDonation(address to, uint256 ethAmount) external onlyOwner returns (uint256 amount) {
        amount = (ethAmount * TOKENS_PER_ETH * 10 ** decimals()) / 1 ether;
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burnForDonation(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    function fdyToEth(uint256 fdyAmount) external pure returns (uint256) {
        return (fdyAmount * 1 ether) / (TOKENS_PER_ETH * 10 ** 18);
    }

    // ── Transfer restrictions ──────────────────────────────────
    // FDY is platform-internal; only crowdfundingContract or owner may move tokens.

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(
            msg.sender == crowdfundingContract || msg.sender == owner(),
            "FDY: transfers only allowed within Fundy platform"
        );
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(
            msg.sender == crowdfundingContract || msg.sender == owner(),
            "FDY: transfers only allowed within Fundy platform"
        );
        return super.transferFrom(from, to, amount);
    }
}
