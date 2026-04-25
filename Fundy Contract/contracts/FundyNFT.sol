// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FundyNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    mapping(uint256 => string) public campaignNftUri;

    event NftMinted(uint256 indexed tokenId, address indexed recipient, uint256 indexed campaignId, string tokenUri);
    event CampaignNftUriSet(uint256 indexed campaignId, string uri);

    constructor() ERC721("Fundy Campaign NFT", "FCNFT") Ownable(msg.sender) {}

    function setCampaignNftUri(uint256 campaignId, string calldata uri) external onlyOwner {
        require(bytes(uri).length > 0, "URI cannot be empty");
        campaignNftUri[campaignId] = uri;
        emit CampaignNftUriSet(campaignId, uri);
    }

    function mintReward(address to, uint256 campaignId) external onlyOwner returns (uint256) {
        string memory uri = campaignNftUri[campaignId];
        require(bytes(uri).length > 0, "No NFT set for this campaign");

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit NftMinted(tokenId, to, campaignId, uri);
        return tokenId;
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
