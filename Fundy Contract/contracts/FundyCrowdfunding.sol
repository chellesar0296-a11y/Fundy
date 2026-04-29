// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FundyToken.sol"; // CampaignStakeToken + CampaignStakeTokenFactory

/**
 * @title FundyCrowdfunding
 * @notice Crowdfunding with per-campaign ERC-20 stake tokens.
 *
 * Token mechanics:
 *  - Each campaign gets its own CampaignStakeToken (FDY-XXXX), deployed by factory at campaign creation.
 *  - Automatic reward: 1 ETH donated = 100 stake tokens, minted when organizer withdraws.
 *  - Extra reward: up to `extraQuantity` donors who donate >= `extraMinDonate` each receive
 *    `extraFdyAmount` additional tokens (also minted at withdrawal, cost deducted from ETH payout).
 *    Cost = extraQuantity * extraFdyAmount / TOKENS_PER_ETH  (in ETH, using 18-decimal math).
 *  - Stake tokens are fully transferable ERC-20 — tradeable on any platform.
 */
contract FundyCrowdfunding is ReentrancyGuard {
    // ── Constants ─────────────────────────────────────────────
    uint256 public constant TOKENS_PER_ETH = 100;

    // ── Structs ───────────────────────────────────────────────
    struct Campaign {
        string  supabaseId;
        address organizer;
        uint256 goalAmount;       // wei
        uint256 deadline;         // unix timestamp
        uint256 totalRaisedEth;   // wei
        bool    withdrawn;
        bool    cancelled;
        // per-campaign stake token
        address stakeToken;
        string  tokenSymbol;
        // extra reward config
        bool    hasExtraToken;
        uint256 extraQuantity;     // max number of donors who get extra tokens
        uint256 extraFdyAmount;    // tokens (18-decimal) per qualifying donor
        uint256 extraMinDonate;    // minimum ETH (wei) to qualify
        uint256 extraAwarded;      // how many extra rewards have been given
    }

    // ── State ─────────────────────────────────────────────────
    CampaignStakeTokenFactory public immutable factory;
    address public owner;
    bool    public initialized;
    uint256 public campaignCount;

    mapping(uint256 => Campaign)                        public campaigns;
    mapping(uint256 => mapping(address => uint256))     public ethDonations;
    mapping(uint256 => address[])                       public donors;
    mapping(uint256 => mapping(address => bool))        public isDonor;
    mapping(uint256 => mapping(address => bool))        public extraAwarded;   // has this donor received extra?
    mapping(address => bool)                            public admins;

    // ── Events ────────────────────────────────────────────────
    event CampaignCreated(
        uint256 indexed campaignId,
        string  supabaseId,
        address organizer,
        uint256 goal,
        uint256 deadline,
        address stakeToken,
        string  tokenSymbol
    );
    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 ethAmount
    );
    event FundsWithdrawn(
        uint256 indexed campaignId,
        address organizer,
        uint256 ethPaid,
        uint256 autoTokensMinted,
        uint256 extraTokensMinted
    );
    event EthRefundIssued(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );
    event CampaignCancelled(uint256 indexed campaignId);
    event Initialized(address indexed caller);

    // ── Modifiers ─────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    modifier exists(uint256 id) {
        require(id > 0 && id <= campaignCount, "Campaign does not exist");
        _;
    }
    modifier active(uint256 id) {
        Campaign storage c = campaigns[id];
        require(!c.cancelled,                      "Campaign cancelled");
        require(block.timestamp < c.deadline,       "Campaign deadline passed");
        _;
    }

    // ── Constructor ───────────────────────────────────────────
    constructor(address _factory) {
        owner   = msg.sender;
        factory = CampaignStakeTokenFactory(_factory);
    }

    function init() external onlyOwner {
        require(!initialized, "Already initialized");
        initialized = true;
        emit Initialized(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function addAdmin(address admin) external onlyOwner {
        require(admin != address(0), "Zero address");
        admins[admin] = true;
    }

    function removeAdmin(address admin) external onlyOwner {
        admins[admin] = false;
    }

    // ── Create campaign ───────────────────────────────────────
    /**
     * @param supabaseId        Supabase UUID of the campaign
     * @param goalWei           Fundraising goal in wei
     * @param deadline          Unix timestamp of campaign end
     * @param campaignTitle     Used to derive token symbol (FDY-XXXX)
     * @param extraQuantity     Max donors who receive extra tokens (0 = disabled, max 99)
     * @param extraFdyAmount    Tokens per qualifying donor (18-decimal, 0 = disabled)
     * @param extraMinDonate    Min ETH (wei) required to qualify for extra tokens
     */
    function createCampaign(
        string  calldata supabaseId,
        uint256 goalWei,
        uint256 deadline,
        string  calldata campaignTitle,
        uint256 extraQuantity,
        uint256 extraFdyAmount,
        uint256 extraMinDonate
    ) external returns (uint256 campaignId) {
        require(initialized,                  "Not initialized");
        require(deadline > block.timestamp,   "Deadline must be future");
        require(goalWei > 0,                  "Goal must be > 0");
        require(extraQuantity <= 99,          "Max 99 extra slots");

        // Validate extra config
        if (extraQuantity > 0) {
            require(extraFdyAmount > 0,       "extraFdyAmount required");
            require(extraMinDonate >= 1 ether,"Min donate >= 1 ETH");
        }

        campaignCount++;
        campaignId = campaignCount;

        // Deploy per-campaign stake token via factory
        address tokenAddr = factory.deploy(campaignId, campaignTitle, address(this));
        string memory sym = CampaignStakeToken(tokenAddr).symbol();

        campaigns[campaignId] = Campaign({
            supabaseId:     supabaseId,
            organizer:      msg.sender,
            goalAmount:     goalWei,
            deadline:       deadline,
            totalRaisedEth: 0,
            withdrawn:      false,
            cancelled:      false,
            stakeToken:     tokenAddr,
            tokenSymbol:    sym,
            hasExtraToken:  extraQuantity > 0 && extraFdyAmount > 0,
            extraQuantity:  extraQuantity,
            extraFdyAmount: extraFdyAmount,
            extraMinDonate: extraMinDonate,
            extraAwarded:   0
        });

        emit CampaignCreated(campaignId, supabaseId, msg.sender, goalWei, deadline, tokenAddr, sym);
    }

    // ── Donate (ETH only) ─────────────────────────────────────
    function donate(
        uint256 campaignId
    ) external payable exists(campaignId) active(campaignId) nonReentrant {
        require(msg.value > 0, "Must send ETH");
        Campaign storage c = campaigns[campaignId];
        require(msg.sender != c.organizer, "Organizer cannot donate");

        if (!isDonor[campaignId][msg.sender]) {
            donors[campaignId].push(msg.sender);
            isDonor[campaignId][msg.sender] = true;
        }
        ethDonations[campaignId][msg.sender] += msg.value;
        c.totalRaisedEth                     += msg.value;

        // Track extra eligibility: mark donor as eligible if they qualify and slots remain
        // (actual minting happens at withdrawal to save gas and avoid pre-funding)
        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    // ── Withdraw (organizer) ──────────────────────────────────
    /**
     * @notice Organizer calls after goal is reached.
     *         1. Mints automatic stake tokens to every donor (1 ETH = 100 tokens).
     *         2. Mints extra stake tokens to qualifying donors (up to extraQuantity slots).
     *         3. Deducts ETH cost of extra tokens from payout.
     *         4. Sends remaining ETH to organizer.
     */
    function withdraw(
        uint256 campaignId
    ) external exists(campaignId) nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(msg.sender == c.organizer, "Not organizer");
        require(!c.cancelled,              "Campaign cancelled");
        require(!c.withdrawn,              "Already withdrawn");
        require(c.totalRaisedEth >= c.goalAmount, "Goal not reached");

        c.withdrawn = true;

        address[] memory donorList  = donors[campaignId];
        CampaignStakeToken token    = CampaignStakeToken(c.stakeToken);
        uint256 autoTotal           = 0;
        uint256 extraTotal          = 0;
        uint256 extraEthCost        = 0;   // ETH to deduct for extra tokens

        // Pre-calculate total extra ETH cost
        if (c.hasExtraToken) {
            uint256 slotsRemaining = c.extraQuantity;
            for (uint256 i = 0; i < donorList.length && slotsRemaining > 0; i++) {
                address d = donorList[i];
                if (ethDonations[campaignId][d] >= c.extraMinDonate && !extraAwarded[campaignId][d]) {
                    slotsRemaining--;
                }
            }
            uint256 extraCount = c.extraQuantity - slotsRemaining;
            // cost per token = 1 ETH / TOKENS_PER_ETH / 10^18 * 10^18 = 1 ETH / TOKENS_PER_ETH
            // extraFdyAmount is already 18-decimal tokens
            // ETH cost = extraCount * extraFdyAmount / (TOKENS_PER_ETH * 1e18) * 1e18
            //          = extraCount * extraFdyAmount / TOKENS_PER_ETH
            extraEthCost = (extraCount * c.extraFdyAmount) / (TOKENS_PER_ETH * 1e18) * 1e18;
            // Simpler: (extraCount * c.extraFdyAmount) / TOKENS_PER_ETH but keep 18 decimals:
            extraEthCost = (extraCount * c.extraFdyAmount) / TOKENS_PER_ETH;
        }

        // Safety: if extra cost > raised, cap it (should not happen with validation)
        if (extraEthCost >= c.totalRaisedEth) extraEthCost = 0;

        uint256 extraSlotsLeft = c.extraQuantity;

        // Mint tokens to all donors
        for (uint256 i = 0; i < donorList.length; i++) {
            address d    = donorList[i];
            uint256 eth  = ethDonations[campaignId][d];
            if (eth == 0) continue;

            // Automatic: 1 ETH = 100 tokens (18-decimal)
            uint256 autoAmt = (eth * TOKENS_PER_ETH * 1e18) / 1e18;
            // Simpler without losing precision:
            autoAmt = eth * TOKENS_PER_ETH;
            token.mint(d, autoAmt);
            autoTotal += autoAmt;

            // Extra: if qualifies and slots remain
            if (c.hasExtraToken && extraSlotsLeft > 0 && eth >= c.extraMinDonate && !extraAwarded[campaignId][d]) {
                extraAwarded[campaignId][d] = true;
                c.extraAwarded++;
                extraSlotsLeft--;
                token.mint(d, c.extraFdyAmount);
                extraTotal += c.extraFdyAmount;
            }
        }

        // Recalculate actual extra ETH cost from actual extraTotal minted
        // ETH cost = extraTotal tokens / TOKENS_PER_ETH (since 1 ETH = 100 tokens, 18 decimals each)
        uint256 actualExtraEthCost = extraTotal / TOKENS_PER_ETH;
        if (actualExtraEthCost > c.totalRaisedEth) actualExtraEthCost = 0;

        uint256 ethToSend = c.totalRaisedEth - actualExtraEthCost;

        if (ethToSend > 0) {
            (bool ok,) = payable(c.organizer).call{value: ethToSend}("");
            require(ok, "Transfer failed");
        }

        emit FundsWithdrawn(campaignId, c.organizer, ethToSend, autoTotal, extraTotal);
    }

    // ── Refund (donors, if goal not met) ──────────────────────
    function claimRefund(
        uint256 campaignId
    ) external exists(campaignId) nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(!c.withdrawn, "Already withdrawn");
        require(
            c.cancelled ||
            (block.timestamp >= c.deadline && c.totalRaisedEth < c.goalAmount),
            "Refund not available"
        );

        uint256 ethAmount = ethDonations[campaignId][msg.sender];
        require(ethAmount > 0, "Nothing to refund");
        ethDonations[campaignId][msg.sender] = 0;

        (bool ok,) = payable(msg.sender).call{value: ethAmount}("");
        require(ok, "ETH refund failed");
        emit EthRefundIssued(campaignId, msg.sender, ethAmount);
    }

    // ── Cancel campaign ───────────────────────────────────────
    function cancelCampaign(
        uint256 campaignId
    ) external exists(campaignId) nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(
            msg.sender == owner || msg.sender == c.organizer || admins[msg.sender],
            "Not authorized"
        );
        require(!c.cancelled,  "Already cancelled");
        require(!c.withdrawn,  "Already withdrawn");

        c.cancelled = true;
        emit CampaignCancelled(campaignId);

        address[] memory donorList = donors[campaignId];
        for (uint256 i = 0; i < donorList.length; i++) {
            address d     = donorList[i];
            uint256 ethAmt = ethDonations[campaignId][d];
            if (ethAmt > 0) {
                ethDonations[campaignId][d] = 0;
                (bool ok,) = payable(d).call{value: ethAmt}("");
                if (ok) emit EthRefundIssued(campaignId, d, ethAmt);
            }
        }
    }

    // ── Admin: trigger expired refunds ────────────────────────
    function triggerExpiredRefunds(
        uint256 campaignId
    ) external exists(campaignId) nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(
            msg.sender == owner || msg.sender == c.organizer || admins[msg.sender],
            "Not authorized"
        );
        require(!c.cancelled,                    "Already cancelled");
        require(!c.withdrawn,                    "Already withdrawn");
        require(block.timestamp >= c.deadline,   "Not expired yet");
        require(c.totalRaisedEth < c.goalAmount, "Goal was reached");

        c.cancelled = true;
        emit CampaignCancelled(campaignId);

        address[] memory donorList = donors[campaignId];
        for (uint256 i = 0; i < donorList.length; i++) {
            address d     = donorList[i];
            uint256 ethAmt = ethDonations[campaignId][d];
            if (ethAmt > 0) {
                ethDonations[campaignId][d] = 0;
                (bool ok,) = payable(d).call{value: ethAmt}("");
                if (ok) emit EthRefundIssued(campaignId, d, ethAmt);
            }
        }
    }

    // ── View helpers ──────────────────────────────────────────
    function getCampaign(uint256 id) external view exists(id) returns (Campaign memory) {
        return campaigns[id];
    }

    function totalRaised(uint256 id) external view exists(id) returns (uint256) {
        return campaigns[id].totalRaisedEth;
    }

    function getEthDonation(uint256 id, address donor) external view returns (uint256) {
        return ethDonations[id][donor];
    }

    function getDonors(uint256 id) external view returns (address[] memory) {
        return donors[id];
    }

    function isGoalReached(uint256 id) external view exists(id) returns (bool) {
        return campaigns[id].totalRaisedEth >= campaigns[id].goalAmount;
    }

    function isRefundable(uint256 id) external view exists(id) returns (bool) {
        Campaign storage c = campaigns[id];
        return !c.withdrawn && (
            c.cancelled ||
            (block.timestamp >= c.deadline && c.totalRaisedEth < c.goalAmount)
        );
    }

    /// @notice Returns extra reward details: quantity, fdyAmount, minDonate, slotsRemaining
    function getExtraRewardInfo(uint256 id) external view exists(id) returns (
        bool   hasExtra,
        uint256 quantity,
        uint256 fdyAmount,
        uint256 minDonate,
        uint256 slotsRemaining
    ) {
        Campaign storage c = campaigns[id];
        hasExtra       = c.hasExtraToken;
        quantity       = c.extraQuantity;
        fdyAmount      = c.extraFdyAmount;
        minDonate      = c.extraMinDonate;
        slotsRemaining = c.extraQuantity > c.extraAwarded
                         ? c.extraQuantity - c.extraAwarded
                         : 0;
    }

    /// @notice Returns stake token balance of a donor for a campaign
    function stakeBalance(uint256 id, address donor) external view exists(id) returns (uint256) {
        return CampaignStakeToken(campaigns[id].stakeToken).balanceOf(donor);
    }

    /// @notice Total stake tokens minted for a campaign
    function totalStake(uint256 id) external view exists(id) returns (uint256) {
        return CampaignStakeToken(campaigns[id].stakeToken).totalSupply();
    }

    /// @notice Estimated extra ETH cost at withdrawal (before it happens)
    function estimatedExtraCost(uint256 id) external view exists(id) returns (uint256 ethCost) {
        Campaign storage c = campaigns[id];
        if (!c.hasExtraToken) return 0;

        uint256 eligibleCount = 0;
        address[] memory dl   = donors[id];
        for (uint256 i = 0; i < dl.length && eligibleCount < c.extraQuantity; i++) {
            if (ethDonations[id][dl[i]] >= c.extraMinDonate) {
                eligibleCount++;
            }
        }
        ethCost = (eligibleCount * c.extraFdyAmount) / TOKENS_PER_ETH;
    }

    receive() external payable {}
}
