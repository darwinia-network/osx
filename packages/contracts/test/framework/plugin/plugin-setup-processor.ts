import pluginUUPSUpgradeableArtifact from '../../../artifacts/@aragon/osx-commons-contracts/src/plugin/PluginUUPSUpgradeable.sol/PluginUUPSUpgradeable.json';
import metadata from '../../../src/plugins/governance/multisig/build-metadata.json';
import {
  PluginSetupProcessor,
  PluginRepoFactory,
  PluginRepoRegistry,
  PluginRepo,
  DAO,
  MultisigSetup__factory,
  PluginRepo__factory,
  Multisig__factory,
  PluginRepoRegistry__factory,
} from '../../../typechain';
import {PluginRepoRegisteredEvent} from '../../../typechain/PluginRepoRegistry';
import {InstallationPreparedEvent} from '../../../typechain/PluginSetupProcessor';
import {hashHelpers} from '../../../utils/psp';
import {expect} from '../../chai-setup';
import {deployNewDAO, ZERO_BYTES32} from '../../test-utils/dao';
import {deployENSSubdomainRegistrar} from '../../test-utils/ens';
import {deployPluginSetupProcessor} from '../../test-utils/plugin-setup-processor';
import {osxContractsVersion} from '../../test-utils/protocol-version';
import {
  installPlugin,
  updatePlugin,
  uninstallPlugin,
} from '../../test-utils/psp/atomic-helpers';
import {
  createPrepareInstallationParams,
  createApplyInstallationParams,
  createPrepareUninstallationParams,
  createApplyUninstallationParams,
  createPrepareUpdateParams,
  createApplyUpdateParams,
} from '../../test-utils/psp/create-params';
import {
  getAppliedSetupId,
  getPluginInstallationId,
  getPreparedSetupId,
} from '../../test-utils/psp/hash-helpers';
import {
  mockPermissionsOperations,
  mockHelpers,
} from '../../test-utils/psp/mock-helpers';
import {
  PluginRepoPointer,
  PreparationType,
  VersionTag,
} from '../../test-utils/psp/types';
import {PermissionOperation} from '../../test-utils/psp/types';
import {
  prepareInstallation,
  prepareUpdate,
  prepareUninstallation,
  applyInstallation,
  applyUpdate,
  applyUninstallation,
} from '../../test-utils/psp/wrappers';
import {
  deployPluginRepoFactory,
  deployPluginRepoRegistry,
} from '../../test-utils/repo';
import {findEvent, getNamedTypesFromMetadata} from '@aragon/osx-commons-sdk';
import {findEventTopicLog} from '@aragon/osx-commons-sdk';
import {Operation} from '@aragon/osx-commons-sdk';
import {
  DAO_PERMISSIONS,
  ENS_REGISTRAR_PERMISSIONS,
  PLUGIN_REGISTRY_PERMISSIONS,
  PLUGIN_SETUP_PROCESSOR_PERMISSIONS,
  PLUGIN_UUPS_UPGRADEABLE_PERMISSIONS,
} from '@aragon/osx-commons-sdk';
import {MultisigSetup} from '@aragon/osx-ethers-v1.2.0';
import {MockContract, smock} from '@defi-wonderland/smock';
import {anyValue} from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {BytesLike} from 'ethers';
import {getAddress, parseEther} from 'ethers/lib/utils';
import {ethers} from 'hardhat';

const EVENTS = {
  InstallationPrepared: 'InstallationPrepared',
  InstallationApplied: 'InstallationApplied',
  UpdatePrepared: 'UpdatePrepared',
  UpdateApplied: 'UpdateApplied',
  Upgraded: 'Upgraded',
  UninstallationPrepared: 'UninstallationPrepared',
  UninstallationApplied: 'UninstallationApplied',
  PluginRepoRegistered: 'PluginRepoRegistered',
  Granted: 'Granted',
  Revoked: 'Revoked',
};
const abiCoder = ethers.utils.defaultAbiCoder;

const EMPTY_DATA = '0x';

const ADDRESS_TWO = `0x${'00'.repeat(19)}02`;

