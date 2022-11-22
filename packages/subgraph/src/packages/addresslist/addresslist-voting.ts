import {BigInt, dataSource, store} from '@graphprotocol/graph-ts';

import {
  VoteCast,
  VoteCreated,
  VoteExecuted,
  ConfigUpdated,
  UsersAdded,
  UsersRemoved,
  Addresslist
} from '../../../generated/templates/Addresslist/Addresslist';
import {
  Action,
  AddresslistPlugin,
  AddresslistProposal,
  AddresslistVoter,
  AddresslistVote
} from '../../../generated/schema';
import {TEN_POWER_16, VOTER_STATE} from '../../utils/constants';

export function handleVoteCreated(event: VoteCreated): void {
  let context = dataSource.context();
  let daoId = context.getString('daoAddress');
  let metdata = event.params.metadata.toString();
  _handleVoteCreated(event, daoId, metdata);
}

// work around: to bypass context and ipfs for testing, as they are not yet supported by matchstick
export function _handleVoteCreated(
  event: VoteCreated,
  daoId: string,
  metadata: string
): void {
  let proposalId =
    event.address.toHexString() + '_' + event.params.voteId.toHexString();

  let proposalEntity = new AddresslistProposal(proposalId);
  proposalEntity.dao = daoId;
  proposalEntity.plugin = event.address.toHexString();
  proposalEntity.voteId = event.params.voteId;
  proposalEntity.creator = event.params.creator;
  proposalEntity.metadata = metadata;
  proposalEntity.createdAt = event.block.timestamp;

  let contract = Addresslist.bind(event.address);
  let vote = contract.try_getVote(event.params.voteId);

  if (!vote.reverted) {
    proposalEntity.open = vote.value.value0;
    proposalEntity.executed = vote.value.value1;
    proposalEntity.startDate = vote.value.value2;
    proposalEntity.endDate = vote.value.value3;
    proposalEntity.snapshotBlock = vote.value.value4;
    proposalEntity.relativeSupportThresholdPct = vote.value.value5;
    proposalEntity.totalSupportThresholdPct = vote.value.value6;
    proposalEntity.census = vote.value.value7;

    // actions
    let actions = vote.value.value11;
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index];

      let actionId =
        event.address.toHexString() +
        '_' +
        event.params.voteId.toHexString() +
        '_' +
        index.toString();

      let actionEntity = new Action(actionId);
      actionEntity.to = action.to;
      actionEntity.value = action.value;
      actionEntity.data = action.data;
      actionEntity.dao = daoId;
      actionEntity.proposal = proposalId;
      actionEntity.save();
    }
  }

  proposalEntity.save();

  // update vote length
  let packageEntity = AddresslistPlugin.load(event.address.toHexString());
  if (packageEntity) {
    let voteLength = contract.try_votesLength();
    if (!voteLength.reverted) {
      packageEntity.votesLength = voteLength.value;
      packageEntity.save();
    }
  }
}

export function handleVoteCast(event: VoteCast): void {
  let proposalId =
    event.address.toHexString() + '_' + event.params.voteId.toHexString();
  let voterProposalId = event.params.voter.toHexString() + '_' + proposalId;
  let voterProposalEntity = AddresslistVote.load(voterProposalId);
  if (!voterProposalEntity) {
    voterProposalEntity = new AddresslistVote(voterProposalId);
    voterProposalEntity.voter = event.params.voter.toHexString();
    voterProposalEntity.proposal = proposalId;
  }
  voterProposalEntity.vote = VOTER_STATE.get(event.params.choice);
  voterProposalEntity.weight = event.params.voteWeight;
  voterProposalEntity.createdAt = event.block.timestamp;
  voterProposalEntity.save();

  // update count
  let proposalEntity = AddresslistProposal.load(proposalId);
  if (proposalEntity) {
    let contract = Addresslist.bind(event.address);
    let vote = contract.try_getVote(event.params.voteId);
    if (!vote.reverted) {
      let voteCount = vote.value.value8.plus(
        vote.value.value9.plus(vote.value.value10)
      );
      let yes = vote.value.value8;
      proposalEntity.yes = yes;
      proposalEntity.no = vote.value.value9;
      proposalEntity.abstain = vote.value.value10;
      proposalEntity.voteCount = voteCount;

      // check if the current vote results meet
      // the conditions for the proposal to pass:
      // - total support    :  N_yes / N_total >= total support threshold
      // - relative support :  N_yes / (N_yes + N_no) >= relative support threshold

      // expect a number between 0 and 100
      // where 0.35 => 35
      let currentParticipation = voteCount
        .times(BigInt.fromI32(100))
        .div(proposalEntity.census);
      // expect a number between 0 and 100
      // where 0.35 => 35
      let currentSupport = yes.times(BigInt.fromI32(100)).div(voteCount);
      // set the executable param
      proposalEntity.executable =
        currentParticipation.ge(
          proposalEntity.totalSupportThresholdPct.div(
            BigInt.fromString(TEN_POWER_16)
          )
        ) &&
        currentSupport.ge(
          proposalEntity.relativeSupportThresholdPct.div(
            BigInt.fromString(TEN_POWER_16)
          )
        );
      proposalEntity.save();
    }
  }
}

export function handleVoteExecuted(event: VoteExecuted): void {
  let proposalId =
    event.address.toHexString() + '_' + event.params.voteId.toHexString();
  let proposalEntity = AddresslistProposal.load(proposalId);
  if (proposalEntity) {
    proposalEntity.executed = true;
    proposalEntity.save();
  }

  // update actions
  let contract = Addresslist.bind(event.address);
  let vote = contract.try_getVote(event.params.voteId);
  if (!vote.reverted) {
    let actions = vote.value.value10;
    for (let index = 0; index < actions.length; index++) {
      let actionId =
        event.address.toHexString() +
        '_' +
        event.params.voteId.toHexString() +
        '_' +
        index.toString();

      let actionEntity = Action.load(actionId);
      if (actionEntity) {
        actionEntity.execResult = event.params.execResults[index];
        actionEntity.save();
      }
    }
  }
}

export function handleConfigUpdated(event: ConfigUpdated): void {
  let packageEntity = AddresslistPlugin.load(event.address.toHexString());
  if (packageEntity) {
    packageEntity.totalSupportThresholdPct =
      event.params.totalSupportThresholdPct;
    packageEntity.relativeSupportThresholdPct =
      event.params.relativeSupportThresholdPct;
    packageEntity.minDuration = event.params.minDuration;
    packageEntity.save();
  }
}

export function handleUsersAdded(event: UsersAdded): void {
  let users = event.params.users;
  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    let voterEntity = AddresslistVoter.load(user.toHexString());
    if (!voterEntity) {
      voterEntity = new AddresslistVoter(user.toHexString());
      voterEntity.address = user.toHexString();
      voterEntity.plugin = event.address.toHexString();
      voterEntity.save();
    }
  }
}

export function handleUsersRemoved(event: UsersRemoved): void {
  let users = event.params.users;
  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    let voterEntity = AddresslistVoter.load(user.toHexString());
    if (voterEntity) {
      store.remove('AddresslistVoter', user.toHexString());
    }
  }
}