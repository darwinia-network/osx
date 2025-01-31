import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Concluding ENS deployment.\n`);

  const {deployments} = hre;

  try {
    const ensRegistry = await deployments.get('ENSRegistry');
    if (ensRegistry) {
      hre.aragonToVerifyContracts.push(ensRegistry);
    }
  } catch (e) {
    console.log(`No deployment for ENSRegistry found`);
  }

  try {
    const publicResolver = await deployments.get('PublicResolver');
    if (publicResolver) {
      hre.aragonToVerifyContracts.push(publicResolver);
    }
  } catch (e) {
    console.log(`No deployment for PublicResolver found`);
  }

  hre.aragonToVerifyContracts.push(
    await deployments.get('DAO_ENSSubdomainRegistrar')
  );

  let de = await deployments.get('DAO_ENSSubdomainRegistrar_Implementation');
  de.contract = 'src/framework/utils/ens/ENSSubdomainRegistrar.sol:ENSSubdomainRegistrar';
  hre.aragonToVerifyContracts.push(de);

  hre.aragonToVerifyContracts.push(
    await deployments.get('Plugin_ENSSubdomainRegistrar')
  );

  let pe = await deployments.get('Plugin_ENSSubdomainRegistrar_Implementation');
  pe.contract = 'src/framework/utils/ens/ENSSubdomainRegistrar.sol:ENSSubdomainRegistrar';
  hre.aragonToVerifyContracts.push(pe);
  hre.aragonToVerifyContracts.push(pe);
};

export default func;
func.tags = [
  'New',
  'ENSRegistry',
  'ENSSubdomains',
  'ENSSubdomainRegistrars',
  'Verify',
];
