import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestContext } from '../../auth/session.service';

export const ReqContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const request = ctx.switchToHttp().getRequest();
    const forwarded = request.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.ip) || request.socket?.remoteAddress;
    const ua = request.headers['user-agent'];
    const strictPolicy = request.headers['x-strict-password-policy'] === 'true';
    return { ip, ua, strictPolicy };
  },
);
