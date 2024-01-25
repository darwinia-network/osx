import {TokenVotingMember} from '../../../generated/schema';
import {GovernanceERC20 as GovernanceERC20Contract} from '../../../generated/templates/GovernanceERC20/GovernanceERC20';
import {
  DelegateChanged,
  DelegateVotesChanged,
} from '../../../generated/templates/GovernanceERC20/GovernanceERC20';
import {Transfer} from '../../../generated/templates/TokenVoting/ERC20';
import {Address, BigInt, log, store} from '@graphprotocol/graph-ts';

function getOrCreateMember(user: Address, tokenId: string): TokenVotingMember {
  let id = [user.toHexString(), tokenId].join('_');
  let member = TokenVotingMember.load(id);
  if (!member) {
    member = new TokenVotingMember(id);
    member.address = user;
    member.balance = BigInt.zero();
    member.token = tokenId;

    member.delegatee = null;
    member.votingPower = BigInt.zero();
  }

  return member;
}

export function handleTransfer(event: Transfer): void {
  let tokenId = event.address.toHexString();

  if (tokenId == '0x4807064ac0173402024f7f8d19dee710d360aff6') {
    log.warning(
      'TokenVoting: handleTransfer: tokenId is 0x4807064ac0173402024f7f8d19dee710d360aff6',
      []
    );
    log.warning('TokenVoting: handleTransfer: event.params.from is {}', [
      event.params.from.toHexString(),
    ]);
    log.warning('TokenVoting: handleTransfer: event.params.to is {}', [
      event.params.to.toHexString(),
    ]);
    log.warning('TokenVoting: handleTransfer: event.params.value is {}', [
      event.params.value.toString(),
    ]);
  }

  if (event.params.from != Address.zero()) {
<<<<<<< Updated upstream
    let fromMember = getOrCreateMember(event.params.from, pluginId);
    // fromMember.balance = fromMember.balance.minus(event.params.value);
    const governanceERC20Contract = GovernanceERC20Contract.bind(event.address);
    const balance = governanceERC20Contract.try_balanceOf(event.params.from);
    if (!balance.reverted) {
      fromMember.balance = balance.value;
    }
=======
    let fromMember = getOrCreateMember(event.params.from, tokenId);
    fromMember.balance = fromMember.balance.minus(event.params.value);
>>>>>>> Stashed changes
    fromMember.save();
  }

  if (event.params.to != Address.zero()) {
<<<<<<< Updated upstream
    let toMember = getOrCreateMember(event.params.to, pluginId);
    // toMember.balance = toMember.balance.plus(event.params.value);
    const governanceERC20Contract = GovernanceERC20Contract.bind(event.address);
    const balance = governanceERC20Contract.try_balanceOf(event.params.from);
    if (!balance.reverted) {
      toMember.balance = balance.value;
    }
=======
    let toMember = getOrCreateMember(event.params.to, tokenId);
    toMember.balance = toMember.balance.plus(event.params.value);
>>>>>>> Stashed changes
    toMember.save();
  }
}

export function handleDelegateChanged(event: DelegateChanged): void {
  let tokenId = event.address.toHexString();
  const toDelegate = event.params.toDelegate;

  // make sure `fromDelegate` &  `toDelegate`are members
  if (event.params.fromDelegate != Address.zero()) {
    let fromMember = getOrCreateMember(event.params.fromDelegate, tokenId);
    fromMember.save();
  }
  if (toDelegate != Address.zero()) {
    let toMember = getOrCreateMember(toDelegate, tokenId);
    toMember.save();
  }

  // make sure `delegator` is member and set delegatee
  if (event.params.delegator != Address.zero()) {
    let delegator = getOrCreateMember(event.params.delegator, tokenId);

    // set delegatee
    let delegatee: string | null = null;
    if (toDelegate != Address.zero()) {
      delegatee = [toDelegate.toHexString(), tokenId].join('_');

      delegator.delegatee = delegatee;
    }

    delegator.save();
  }
}

export function handleDelegateVotesChanged(event: DelegateVotesChanged): void {
  const delegate = event.params.delegate;
  let tokenId = event.address.toHexString();

  if (delegate == Address.zero()) return;
  const newVotingPower = event.params.newBalance;

  let member = getOrCreateMember(delegate, tokenId);

  if (isZeroBalanceAndVotingPower(member.balance, newVotingPower)) {
    if (shouldRemoveMember(event.address, delegate)) {
      store.remove('TokenVotingMember', member.id);
      return;
    }
  }
  member.votingPower = newVotingPower;
  member.save();
}

function isZeroBalanceAndVotingPower(
  memberBalance: BigInt,
  votingPower: BigInt
): boolean {
  return (
    memberBalance.equals(BigInt.zero()) && votingPower.equals(BigInt.zero())
  );
}

function shouldRemoveMember(
  contractAddress: Address,
  delegate: Address
): boolean {
  const governanceERC20Contract = GovernanceERC20Contract.bind(contractAddress);
  const delegates = governanceERC20Contract.try_delegates(delegate);
  if (!delegates.reverted) {
    return delegates.value == delegate || delegates.value == Address.zero();
  }
  return false;
}
