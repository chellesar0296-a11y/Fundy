// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CampaignStakeToken
 * @notice Per-campaign ERC-20 stake token (e.g. FDY-LIB, FDY-MED).
 *         Fully transferable — holders can trade on any DEX or platform.
 *         Only the crowdfunding contract can mint; anyone can transfer.
 */
contract CampaignStakeToken is ERC20, Ownable {
    address public crowdfundingContract;

    event TokensMinted(address indexed to, uint256 amount);
    event CrowdfundingContractSet(address indexed contractAddr);

    constructor(
        string memory name_,
        string memory symbol_,
        address crowdfunding_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(crowdfunding_ != address(0), "Zero address");
        crowdfundingContract = crowdfunding_;
        emit CrowdfundingContractSet(crowdfunding_);
    }

    modifier onlyCrowdfunding() {
        require(msg.sender == crowdfundingContract, "Not crowdfunding contract");
        _;
    }

    /// @notice Mint stake tokens to a donor. Called by crowdfunding on withdraw.
    function mint(address to, uint256 amount) external onlyCrowdfunding {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    // ── Standard ERC-20 transfers are unrestricted ─────────────
    // No override needed — default OpenZeppelin ERC20 behaviour is fully transferable.
}

/**
 * @title CampaignStakeTokenFactory
 * @notice Deploys a new CampaignStakeToken for each campaign.
 */
contract CampaignStakeTokenFactory {
    event TokenDeployed(
        uint256 indexed campaignId,
        address tokenAddress,
        string name,
        string symbol
    );

    /// @notice Deploy a new stake token for a campaign.
    function deploy(
        uint256 campaignId,
        string calldata campaignTitle,
        address crowdfunding
    ) external returns (address tokenAddress) {
        // Build symbol: FDY- + uppercase abbreviation (first 4 non-space chars)
        string memory sym = _buildSymbol(campaignTitle);
        string memory name_ = string(abi.encodePacked("Fundy Stake: ", campaignTitle));

        CampaignStakeToken token = new CampaignStakeToken(name_, sym, crowdfunding);
        tokenAddress = address(token);

        emit TokenDeployed(campaignId, tokenAddress, name_, sym);
    }

    /// @dev Build symbol FDY-XXXX from first 4 uppercase letters of title.
    function _buildSymbol(string calldata title) internal pure returns (string memory) {
        bytes memory t = bytes(title);
        bytes memory abbr = new bytes(4);
        uint256 count = 0;
        for (uint256 i = 0; i < t.length && count < 4; i++) {
            uint8 c = uint8(t[i]);
            if (c >= 65 && c <= 90) {
                abbr[count++] = t[i]; // uppercase letter
            } else if (c >= 97 && c <= 122) {
                abbr[count++] = bytes1(c - 32); // lowercase → upper
            }
        }
        // Pad with 'X' if title too short
        for (uint256 i = count; i < 4; i++) {
            abbr[i] = "X";
        }
        return string(abi.encodePacked("FDY-", abbr));
    }
}
