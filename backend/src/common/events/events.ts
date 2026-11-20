export const EVENTS = {
  USER_FOLLOWED: 'user.followed',
  POST_CREATED: 'post.created',
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
