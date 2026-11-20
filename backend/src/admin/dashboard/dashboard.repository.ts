import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const TABLE_TIME_COLUMN = {
  users: 'created_at',
  posts: 'created_at',
  report_cases: 'first_reported_at',
  moderation_actions: 'created_at',
} as const;

export type DashboardTable = keyof typeof TABLE_TIME_COLUMN;

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a continuous daily zero-filled timeseries using PostgreSQL generate_series.
   * Parameterized and safe from SQL injection via allow-listed table/column mapping.
   */
  async dailyCounts(
    table: DashboardTable,
    from: Date,
    to: Date,
  ): Promise<{ day: string; value: number }[]> {
    const colName = TABLE_TIME_COLUMN[table];
    const colIdentifier = Prisma.raw(`"${colName}"`);
    const tableIdentifier = Prisma.raw(`"${table}"`);

    const result = await this.prisma.$queryRaw<{ day: Date; value: number }[]>(Prisma.sql`
      SELECT d::date AS day, COALESCE(c.n, 0)::int AS value
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS d
      LEFT JOIN (
        SELECT date_trunc('day', ${colIdentifier})::date AS day, count(*)::int AS n
        FROM ${tableIdentifier}
        WHERE ${colIdentifier} >= ${from} AND ${colIdentifier} < ${to}::date + interval '1 day'
        GROUP BY 1
      ) c ON c.day = d::date
      ORDER BY 1 ASC
    `);

    return result.map((r) => ({
      day: r.day instanceof Date ? r.day.toISOString().split('T')[0] : String(r.day),
      value: Number(r.value) || 0,
    }));
  }
}
