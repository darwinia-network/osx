// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.8;

import {PermissionLib} from "@aragon/osx-commons-contracts/src/permission/PermissionLib.sol";
import {IPluginSetup} from "@aragon/osx-commons-contracts/src/plugin/setup/IPluginSetup.sol";
import {PluginSetup} from "@aragon/osx-commons-contracts/src/plugin/setup/PluginSetup.sol";
import {IDAO} from "@aragon/osx-commons-contracts/src/dao/IDAO.sol";

import {DAO} from "../../../core/dao/DAO.sol";
import {Multisig} from "./Multisig.sol";
import "hardhat/console.sol";

import "@novaknole20/zodiac-modifier-roles/contracts/Types.sol";

/// @title MultisigSetup
/// @author Aragon Association - 2022-2023
/// @notice The setup contract of the `Multisig` plugin.
/// @dev v1.2 (Release 1, Build 2)
/// @custom:security-contact sirt@aragon.org
contract MultisigSetup is PluginSetup {
    /// @notice The address of `Multisig` plugin logic contract to be used in creating proxy contracts.
    Multisig private immutable multisigBase;

    /// @notice The contract constructor, that deploys the `Multisig` plugin logic contract.
    constructor() {
        multisigBase = new Multisig();
    }


    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes calldata _data
    ) external returns (address plugin, PreparedSetupData memory preparedSetupData) {
        // Decode `_data` to extract the params needed for deploying and initializing `Multisig` plugin.
        (address[] memory members, Multisig.MultisigSettings memory multisigSettings) = abi.decode(
            _data,
            (address[], Multisig.MultisigSettings)
        );

        // Prepare and Deploy the plugin proxy.
        plugin = createERC1967Proxy(
            address(multisigBase),
            abi.encodeCall(Multisig.initialize, (IDAO(_dao), members, multisigSettings))
        );

        uint k = 20;


        PermissionLib.MultiTargetPermission[] memory permissions = new PermissionLib.MultiTargetPermission[](1);
        ConditionFlat[] memory flat = new ConditionFlat[](3);
        address oebl = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        bytes memory g = abi.encode(oebl);

        flat[0] = ConditionFlat({ 
            parent: 0, 
            paramType: ParameterType.Calldata, 
            operator: Operator.Matches, 
            compValue: ""
        });
        flat[1] = ConditionFlat({ 
            parent: 0, 
            paramType: ParameterType.Array, 
            operator: Operator.Matches, 
            compValue: ""
        });
        flat[2] = ConditionFlat({ 
            parent: 1, 
            paramType: ParameterType.Static, 
            operator: Operator.EqualTo, 
            compValue: g
        });
    
        console.logBytes(g);

        permissions[0] = PermissionLib.MultiTargetPermission({
            where: plugin, who: members[0],  selector: Multisig.addAddresses.selector,
            role: multisigBase.UPDATE_MULTISIG_SETTINGS_PERMISSION_ID(), conditions:  flat,
            options: ExecutionOptions.None
        });

        preparedSetupData.permissions = permissions;
    }

    /// @inheritdoc IPluginSetup
    function prepareUpdate(
        address _dao,
        uint16 _currentBuild,
        SetupPayload calldata _payload
    )
        external
        pure
        override
        returns (bytes memory initData, PreparedSetupData memory preparedSetupData)
    {}

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    ) external view returns (PermissionLib.MultiTargetPermission[] memory permissions) {
       
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(multisigBase);
    }
}
