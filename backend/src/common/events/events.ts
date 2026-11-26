export const EVENTS = {
  USER_FOLLOWED: 'user.followed',
  POST_CREATED: 'post.created',
  USER_REGISTERED: 'user.registered',
  REPORT_CREATED: 'report.created',
  CASE_UPDATED: 'case.updated',
  MODERATION_ACTION: 'moderation.action',
  RESTRICTION_APPLIED: 'restriction.applied',
  RESTRICTION_LIFTED: 'restriction.lifted',
  ADMIN_ACTION: 'admin.action',
  SESSION_REVOKED: 'session.revoked',
  ACTIVITY_CREATED: 'activity.created',
  DIRECT_MESSAGE_CREATED: 'dm.message.created',
  DIRECT_MESSAGE_READ: 'dm.message.read',
  DIRECT_MESSAGE_EDITED: 'dm.message.edited',
  DIRECT_MESSAGE_DELETED: 'dm.message.deleted',
  DIRECT_MESSAGE_DELIVERED: 'dm.message.delivered',
  TYPING_START: 'dm.typing.start',
  TYPING_STOP: 'dm.typing.stop',
  USER_ONLINE: 'user.online',
  USER_OFFLINE: 'user.offline',
} as const;

export class UserFollowedEvent {
  constructor(
    public readonly followerId: string,
    public readonly followingId: string,
  ) {}
}

export class PostCreatedEvent {
  constructor(
    public readonly postId: string,
    public readonly authorId: string,
  ) {}
}
