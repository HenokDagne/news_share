import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export const ApiPaginatedResponse = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          nextCursor: {
            type: 'string',
            nullable: true,
            example: '5c1f3a2e-9d4b-4f2b-8f0e-2f3c9b1a7d10',
          },
          hasMore: {
            type: 'boolean',
            example: true,
          },
        },
      },
    }),
  );
};
