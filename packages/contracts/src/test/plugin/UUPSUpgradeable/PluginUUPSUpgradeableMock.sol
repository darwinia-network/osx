// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {PluginUUPSUpgradeable} from "../../../core/plugin/PluginUUPSUpgradeable.sol";
import {PluginRepo} from "../../../framework/plugin/repo/PluginRepo.sol";
import {IDAO} from "../../../core/dao/IDAO.sol";

contract PluginUUPSUpgradeableBuild1Mock is PluginUUPSUpgradeable {
    uint256 public state1; // Build 1

    function initialize(IDAO _dao) external initializer {
        __PluginUUPSUpgradeable_init(_dao);
        state1 = 1;
    }
}

contract PluginUUPSUpgradeableBuild2Mock is PluginUUPSUpgradeable {
    uint256 public state1; // Build 1
    uint256 public state2; // Build 2

    /// @notice Initializes Build 2
    function initialize(IDAO _dao) external reinitializer(2) {
        __PluginUUPSUpgradeable_init(_dao);
        state1 = 1;
        state2 = 2;
    }

    /// @notice Reinitializes build 2 contract after an upgrade transitioning from an earlier build.
    function initializeFrom(uint16 _previousBuild, bytes calldata _data) external reinitializer(2) {
        (_data);

        // Apply changes introduced after Build 1
        if (_previousBuild == 1) {
            state2 = 2;
        }
    }
}

contract PluginUUPSUpgradeableBuild3Mock is PluginUUPSUpgradeable {
    uint256 public state1; // Build 1
    uint256 public state2; // Build 2
    uint256 public state3; // Build 3

    /// @notice Initializes Build 3
    function initialize(IDAO _dao) external reinitializer(3) {
        __PluginUUPSUpgradeable_init(_dao);
        state1 = 1;
        state2 = 2;
        state3 = 3;
    }

    /// @notice Reinitializes build 3 after an upgrade transitioning from an earlier build.
    function initializeFrom(uint16 _previousBuild, bytes calldata _data) external reinitializer(3) {
        (_data);

        // Apply changes introduced after Build 1
        if (_previousBuild == 1) {
            state2 = 2;
        }

        // Apply changes introduced after Build 2
        if (_previousBuild <= 2) {
            state3 = 3;
        }
    }
}
