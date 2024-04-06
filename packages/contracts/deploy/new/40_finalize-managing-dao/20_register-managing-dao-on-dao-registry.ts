import {
  DAO__factory,
  DAORegistry__factory,
  ENSRegistry__factory,
} from '../../../typechain';
import {
  getContractAddress,
  getENSAddress,
  isENSDomainRegistered,
  uploadToIPFS,
} from '../../helpers';
import MANAGING_DAO_METADATA from '../../management-dao-metadata.json';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {ethers, network} = hre;
  const [deployer] = await ethers.getSigners();

  // Get info from .env
  const daoSubdomain = process.env.MANAGINGDAO_SUBDOMAIN || '';
  const daoDomain =
    process.env[`${network.name.toUpperCase()}_DAO_ENS_DOMAIN`] || '';

  if (!daoSubdomain)
    throw new Error('ManagingDAO subdomain has not been set in .env');

  const node = ethers.utils.namehash(`${daoSubdomain}.${daoDomain}`);

  // Get `managingDAO` address.
  const managingDAOAddress = await getContractAddress('DAO', hre);

  // Get `DAORegistry` address.
  const daoRegistryAddress = await getContractAddress('DAORegistry', hre);

  // Get `DAORegistry` contract.
  const daoRegistryContract = DAORegistry__factory.connect(
    daoRegistryAddress,
    deployer
  );

  const ensRegistryContract = ENSRegistry__factory.connect(
    await getENSAddress(hre),
    deployer
  );
  let owner = await ensRegistryContract.owner(node);
  let daoENSSubdomainRegistrar = await getContractAddress(
    'DAO_ENSSubdomainRegistrar',
    hre
  );

  if (
    owner != daoENSSubdomainRegistrar &&
    owner != ethers.constants.AddressZero
  ) {
    throw new Error(
      `A DAO with ${daoSubdomain}.${daoDomain} is registered and owned by 
      someone other than ENSSubdomainRegistrar ${daoENSSubdomainRegistrar}.`
    );
  }

  if (owner === ethers.constants.AddressZero) {
    // Register `managingDAO` on `DAORegistry`.
    const registerTx = await daoRegistryContract.register(
      managingDAOAddress,
      deployer.address,
      daoSubdomain
    );
    await registerTx.wait();
    console.log(
      `Registered the (managingDAO: ${managingDAOAddress}) on (DAORegistry: ${daoRegistryAddress}), see (tx: ${registerTx.hash})`
    );
  }

  // Set Metadata for the Managing DAO
  const managingDaoContract = DAO__factory.connect(
    managingDAOAddress,
    deployer
  );
  const metadataCIDPath = await uploadToIPFS(
    JSON.stringify(MANAGING_DAO_METADATA),
    network.name
  );

  const hasMetadataPermission = await managingDaoContract.hasPermission(
    managingDaoContract.address,
    deployer.address,
    ethers.utils.id('SET_METADATA_PERMISSION'),
    '0x'
  );

  if (hasMetadataPermission) {
    const setMetadataTX = await managingDaoContract.setMetadata(
      ethers.utils.hexlify(
        ethers.utils.toUtf8Bytes(`ipfs://${metadataCIDPath}`)
      )
    );
    await setMetadataTX.wait();
  }
};
export default func;
func.tags = ['New', 'RegisterManagingDAO'];