// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.8;

import {IProtocolVersion} from "./IProtocolVersion.sol";

/// @title ProtocolVersion
/// @author Aragon Association - 2022-2023
/// @notice
abstract contract ProtocolVersion is IProtocolVersion {
    uint8 public constant OSX_MAJOR_VERSION = 1;

    function protocolVersion() external view returns (uint8[3] memory _version) {
        _version[0] = OSX_MAJOR_VERSION;
        _version[1] = _protocolMinorVersion();
        _version[2] = _protocolpatchVersion();
    }

    function _protocolMinorVersion() internal view virtual returns (uint8);

    function _protocolpatchVersion() internal view virtual returns (uint8);
}
