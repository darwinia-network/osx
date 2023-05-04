// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.8;

uint8 constant OSX_MAJOR_VERSION = 1;
uint8 constant OSX_MINOR_VERSION = 1;
uint8 constant OSX_PATCH_VERSION = 0;

function protocolVersion() pure returns (uint8[3] memory _version) {
    _version[0] = OSX_MAJOR_VERSION;
    _version[1] = OSX_MINOR_VERSION;
    _version[2] = OSX_PATCH_VERSION;
}
