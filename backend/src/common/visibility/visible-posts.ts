import { PostStatus, Prisma, UserStatus } from '@prisma/client';

/**
 * Filter for posts anyone in good standing may see.
 * Excludes soft-removed posts and posts whose authors are suspended, banned, or deleted.
 */
export const publicPostsWhere = (): Prisma.PostWhereInput => ({
  status: PostStatus.ACTIVE,
  author: {
    user: {
      status: UserStatus.ACTIVE,
    },
  },
});

/**
 * Filter for Feed, Timeline, and Search.
 * Additionally excludes posts the current viewer marked as "Not Interested".
 */
export const feedPostsWhere = (me: string): Prisma.PostWhereInput => ({
  ...publicPostsWhere(),
  notInterestedBy: {
    none: {
      userId: me,
    },
  },
});
