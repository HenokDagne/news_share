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
