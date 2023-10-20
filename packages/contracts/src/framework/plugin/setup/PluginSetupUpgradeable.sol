// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.8;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {IProtocolVersion, ProtocolVersion} from "../../../utils/protocol/ProtocolVersion.sol";
import {PermissionLib} from "../../../core/permission/PermissionLib.sol";
import {IPluginSetup} from "./IPluginSetup.sol";

/// @title PluginSetup
/// @author Aragon Association - 2022-2023
/// @notice An abstract contract that developers have to inherit from to write the setup of a plugin.
abstract contract PluginSetupUpgradeable is ERC165, IPluginSetup, ProtocolVersion {
    /// @notice The address of plugin implementation contract to create [ERC-1967](https://eips.ethereum.org/EIPS/eip-1967) proxies from.
    address public immutable implementation;

    /// @notice The contract constructor, that deploys the `Multisig` plugin logic contract.
    constructor(address _implementation) {
        implementation = _implementation;
    }

    /// @inheritdoc IPluginSetup
    function prepareUpdate(
        address _dao,
        uint16 _currentBuild,
        SetupPayload calldata _payload
    )
        external
        virtual
        override
        returns (bytes memory initData, PreparedSetupData memory preparedSetupData)
    {}

    /// @notice A convenience function to create an [ERC-1967](https://eips.ethereum.org/EIPS/eip-1967) proxy contract pointing to an implementation and being associated to a DAO.
    /// @param _implementation The address of the implementation contract to which the proxy is pointing to.
    /// @param _data The data to initialize the storage of the proxy contract.
    /// @return The address of the created proxy contract.
    function createERC1967Proxy(
        address _implementation,
        bytes memory _data
    ) internal returns (address) {
        return address(new ERC1967Proxy(_implementation, _data));
    }

    /// @notice Checks if this or the parent contract supports an interface by its ID.
    /// @param _interfaceId The ID of the interface.
    /// @return Returns `true` if the interface is supported.
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return
            _interfaceId == type(IPluginSetup).interfaceId ||
            _interfaceId == type(IProtocolVersion).interfaceId ||
            super.supportsInterface(_interfaceId);
    }
}
