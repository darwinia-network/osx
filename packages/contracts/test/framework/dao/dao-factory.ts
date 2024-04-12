import {
  DAORegistry,
  PluginSetupProcessor,
  PluginUUPSUpgradeableSetupV1Mock,
  PluginRepoRegistry,
  DAOFactory,
  DAOFactory__factory,
  PluginRepoFactory,
  PluginSetupProcessor__factory,
  DAO__factory,
  PluginRepo,
  PluginUUPSUpgradeableV1Mock__factory,
  PluginUUPSUpgradeableSetupV2Mock__factory,
  PluginUUPSUpgradeableSetupV1Mock__factory,
  DAORegistry__factory,
  PluginRepo__factory,
  IProtocolVersion__factory,
  IERC165__factory,
  PluginRepoRegistry__factory,
} from '../../../typechain';
import {DAORegisteredEvent} from '../../../typechain/DAORegistry';
import {PluginRepoRegisteredEvent} from '../../../typechain/PluginRepoRegistry';
import {InstallationPreparedEvent} from '../../../typechain/PluginSetupProcessor';
import {daoExampleURI, deployNewDAO} from '../../test-utils/dao';
import {deployENSSubdomainRegistrar} from '../../test-utils/ens';
import {deployPluginSetupProcessor} from '../../test-utils/plugin-setup-processor';
import {osxContractsVersion} from '../../test-utils/protocol-version';
import {deployWithProxy} from '../../test-utils/proxy';
import {createPrepareInstallationParams} from '../../test-utils/psp/create-params';
import {getAppliedSetupId} from '../../test-utils/psp/hash-helpers';
import {PluginRepoPointer} from '../../test-utils/psp/types';
import {
  deployPluginRepoFactory,
  deployPluginRepoRegistry,
} from '../../test-utils/repo';
import {
  findEventTopicLog,
  DAO_PERMISSIONS,
  DAO_REGISTRY_PERMISSIONS,
  PLUGIN_REGISTRY_PERMISSIONS,
  PLUGIN_SETUP_PROCESSOR_PERMISSIONS,
  getInterfaceId,
} from '@aragon/osx-commons-sdk';
import {PluginUUPSUpgradeableV2Mock__factory} from '@aragon/osx-ethers-v1.2.0';
import {anyValue} from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {expect} from 'chai';
import {ethers} from 'hardhat';

const EVENTS = {
  PluginRepoRegistered: 'PluginRepoRegistered',
  DAORegistered: 'DAORegistered',
  InstallationPrepared: 'InstallationPrepared',
  InstallationApplied: 'InstallationApplied',
  UpdateApplied: 'UpdateApplied',
  UninstallationApplied: 'UninstallationApplied',
  MetadataSet: 'MetadataSet',
  TrustedForwarderSet: 'TrustedForwarderSet',
  NewURI: 'NewURI',
  Revoked: 'Revoked',
  Granted: 'Granted',
};

const ALLOW_FLAG = '0x0000000000000000000000000000000000000002';
const daoDummySubdomain = 'dao1';
const registrarManagedDomain = 'dao.eth';
const daoDummyMetadata = '0x0000';
const EMPTY_DATA = '0x';
const AddressZero = ethers.constants.AddressZero;

async function extractInfoFromCreateDaoTx(tx: any): Promise<{
  dao: any;
  creator: any;
  subdomain: any;
  plugin: any;
  helpers: any;
  permissions: any;
}> {
  const daoRegisteredEvent = await findEventTopicLog<DAORegisteredEvent>(
    tx,
    DAORegistry__factory.createInterface(),
    EVENTS.DAORegistered
  );

  const installationPreparedEvent =
    await findEventTopicLog<InstallationPreparedEvent>(
      tx,
      PluginSetupProcessor__factory.createInterface(),
      EVENTS.InstallationPrepared
    );

  return {
    dao: daoRegisteredEvent.args.dao,
    creator: daoRegisteredEvent.args.creator,
    subdomain: daoRegisteredEvent.args.subdomain,
    plugin: installationPreparedEvent.args.plugin,
    helpers: installationPreparedEvent.args.preparedSetupData.helpers,
    permissions: installationPreparedEvent.args.preparedSetupData.permissions,
  };
}

async function getAnticipatedAddress(from: string) {
  let nonce = await ethers.provider.getTransactionCount(from);
  const anticipatedAddress = ethers.utils.getContractAddress({
    from: from,
    nonce,
  });
  return anticipatedAddress;
}

