// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FundyToken.sol";

contract FundyCrowdfunding is ReentrancyGuard {
    struct Campaign {
        string supabaseId;
        address organizer;
        uint256 goalAmount;
        uint256 deadline;
        uint256 totalRaisedEth;
        uint256 totalRaisedFdy;
        bool withdrawn;
        bool cancelled;
        bool hasExtraToken;
        uint256 extraTokenAmount;
        uint256 extraTokenMinDonate;
    }

    FundyToken public immutable token;
    address public owner;
    bool public initialized;

    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public ethDonations;
    mapping(uint256 => mapping(address => uint256)) public fdyDonations;
    mapping(uint256 => address[]) public donors;
    mapping(uint256 => mapping(address => bool)) public isDonor;
    mapping(address => bool) public admins;

    event CampaignCreated(
        uint256 indexed campaignId,
        string supabaseId,
        address organizer,
        uint256 goal,
        uint256 deadline
    );
    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 ethAmount,
        uint256 fdyMinted
    );
    event ExtraFdyAwarded(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 fdyAmount
    );
    event FdyDonation(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 fdyBurned,
        uint256 ethEquivalent
    );
    event FundsWithdrawn(
        uint256 indexed campaignId,
        address organizer,
        uint256 ethAmount,
        uint256 fdyEquivalent
    );
    event EthRefundIssued(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );
    event FdyRefundIssued(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 fdyAmount
    );
    event CampaignCancelled(uint256 indexed campaignId);
    event Initialized(address indexed caller);
    event FdyPurchased(
        address indexed buyer,
        uint256 ethAmount,
        uint256 fdyMinted
    );

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
        require(!c.cancelled, "Campaign cancelled");
        require(block.timestamp < c.deadline, "Campaign deadline passed");
        _;
    }

    constructor(address _token) {
        owner = msg.sender;
        token = FundyToken(_token);
    }

    function init() external onlyOwner {
        require(!initialized, "Already initialized");
        initialized = true;
        token.setCrowdfundingContract(address(this));
        emit Initialized(msg.sender);
    }

    // ── Buy FDY ────────────────────────────────────────────────
    function buyFdy() external payable {
        require(msg.value > 0, "Must send ETH");
        uint256 minted = token.mintForDonation(msg.sender, msg.value);
        emit FdyPurchased(msg.sender, msg.value, minted);
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

    function createCampaign(
        string calldata supabaseId,
        uint256 goalWei,
        uint256 deadline,
        string calldata, // nftUri — kept for frontend ABI compatibility, ignored
        uint256 extraTokenAmount,
        uint256 extraTokenMinDonate
    ) external returns (uint256 campaignId) {
        require(initialized, "Not initialized");
        require(deadline > block.timestamp, "Deadline must be future");
        require(goalWei > 0, "Goal must be > 0");

        campaignCount++;
        campaignId = campaignCount;

        campaigns[campaignId] = Campaign({
            supabaseId: supabaseId,
            organizer: msg.sender,
            goalAmount: goalWei,
            deadline: deadline,
            totalRaisedEth: 0,
            totalRaisedFdy: 0,
            withdrawn: false,
            cancelled: false,
            hasExtraToken: extraTokenAmount > 0,
            extraTokenAmount: extraTokenAmount,
            extraTokenMinDonate: extraTokenMinDonate
        });

        emit CampaignCreated(
            campaignId,
            supabaseId,
            msg.sender,
            goalWei,
            deadline
        );
    }

    function donate(
        uint256 campaignId
    ) external payable exists(campaignId) active(campaignId) nonReentrant {
        require(msg.value > 0, "Must send ETH");
        Campaign storage c = campaigns[campaignId];
        require(
            msg.sender != c.organizer,
            "Organizer cannot donate to own campaign"
        );

        _recordEthDonation(campaignId, msg.sender, msg.value);

        uint256 fdyMinted = token.mintForDonation(msg.sender, msg.value);
        emit DonationReceived(campaignId, msg.sender, msg.value, fdyMinted);

        if (c.hasExtraToken && msg.value >= c.extraTokenMinDonate) {
            _tryAwardExtraFdy(campaignId, msg.sender, c);
        }
    }

    function donateWithFdy(
        uint256 campaignId,
        uint256 fdyAmount
    ) external exists(campaignId) active(campaignId) nonReentrant {
        require(fdyAmount > 0, "Must send FDY");
        Campaign storage c = campaigns[campaignId];
        require(
            msg.sender != c.organizer,
            "Organizer cannot donate to own campaign"
        );

        uint256 ethEquivalent = token.fdyToEth(fdyAmount);
        require(ethEquivalent > 0, "FDY amount too small");

        token.burnForDonation(msg.sender, fdyAmount);
        _recordFdyDonation(campaignId, msg.sender, fdyAmount, ethEquivalent);
        emit FdyDonation(campaignId, msg.sender, fdyAmount, ethEquivalent);
    }

    function _recordEthDonation(
        uint256 campaignId,
        address donor,
        uint256 amount
    ) internal {
        if (!isDonor[campaignId][donor]) {
            donors[campaignId].push(donor);
            isDonor[campaignId][donor] = true;
        }
        ethDonations[campaignId][donor] += amount;
        campaigns[campaignId].totalRaisedEth += amount;
    }

    function _recordFdyDonation(
        uint256 campaignId,
        address donor,
        uint256 fdyAmount,
        uint256 ethEquivalent
    ) internal {
        if (!isDonor[campaignId][donor]) {
            donors[campaignId].push(donor);
            isDonor[campaignId][donor] = true;
        }
        fdyDonations[campaignId][donor] += fdyAmount;
        campaigns[campaignId].totalRaisedFdy += ethEquivalent;
    }

    function _tryAwardExtraFdy(
        uint256 campaignId,
        address donor,
        Campaign storage c
    ) internal {
        try token.transferFrom(c.organizer, donor, c.extraTokenAmount) {
            emit ExtraFdyAwarded(campaignId, donor, c.extraTokenAmount);
        } catch {}
    }

    function withdraw(
        uint256 campaignId
    ) external exists(campaignId) nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(msg.sender == c.organizer, "Not organizer");
        require(!c.cancelled, "Campaign cancelled");
        require(!c.withdrawn, "Already withdrawn");
        require(
            c.totalRaisedEth + c.totalRaisedFdy >= c.goalAmount,
            "Goal not reached"
        );

        c.withdrawn = true;

        uint256 ethToSend = c.totalRaisedEth;
        if (ethToSend > 0) {
            (bool ok, ) = payable(c.organizer).call{value: ethToSend}("");
            require(ok, "Transfer failed");
        }

        emit FundsWithdrawn(
            campaignId,
            c.organizer,
            ethToSend,
            c.totalRaisedFdy
        );
    }

    function claimRefund(
        uint256 campaignId
    ) external exists(campaignId) nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(!c.withdrawn, "Funds already withdrawn");
        require(
            c.cancelled ||
                (block.timestamp >= c.deadline &&
                    c.totalRaisedEth + c.totalRaisedFdy < c.goalAmount),
            "Refund not available"
        );

        uint256 ethAmount = ethDonations[campaignId][msg.sender];
        if (ethAmount > 0) {
            ethDonations[campaignId][msg.sender] = 0;
            (bool ok, ) = payable(msg.sender).call{value: ethAmount}("");
            require(ok, "ETH refund failed");
            emit EthRefundIssued(campaignId, msg.sender, ethAmount);
        }

        uint256 fdyAmount = fdyDonations[campaignId][msg.sender];
        if (fdyAmount > 0) {
            fdyDonations[campaignId][msg.sender] = 0;
            uint256 ethEquiv = fdyAmount / token.TOKENS_PER_ETH();
            token.mintForDonation(msg.sender, ethEquiv);
            emit FdyRefundIssued(campaignId, msg.sender, fdyAmount);
        }

        require(ethAmount > 0 || fdyAmount > 0, "Nothing to refund");
    }

    function cancelCampaign(
        uint256 campaignId
    ) external exists(campaignId) nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(
            msg.sender == owner ||
                msg.sender == c.organizer ||
                admins[msg.sender],
            "Not authorized"
        );
        require(!c.cancelled, "Already cancelled");
        require(!c.withdrawn, "Already withdrawn");

        c.cancelled = true;
        emit CampaignCancelled(campaignId);

        // automatically refund
        address[] memory donorList = donors[campaignId];
        for (uint256 i = 0; i < donorList.length; i++) {
            address donor = donorList[i];

            uint256 ethAmt = ethDonations[campaignId][donor];
            if (ethAmt > 0) {
                ethDonations[campaignId][donor] = 0;
                (bool ok, ) = payable(donor).call{value: ethAmt}("");
                if (ok) emit EthRefundIssued(campaignId, donor, ethAmt);
            }
        }
    }

    function getCampaign(
        uint256 id
    ) external view exists(id) returns (Campaign memory) {
        return campaigns[id];
    }

    function totalRaised(
        uint256 id
    ) external view exists(id) returns (uint256) {
        return campaigns[id].totalRaisedEth + campaigns[id].totalRaisedFdy;
    }

    function getEthDonation(
        uint256 id,
        address donor
    ) external view returns (uint256) {
        return ethDonations[id][donor];
    }

    function getFdyDonation(
        uint256 id,
        address donor
    ) external view returns (uint256) {
        return fdyDonations[id][donor];
    }

    function getDonors(uint256 id) external view returns (address[] memory) {
        return donors[id];
    }

    function isGoalReached(uint256 id) external view exists(id) returns (bool) {
        Campaign storage c = campaigns[id];
        return c.totalRaisedEth + c.totalRaisedFdy >= c.goalAmount;
    }

    function isRefundable(uint256 id) external view exists(id) returns (bool) {
        Campaign storage c = campaigns[id];
        return
            !c.withdrawn &&
            (c.cancelled ||
                (block.timestamp >= c.deadline &&
                    c.totalRaisedEth + c.totalRaisedFdy < c.goalAmount));
    }

    function triggerExpiredRefunds(
        uint256 campaignId
    ) external exists(campaignId) nonReentrant {
        Campaign storage c = campaigns[campaignId];

        require(
            msg.sender == owner ||
                msg.sender == c.organizer ||
                admins[msg.sender],
            "Not authorized"
        );
        require(!c.cancelled, "Already cancelled");
        require(!c.withdrawn, "Already withdrawn");
        require(block.timestamp >= c.deadline, "Campaign not expired yet");
        require(
            c.totalRaisedEth + c.totalRaisedFdy < c.goalAmount,
            "Goal was reached, no refund"
        );

        c.cancelled = true;
        emit CampaignCancelled(campaignId);

        address[] memory donorList = donors[campaignId];
        for (uint256 i = 0; i < donorList.length; i++) {
            address donor = donorList[i];

            // refund ETH only
            uint256 ethAmt = ethDonations[campaignId][donor];
            if (ethAmt > 0) {
                ethDonations[campaignId][donor] = 0;
                (bool ok, ) = payable(donor).call{value: ethAmt}("");
                if (ok) emit EthRefundIssued(campaignId, donor, ethAmt);
            }
        }
    }

    receive() external payable {}
}
