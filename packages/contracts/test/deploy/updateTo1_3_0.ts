import {expect} from 'chai';

import {deployments} from 'hardhat';
import {
  ForkOsxVersion,
  initForkForOsxVersion,
  initializeDeploymentFixture,
} from '../test-utils/fixture';
import {activeContractsList as v1_2_1_activeContracts} from '@aragon/osx-ethers-v1.2.1';

const enableTest = process.env.TEST_UPDATE_DEPLOY_SCRIPT !== undefined;

export type NetworkForkData = {
  networkName: string;
  forkBlockNumber: number;
};

if (enableTest) {
  [
    // TODO: check if those are correct forkBlockNumbers
    {networkName: 'mainnet', forkBlockNumber: 16722881},
    {networkName: 'goerli', forkBlockNumber: 9225868},
    {networkName: 'polygon', forkBlockNumber: 42000000},
    {networkName: 'mumbai', forkBlockNumber: 33960187},
  ].forEach(function (networkData: NetworkForkData) {
    describe(`${networkData.networkName} update/to_v1.3.0`, function () {
      before(async () => {
        const previousOsxVersion: ForkOsxVersion = {
          version: 'v1.0.1', // TODO: Write explaining comment why v1.0.1
          activeContracts: v1_2_1_activeContracts, // TODO: Write explaining comment why v1.2.1
          forkBlockNumber: networkData.forkBlockNumber,
        };

        await initForkForOsxVersion(
          networkData.networkName,
          previousOsxVersion
        );

        const updateDeployTags = ['v1.3.0'];
        await initializeDeploymentFixture(updateDeployTags);
      });

      it('deploys new contracts with new addresses', async function () {
        const changedContracts = [
          'DAOFactory',
          'PluginRepoFactory',
          'MultisigSetup',
          'TokenVotingSetup',
          'AddresslistVotingSetup',
          // TODO: what about `managingDAOImplemenation` (note the typo in "Implemenation" )
        ];

        const allDeployments = await deployments.all();

        changedContracts.forEach((contractName: string) => {
          const previous = (v1_2_1_activeContracts as any)[
            networkData.networkName
          ][contractName];
          const current = allDeployments[contractName].address;

          expect(previous).to.not.be.empty;
          expect(current).to.not.be.empty;
          expect(current).to.not.eq(previous);
        });
      });
    });
  });
}