describe('DAOFactory: ', function () {
  let daoFactory: DAOFactory;
  let managingDao: any;

  let psp: PluginSetupProcessor;
  let pluginRepoRegistry: PluginRepoRegistry;

  let pluginSetupV1Mock: PluginUUPSUpgradeableSetupV1Mock;
  let pluginRepoMock: PluginRepo;
  let pluginSetupMockRepoAddress: any;

  let pluginRepoFactory: PluginRepoFactory;
  let daoRegistry: DAORegistry;
  let daoSettings: any;
  let pluginInstallationData: any;

  let signers: SignerWithAddress[];
  let ownerAddress: string;

  before(async () => {
    signers = await ethers.getSigners();
    ownerAddress = await signers[0].getAddress();
  });

  beforeEach(async function () {
    // Managing DAO
    managingDao = await deployNewDAO(signers[0]);

    // ENS subdomain Registry
    const ensSubdomainRegistrar = await deployENSSubdomainRegistrar(
      signers[0],
      managingDao,
      registrarManagedDomain
    );

    // DAO Registry
    const DAORegistry = new DAORegistry__factory(signers[0]);
    daoRegistry = await deployWithProxy(DAORegistry);
    await daoRegistry.initialize(
      managingDao.address,
      ensSubdomainRegistrar.address
    );

    // Plugin Repo Registry
    pluginRepoRegistry = await deployPluginRepoRegistry(
      managingDao,
      ensSubdomainRegistrar,
      signers[0]
    );

    // Plugin Setup Processor
    psp = await deployPluginSetupProcessor(pluginRepoRegistry);

    // Plugin Repo Factory
    pluginRepoFactory = await deployPluginRepoFactory(
      signers,
      pluginRepoRegistry
    );

    // Deploy DAO Factory
    const DAOFactory = new DAOFactory__factory(signers[0]);
    daoFactory = await DAOFactory.deploy(daoRegistry.address, psp.address);

    // Grant the `REGISTER_DAO_PERMISSION` permission to the `daoFactory`
    await managingDao.grant(
      daoRegistry.address,
      daoFactory.address,
      DAO_REGISTRY_PERMISSIONS.REGISTER_DAO_PERMISSION_ID
    );

    // Grant the `REGISTER_ENS_SUBDOMAIN_PERMISSION` permission on the ENS subdomain registrar to the DAO registry contract
    await managingDao.grant(
      ensSubdomainRegistrar.address,
      daoRegistry.address,
      DAO_REGISTRY_PERMISSIONS.ENS_REGISTRAR_PERMISSIONS
        .REGISTER_ENS_SUBDOMAIN_PERMISSION_ID
    );

    // Grant `PLUGIN_REGISTER_PERMISSION` to `pluginRepoFactory`.
    await managingDao.grant(
      pluginRepoRegistry.address,
      pluginRepoFactory.address,
      PLUGIN_REGISTRY_PERMISSIONS.REGISTER_PLUGIN_REPO_PERMISSION_ID
    );

    // Grant `REGISTER_ENS_SUBDOMAIN_PERMISSION` to `PluginRepoFactory`.
    await managingDao.grant(
      ensSubdomainRegistrar.address,
      pluginRepoRegistry.address,
      PLUGIN_REGISTRY_PERMISSIONS.ENS_REGISTRAR_PERMISSIONS
        .REGISTER_ENS_SUBDOMAIN_PERMISSION_ID
    );

    // Create and register a plugin on the `PluginRepoRegistry`.
    // PluginSetupV1
    const PluginUUPSUpgradeableSetupV1Mock =
      new PluginUUPSUpgradeableSetupV1Mock__factory(signers[0]);

    const implV1 = await new PluginUUPSUpgradeableV1Mock__factory(
      signers[0]
    ).deploy();
    pluginSetupV1Mock = await PluginUUPSUpgradeableSetupV1Mock.deploy(
      implV1.address
    );

    const tx = await pluginRepoFactory.createPluginRepoWithFirstVersion(
      'plugin-uupsupgradeable-setup-v1-mock',
      pluginSetupV1Mock.address,
      ownerAddress,
      '0x00',
      '0x00'
    );
    const event = await findEventTopicLog<PluginRepoRegisteredEvent>(
      tx,
      PluginRepoRegistry__factory.createInterface(),
      EVENTS.PluginRepoRegistered
    );
    pluginSetupMockRepoAddress = event.args.pluginRepo;

    pluginRepoMock = PluginRepo__factory.connect(
      pluginSetupMockRepoAddress,
      signers[0]
    );

    // default params
    daoSettings = {
      trustedForwarder: AddressZero,
      subdomain: daoDummySubdomain,
      metadata: daoDummyMetadata,
      daoURI: daoExampleURI,
    };

    const pluginRepoPointer: PluginRepoPointer = [
      pluginSetupMockRepoAddress,
      1,
      1,
    ];
    pluginInstallationData = createPrepareInstallationParams(
      pluginRepoPointer,
      EMPTY_DATA
    );
  });

  context('ERC-165', async () => {
    it('does not support the empty interface', async () => {
      expect(await daoFactory.supportsInterface('0xffffffff')).to.be.false;
    });

    it('supports the `IERC165` interface', async () => {
      const iface = IERC165__factory.createInterface();
      expect(await daoFactory.supportsInterface(getInterfaceId(iface))).to.be
        .true;
    });

    it('supports the `IProtocolVersion` interface', async () => {
      const iface = IProtocolVersion__factory.createInterface();
      expect(await daoFactory.supportsInterface(getInterfaceId(iface))).to.be
        .true;
    });
  });

  context('Protocol version', async () => {
    it('returns the current protocol version', async () => {
      expect(await daoFactory.protocolVersion()).to.deep.equal(
        osxContractsVersion()
      );
    });
  });

  it('reverts if no plugin is provided', async () => {
    await expect(
      daoFactory.createDao(daoSettings, [])
    ).to.be.revertedWithCustomError(daoFactory, 'NoPluginProvided');
  });

  it('creates a dao and initializes with correct args', async () => {
    const dao = await getAnticipatedAddress(daoFactory.address);

    const factory = new DAO__factory(signers[0]);
    const daoContract = factory.attach(dao);

    expect(await daoFactory.createDao(daoSettings, [pluginInstallationData]))
      .to.emit(daoContract, EVENTS.MetadataSet)
      .withArgs(daoSettings.metadata)
      .to.emit(daoContract, EVENTS.TrustedForwarderSet)
      .withArgs(daoSettings.trustedForwarder)
      .to.emit(daoContract, EVENTS.NewURI)
      .withArgs(daoSettings.daoURI);
  });

  it('creates a dao with a plugin and emits correct events', async () => {
    const expectedDao = await getAnticipatedAddress(daoFactory.address);
    const expectedPlugin = await getAnticipatedAddress(
      pluginSetupV1Mock.address
    );

    const {
      plugin,
      preparedSetupData: {permissions, helpers},
    } = await pluginSetupV1Mock.callStatic.prepareInstallation(
      expectedDao,
      pluginInstallationData.data
    );

    const tx = await daoFactory.createDao(daoSettings, [
      pluginInstallationData,
    ]);
    const {dao} = await extractInfoFromCreateDaoTx(tx);

    const pluginRepoPointer: PluginRepoPointer = [
      pluginSetupMockRepoAddress,
      1,
      1,
    ];

    expect(dao).to.equal(expectedDao);
    expect(plugin).to.equal(expectedPlugin);

    await expect(tx)
      .to.emit(daoRegistry, EVENTS.DAORegistered)
      .withArgs(dao, ownerAddress, daoSettings.subdomain)
      .to.emit(psp, EVENTS.InstallationPrepared)
      .withArgs(
        daoFactory.address,
        dao,
        anyValue,
        pluginSetupMockRepoAddress,
        (val: any) => expect(val).to.deep.equal([1, 1]),
        EMPTY_DATA,
        expectedPlugin,
        (val: any) => expect(val).to.deep.equal([helpers, permissions])
      )
      .to.emit(psp, EVENTS.InstallationApplied)
      .withArgs(
        dao,
        expectedPlugin,
        anyValue,
        getAppliedSetupId(pluginRepoPointer, helpers)
      );
  });

  it('creates a dao with a plugin and sets plugin permissions on dao correctly', async () => {
    const tx = await daoFactory.createDao(daoSettings, [
      pluginInstallationData,
    ]);
    const {dao, permissions} = await extractInfoFromCreateDaoTx(tx);

    const factory = new DAO__factory(signers[0]);
    const daoContract = factory.attach(dao);

    for (let i = 0; i < permissions.length; i++) {
      const permission = permissions[i];
      expect(
        await daoContract.hasPermission(
          permission.where,
          permission.who,
          permission.permissionId,
          EMPTY_DATA
        )
      ).to.equal(true);
    }
  });

  it('creates a dao and sets its own permissions correctly on itself', async () => {
    const tx = await daoFactory.createDao(daoSettings, [
      pluginInstallationData,
    ]);
    const {dao} = await extractInfoFromCreateDaoTx(tx);

    const factory = new DAO__factory(signers[0]);
    const daoContract = factory.attach(dao);

    await expect(tx)
      .to.emit(daoContract, EVENTS.Granted)
      .withArgs(
        DAO_PERMISSIONS.ROOT_PERMISSION_ID,
        daoFactory.address,
        dao,
        dao,
        ALLOW_FLAG
      )
      .to.emit(daoContract, EVENTS.Granted)
      .withArgs(
        DAO_PERMISSIONS.UPGRADE_DAO_PERMISSION_ID,
        daoFactory.address,
        dao,
        dao,
        ALLOW_FLAG
      )
      .to.emit(daoContract, EVENTS.Granted)
      .withArgs(
        DAO_PERMISSIONS.SET_TRUSTED_FORWARDER_PERMISSION_ID,
        daoFactory.address,
        dao,
        dao,
        ALLOW_FLAG
      )
      .to.emit(daoContract, EVENTS.Granted)
      .withArgs(
        DAO_PERMISSIONS.SET_METADATA_PERMISSION_ID,
        daoFactory.address,
        dao,
        dao,
        ALLOW_FLAG
      )
      .to.emit(daoContract, EVENTS.Granted)
      .withArgs(
        DAO_PERMISSIONS.REGISTER_STANDARD_CALLBACK_PERMISSION_ID,
        daoFactory.address,
        dao,
        dao,
        ALLOW_FLAG
      );
  });

  it('revokes all temporarly granted permissions', async () => {
    const tx = await daoFactory.createDao(daoSettings, [
      pluginInstallationData,
    ]);
    const {dao} = await extractInfoFromCreateDaoTx(tx);

    const factory = new DAO__factory(signers[0]);
    const daoContract = factory.attach(dao);

    // Check that events were emitted.
    await expect(tx)
      .to.emit(daoContract, EVENTS.Revoked)
      .withArgs(
        DAO_PERMISSIONS.ROOT_PERMISSION_ID,
        daoFactory.address,
        dao,
        psp.address
      );

    await expect(tx)
      .to.emit(daoContract, EVENTS.Revoked)
      .withArgs(
        PLUGIN_SETUP_PROCESSOR_PERMISSIONS.APPLY_INSTALLATION_PERMISSION_ID,
        daoFactory.address,
        psp.address,
        daoFactory.address
      );

    await expect(tx)
      .to.emit(daoContract, EVENTS.Revoked)
      .withArgs(
        DAO_PERMISSIONS.ROOT_PERMISSION_ID,
        daoFactory.address,
        dao,
        daoFactory.address
      );

    // Direct check to ensure since these permissions are extra dangerous to stay on.
    expect(
      await daoContract.hasPermission(
        dao,
        daoFactory.address,
        DAO_PERMISSIONS.ROOT_PERMISSION_ID,
        '0x'
      )
    ).to.be.false;
    expect(
      await daoContract.hasPermission(
        dao,
        psp.address,
        DAO_PERMISSIONS.ROOT_PERMISSION_ID,
        '0x'
      )
    ).to.be.false;

    expect(
      await daoContract.hasPermission(
        psp.address,
        daoFactory.address,
        PLUGIN_SETUP_PROCESSOR_PERMISSIONS.APPLY_INSTALLATION_PERMISSION_ID,
        '0x'
      )
    ).to.be.false;
  });

  it('creates a dao with multiple plugins installed', async () => {
    // add new plugin setup to the repo ! it will become build 2.
    await pluginRepoMock.createVersion(
      1,
      // We can use the same plugin setup as each time,
      // it returns the different plugin address, hence
      // wil generate unique/different plugin installation id.
      pluginSetupV1Mock.address,
      '0x11',
      '0x11'
    );

    const plugin1 = {...pluginInstallationData};

    const plugin2 = {...pluginInstallationData};
    plugin2.pluginSetupRef.versionTag = {
      release: 1,
      build: 2,
    };

    const plugins = [plugin1, plugin2];
    const tx = await daoFactory.createDao(daoSettings, plugins);

    // Count how often the event was emitted by inspecting the logs
    const receipt = await tx.wait();
    const topic = PluginSetupProcessor__factory.createInterface().getEventTopic(
      EVENTS.InstallationApplied
    );

    let installationAppliedEventCount = 0;
    receipt.logs.forEach(log => {
      if (log.topics[0] === topic) installationAppliedEventCount++;
    });

    expect(installationAppliedEventCount).to.equal(2);
  });
});
