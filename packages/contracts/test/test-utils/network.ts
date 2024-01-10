import {networks, mainnet} from '@aragon/osx-commons-configs';
import { BigNumber } from 'ethers';
import {ethers} from 'hardhat';

export async function fork(version: Versions, network: SupportedNetworks) {
  const networkDeployment = getNetworkDeployment(network);
  const versionDeployment = networkDeployment[version];
  const latestBlock = getLatestBlockForDeployment(versionDeployment);

  await resetForkToBlock(network, latestBlock);
}

export async function resetForkToBlock(
  network: SupportedNetworks,
  blockNumber: number
) {
  await ethers.provider.send('hardhat_reset', [
    {
      forking: {
        jsonRpcUrl: networks[network].url,
        blockNumber: blockNumber,
      },
    },
  ]);
}

export async function getContractAddress(
  version: Versions,
  network: SupportedNetworks,
  contract: string
) {
  const networkDeployment = getNetworkDeployment(network);
  const versionDeployment = networkDeployment[version];
  return versionDeployment[contract].address;
}

export async function unfork() {
  await ethers.provider.send('hardhat_reset', []);
}

export function getLatestBlockForDeployment(deployment: {
  [index: string]: ContractDeployment;
}) {
  let latestBlock = 0;
  for (const contract of Object.keys(deployment)) {
    if (deployment[contract].blockNumber > latestBlock) {
      latestBlock = deployment[contract].blockNumber;
    }
  }
  return latestBlock;
}

export function getNetworkDeployment(
  network: SupportedNetworks
): NetworkDeployment {
  switch (network) {
    case SupportedNetworks.MAINNET:
      return mainnet;
  }
}

export function fundAccount(address: string, amount: BigNumber) {
  return ethers.provider.send('hardhat_setBalance', [address, `0x${amount.toBigInt().toString(16)}`]);
}

export type ContractDeployment = {
  address: string;
  blockNumber: number;
  deploymentTx: string;
};

export enum Versions {
  V100 = 'v1.0.0',
  V130 = 'v1.3.0',
}

export enum SupportedNetworks {
  MAINNET = 'mainnet',
}

export type NetworkDeployment = {
  [index in Versions]: {[index: string]: ContractDeployment};
};
