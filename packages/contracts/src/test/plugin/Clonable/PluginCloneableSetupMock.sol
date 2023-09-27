// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {PermissionLib} from "../../../core/permission/PermissionLib.sol";
import {IDAO} from "../../../core/dao/IDAO.sol";
import {PluginSetup} from "../../../framework/plugin/setup/PluginSetup.sol";
import {IPluginSetup} from "../../../framework/plugin/setup/IPluginSetup.sol";
import {mockPermissions, mockHelpers, mockPluginProxy} from "../PluginMockData.sol";
import {PluginCloneableBuild1Mock, PluginCloneableBuild1MockBad, PluginCloneableBuild2Mock} from "./PluginCloneableMock.sol";

contract PluginCloneableSetupBuild1Mock is PluginSetup {
    address internal pluginBase;

    constructor() {
        pluginBase = address(new PluginCloneableBuild1Mock());
    }

    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes memory
    ) public virtual override returns (address plugin, PreparedSetupData memory preparedSetupData) {
        plugin = mockPluginProxy(pluginBase, _dao);
        preparedSetupData.helpers = mockHelpers(1);
        preparedSetupData.permissions = mockPermissions(5, 6, PermissionLib.Operation.Grant);
    }

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    ) external virtual override returns (PermissionLib.MultiTargetPermission[] memory permissions) {
        (_dao, _payload);
        permissions = mockPermissions(5, 6, PermissionLib.Operation.Revoke);
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view virtual override returns (address) {
        return address(pluginBase);
    }
}

contract PluginCloneableSetupBuild1MockBad is PluginCloneableSetupBuild1Mock {
    constructor() {
        pluginBase = address(new PluginCloneableBuild1MockBad());
    }
}

contract PluginCloneableSetupBuild2Mock is PluginCloneableSetupBuild1Mock {
    constructor() {
        pluginBase = address(new PluginCloneableBuild2Mock());
    }

    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes memory
    ) public virtual override returns (address plugin, PreparedSetupData memory preparedSetupData) {
        plugin = mockPluginProxy(pluginBase, _dao);
        preparedSetupData.helpers = mockHelpers(1);
        preparedSetupData.permissions = mockPermissions(5, 7, PermissionLib.Operation.Grant);
    }

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    ) external virtual override returns (PermissionLib.MultiTargetPermission[] memory permissions) {
        (_dao, _payload);
        permissions = mockPermissions(5, 7, PermissionLib.Operation.Revoke);
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view virtual override returns (address) {
        return address(pluginBase);
    }
}
