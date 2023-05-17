import {ContractTransaction} from 'ethers';
import {Interface, LogDescription} from 'ethers/lib/utils';

export async function findEvent<T>(tx: ContractTransaction, eventName: string) {
  const receipt = await tx.wait();
  const event = (receipt.events || []).find(event => event.event === eventName);

  if (!event) {
    throw new Error(`Event ${eventName} not found in TX.`);
  }

  return event as T;
}

export async function findEventTopicLog(
  tx: ContractTransaction,
  iface: Interface,
  eventName: string
): Promise<LogDescription> {
  const receipt = await tx.wait();
  const topic = iface.getEventTopic(eventName);
  const log = receipt.logs.find(x => x.topics[0] === topic);
  if (!log) {
    throw new Error(`No logs found for this event ${eventName} topic.`);
  }
  return iface.parseLog(log);
}

export async function filterEvents(tx: any, eventName: string) {
  const {events} = await tx.wait();
  const event = events.filter(({event}: {event: any}) => event === eventName);

  return event;
}

export const PROPOSAL_EVENTS = {
  PROPOSAL_CREATED: 'ProposalCreated',
  PROPOSAL_EXECUTED: 'ProposalExecuted',
};

export const VOTING_EVENTS = {
  VOTING_SETTINGS_UPDATED: 'VotingSettingsUpdated',
  VOTE_CAST: 'VoteCast',
};

export const MULTISIG_EVENTS = {
  MULTISIG_SETTINGS_UPDATED: 'MultisigSettingsUpdated',
  APPROVED: 'Approved',
};

export const DAO_EVENTS = {
  METADATA_SET: 'MetadataSet',
  EXECUTED: 'Executed',
  DEPOSITED: 'Deposited',
  STANDARD_CALLBACK_REGISTERED: 'StandardCallbackRegistered',
  TRUSTED_FORWARDER_SET: 'TrustedForwarderSet',
  SIGNATURE_VALIDATOR_SET: 'SignatureValidatorSet',
  NEW_URI: 'NewURI',
};

export const MEMBERSHIP_EVENTS = {
  MEMBERS_ADDED: 'MembersAdded',
  MEMBERS_REMOVED: 'MembersRemoved',
  MEMBERSHIP_CONTRACT_ANNOUNCED: 'MembershipContractAnnounced',
};
