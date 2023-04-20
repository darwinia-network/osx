import {expect} from 'chai';
import {ethers} from 'hardhat';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';

import {
  PluginSetupProcessor,
  PluginCloneableSetupV1MockBad2,
  PluginRepoFactory,
  PluginRepoRegistry,
  PluginRepo,
  DAO,
  PluginCloneableSetupV1MockBad2__factory,
} from '../../../typechain';

import {deployENSSubdomainRegistrar} from '../../test-utils/ens';
import {deployNewDAO} from '../../test-utils/dao';
import {deployPluginSetupProcessor} from '../../test-utils/plugin-setup-processor';
import {findEvent} from '../../../utils/event';

import {
  prepareInstallation,
  applyInstallation,
} from '../../test-utils/psp/wrappers';
import {createPrepareInstallationParams} from '../../test-utils/psp/create-params';

import {
  deployPluginRepoFactory,
  deployPluginRepoRegistry,
} from '../../test-utils/repo';

import {PluginRepoPointer} from '../../test-utils/psp/types';
import {PermissionOperation} from '../../test-utils/psp/types';

import {MockContract, smock} from '@defi-wonderland/smock';
import {installPlugin} from '../../test-utils/psp/atomic-helpers';

import {PluginRepoRegisteredEvent} from '../../../typechain/PluginRepoRegistry';

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

const EMPTY_DATA = '0x';

const ROOT_PERMISSION_ID = ethers.utils.id('ROOT_PERMISSION');
const APPLY_INSTALLATION_PERMISSION_ID = ethers.utils.id(
  'APPLY_INSTALLATION_PERMISSION'
);

const REGISTER_PLUGIN_REPO_PERMISSION_ID = ethers.utils.id(
  'REGISTER_PLUGIN_REPO_PERMISSION'
);

const REGISTER_ENS_SUBDOMAIN_PERMISSION_ID = ethers.utils.id(
  'REGISTER_ENS_SUBDOMAIN_PERMISSION'
);

describe('Plugin Instance Reuse', function () {
  let signers: SignerWithAddress[];
  let psp: PluginSetupProcessor;
  let repo: PluginRepo;
  let badSetup: MockContract<PluginCloneableSetupV1MockBad2>;
  let ownerAddress: string;
  let targetDao1: DAO;
  let targetDao2: DAO;
  let managingDao: DAO;
  let pluginRepoFactory: PluginRepoFactory;
  let pluginRepoRegistry: PluginRepoRegistry;

  before(async () => {
    signers = await ethers.getSigners();
    ownerAddress = await signers[0].getAddress();

    // Deploy PluginUUPSUpgradeableSetupMock

    const BadSetup = await smock.mock<PluginCloneableSetupV1MockBad2__factory>(
      'PluginCloneableSetupV1MockBad2'
    );
    badSetup = await BadSetup.deploy();

    // Deploy the managing DAO having permission to manage `PluginSetupProcessor`
    managingDao = await deployNewDAO(ownerAddress);

    // Deploy ENS subdomain Registry
    const ensSubdomainRegistrar = await deployENSSubdomainRegistrar(
      signers[0],
      managingDao,
      'dao.eth'
    );

    // Deploy Plugin Repo Registry
    pluginRepoRegistry = await deployPluginRepoRegistry(
      managingDao,
      ensSubdomainRegistrar
    );

    // Deploy Plugin Repo Factory
    pluginRepoFactory = await deployPluginRepoFactory(
      signers,
      pluginRepoRegistry
    );

    // Grant `PLUGIN_REGISTER_PERMISSION` to `PluginRepoFactory`.
    await managingDao.grant(
      pluginRepoRegistry.address,
      pluginRepoFactory.address,
      REGISTER_PLUGIN_REPO_PERMISSION_ID
    );

    // Grant `REGISTER_ENS_SUBDOMAIN_PERMISSION` to `PluginRepoFactory`.
    await managingDao.grant(
      ensSubdomainRegistrar.address,
      pluginRepoRegistry.address,
      REGISTER_ENS_SUBDOMAIN_PERMISSION_ID
    );

    const releaseMetadata = '0x11';
    const buildMetadata = '0x11';

    // Plugin Setup Processor
    psp = await deployPluginSetupProcessor(pluginRepoRegistry);

    // Create and register a plugin on the PluginRepoRegistry
    let tx = await pluginRepoFactory.createPluginRepoWithFirstVersion(
      `plugin-uups-upgradeable-mock`,
      badSetup.address,
      ownerAddress,
      releaseMetadata,
      buildMetadata
    );

    let event = await findEvent<PluginRepoRegisteredEvent>(
      tx,
      EVENTS.PluginRepoRegistered
    );
    const PluginRepo = await ethers.getContractFactory('PluginRepo');
    repo = PluginRepo.attach(event.args.pluginRepo);

    // Add setups
    tx = await pluginRepoFactory.createPluginRepoWithFirstVersion(
      `plugin-clonable-mock`,
      badSetup.address,
      ownerAddress,
      releaseMetadata,
      buildMetadata
    );

    event = await findEvent<PluginRepoRegisteredEvent>(
      tx,
      EVENTS.PluginRepoRegistered
    );
    repo = PluginRepo.attach(event.args.pluginRepo);
  });

  beforeEach(async function () {
    // Target DAO to be used as an example DAO
    targetDao1 = await deployNewDAO(ownerAddress);
    targetDao2 = await deployNewDAO(ownerAddress);

    // Grant
    await targetDao1.grant(targetDao1.address, psp.address, ROOT_PERMISSION_ID);
    await targetDao2.grant(targetDao2.address, psp.address, ROOT_PERMISSION_ID);
  });

  describe('Installation', function () {
    beforeEach(async () => {
      // Grant necessary permission to `ownerAddress` so it can install plugins on behalf of the DAO.
      await targetDao1.grant(
        psp.address,
        ownerAddress,
        APPLY_INSTALLATION_PERMISSION_ID
      );
      await targetDao2.grant(
        psp.address,
        ownerAddress,
        APPLY_INSTALLATION_PERMISSION_ID
      );
    });

    describe('prepareInstallation', function () {
      it('reverts if a plugin with the same address is installed in multiple DAOs.', async () => {
        const pluginRepoPointer: PluginRepoPointer = [repo.address, 1, 1];

        // Install plugin for targetDao1
        await installPlugin(
          psp,
          targetDao1.address,
          pluginRepoPointer,
          EMPTY_DATA
        );

        // Make sure you cannot install another instance
        await expect(
          psp.prepareInstallation(
            targetDao1.address,
            createPrepareInstallationParams(pluginRepoPointer, '0x')
          )
        ).to.be.revertedWithCustomError(psp, 'PluginAlreadyInstalled');

        // Install plugin for targetDao2
        let plugin: string;
        let helpers: string[];
        let permissions: PermissionOperation[];
        let preparedSetupId: string;
        ({
          plugin: plugin,
          preparedSetupData: {helpers, permissions},
          preparedSetupId: preparedSetupId,
        } = await prepareInstallation(
          psp,
          targetDao2.address,
          pluginRepoPointer,
          EMPTY_DATA
        ));

        // Check if it reverts
        await expect(
          applyInstallation(
            psp,
            targetDao2.address,
            plugin,
            pluginRepoPointer,
            permissions,
            helpers
          )
        ).to.be.reverted;
      });
    });
  });
});