describe.only('PluginSetupProcessor', function () {
  let signers: SignerWithAddress[];
  let psp: PluginSetupProcessor;
  let repoU: PluginRepo;
  let ownerAddress: string;
  let targetDao: DAO;
  let managingDao: DAO;
  let pluginRepoFactory: PluginRepoFactory;
  let pluginRepoRegistry: PluginRepoRegistry;

  let f: MultisigSetup__factory;

  let multisigPluginSetup: any;

  before(async () => {
    signers = await ethers.getSigners();
    ownerAddress = await signers[0].getAddress();

    // f = await ethers.deployContract("MultisigSetup")
    multisigPluginSetup = await ethers.deployContract('MultisigSetup');

    // Deploy yhe managing DAO having permission to manage `PluginSetupProcessor`
    managingDao = await deployNewDAO(signers[0]);

    // Deploy ENS subdomain Registry
    const ensSubdomainRegistrar = await deployENSSubdomainRegistrar(
      signers[0],
      managingDao,
      'dao.eth'
    );

    // Deploy Plugin Repo Registry
    pluginRepoRegistry = await deployPluginRepoRegistry(
      managingDao,
      ensSubdomainRegistrar,
      signers[0]
    );

    // Deploy Plugin Repo Factory
    pluginRepoFactory = await deployPluginRepoFactory(
      signers,
      pluginRepoRegistry
    );

    // Grant `PLUGIN_REGISTER_PERMISSION` to `PluginRepoFactory`.
    // await managingDao.grant(
    //   pluginRepoRegistry.address,
    //   pluginRepoFactory.address,
    //   PLUGIN_REGISTRY_PERMISSIONS.REGISTER_PLUGIN_REPO_PERMISSION_ID
    // );

    // // Grant `REGISTER_ENS_SUBDOMAIN_PERMISSION` to `PluginRepoFactory`.
    // await managingDao.grant(
    //   ensSubdomainRegistrar.address,
    //   pluginRepoRegistry.address,
    //   ENS_REGISTRAR_PERMISSIONS.REGISTER_ENS_SUBDOMAIN_PERMISSION_ID
    // );

    const releaseMetadata = '0x11';
    const buildMetadata = '0x11';

    // Plugin Setup Processor
    psp = await deployPluginSetupProcessor(pluginRepoRegistry);

    // Create and register a plugin on the PluginRepoRegistry
    let tx = await pluginRepoFactory.createPluginRepoWithFirstVersion(
      `multisig`,
      multisigPluginSetup.address, // build 1
      ownerAddress,
      releaseMetadata,
      buildMetadata
    );

    const PluginRepoRegisteredEvent1 =
      await findEventTopicLog<PluginRepoRegisteredEvent>(
        tx,
        PluginRepoRegistry__factory.createInterface(),
        EVENTS.PluginRepoRegistered
      );
    const PluginRepo = new PluginRepo__factory(signers[0]);
    repoU = PluginRepo.attach(PluginRepoRegisteredEvent1.args.pluginRepo);
  });

  // zodiac uses factory to deploy a contract where it stores
  // encoded conditions tree as its code. On localhost, this factory
  // is not deployed, so below deploys it.
  async function getSingletonFactory(signer: SignerWithAddress) {
    const factoryAddress = getAddress(
      '0xce0042b868300000d44a59004da54a005ffdcf9f'
    );
    const deployerAddress = getAddress(
      '0xBb6e024b9cFFACB947A71991E386681B1Cd1477D'
    );

    const provider = signer.provider;
    if (!provider) {
      return;
    }

    // check if singleton factory is deployed.
    if ((await provider.getCode(factoryAddress)) === '0x') {
      // fund the singleton factory deployer account
      await signer.sendTransaction({
        to: deployerAddress,
        value: parseEther('0.0247'),
      });

      // deploy the singleton factory
      await (
        await provider.sendTransaction(
          '0xf9016c8085174876e8008303c4d88080b90154608060405234801561001057600080fd5b50610134806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80634af63f0214602d575b600080fd5b60cf60048036036040811015604157600080fd5b810190602081018135640100000000811115605b57600080fd5b820183602082011115606c57600080fd5b80359060200191846001830284011164010000000083111715608d57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550509135925060eb915050565b604080516001600160a01b039092168252519081900360200190f35b6000818351602085016000f5939250505056fea26469706673582212206b44f8a82cb6b156bfcc3dc6aadd6df4eefd204bc928a4397fd15dacf6d5320564736f6c634300060200331b83247000822470'
        )
      )?.wait();

      if ((await provider.getCode(factoryAddress)) == '0x') {
        throw Error(
          'Singleton factory could not be deployed to correct address'
        );
      }
    }
  }

  describe.only('Installation', function () {
    beforeEach(async () => {
      // Grant necessary permission to `ownerAddress` so it can install plugins on behalf of the DAO.
      // await targetDao.grant(
      //   psp.address,
      //   ownerAddress,
      //   PLUGIN_SETUP_PROCESSOR_PERMISSIONS.APPLY_INSTALLATION_PERMISSION_ID
      // );
    });

    describe('applyInstallation', function () {
      it('successfully applies installation if setupId was prepared first by `prepareInstallation`', async () => {
        await getSingletonFactory(signers[0]);
        const tx = await psp.prepareInstallation(managingDao.address, {
          pluginSetupRef: {
            versionTag: {
              build: 1,
              release: 1,
            },
            pluginSetupRepo: repoU.address,
          },
          data: ethers.utils.defaultAbiCoder.encode(
            ['address[]', '(bool, uint16)'],
            [[ownerAddress], [true, 1]]
          ),
        });
        const preparedEvent = await findEvent<InstallationPreparedEvent>(
          tx,
          'InstallationPrepared'
        );

        await psp.applyInstallation(managingDao.address, {
          pluginSetupRef: {
            versionTag: {
              build: 1,
              release: 1,
            },
            pluginSetupRepo: repoU.address,
          },
          helpersHash: hashHelpers(
            preparedEvent.args.preparedSetupData.helpers
          ),
          permissions: preparedEvent.args.preparedSetupData.permissions,
          plugin: preparedEvent.args.plugin,
        });

        const multiSigFactory = new Multisig__factory(signers[0]);
        let multisigPlugin = multiSigFactory.attach(preparedEvent.args.plugin);

        let secAddress = await signers[1].getAddress();

        console.log(secAddress, ' ahaha');
        // adds 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 to the addAddresses
        await multisigPlugin.addAddresses([secAddress]);
      });
    });
  });
});
