import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MTLS_KEY = 'require_mtls';
export const RequireMtls = () => SetMetadata(REQUIRE_MTLS_KEY, true);
