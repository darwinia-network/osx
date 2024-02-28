import {ethers} from 'hardhat';

export const UPGRADE_PERMISSIONS = {
  UPGRADE_REGISTRY_PERMISSION_ID: ethers.utils.id(
    'UPGRADE_REGISTRY_PERMISSION'
  ),
  UPGRADE_DAO_PERMISSION_ID: ethers.utils.id('UPGRADE_DAO_PERMISSION'),
  UPGRADE_PLUGIN_PERMISSION_ID: ethers.utils.id('UPGRADE_PLUGIN_PERMISSION'),
  UPGRADE_REGISTRAR_PERMISSION_ID: ethers.utils.id(
    'UPGRADE_REGISTRAR_PERMISSION'
  ),
  UPGRADE_REPO_PERMISSION_ID: ethers.utils.id('UPGRADE_REPO_PERMISSION'),
};