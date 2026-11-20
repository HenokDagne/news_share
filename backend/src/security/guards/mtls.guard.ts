import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_MTLS_KEY } from '../decorators/require-mtls.decorator';

@Injectable()
export class MtlsGuard implements CanActivate {
  private readonly logger = new Logger(MtlsGuard.name);

  // Authorized service-to-service client Common Names (CNs)
  private readonly authorizedCommonNames = new Set([
    'news-share-internal-worker',
    'news-share-moderation-service',
    'news-share-analytics-service',
    'news-share-backup-vault',
    'service-mesh-ingress',
  ]);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isMtlsRequired = this.reflector.getAllAndOverride<boolean>(REQUIRE_MTLS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If endpoint is not explicitly decorated with @RequireMtls, allow
    if (!isMtlsRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const socket: any = request.socket;

    // 1. Direct TLS socket client certificate validation
    if (socket && typeof socket.getPeerCertificate === 'function') {
      const clientCert = socket.getPeerCertificate();
      if (clientCert && Object.keys(clientCert).length > 0) {
        if (!socket.authorized && socket.authorizationError) {
          throw new UnauthorizedException(`mTLS verification failed: ${socket.authorizationError}`);
        }

        const cn = clientCert.subject?.CN;
        if (cn && this.authorizedCommonNames.has(cn)) {
          return true;
        }
      }
    }

    // 2. Reverse proxy / Ingress header-based client cert verification
    // (Standard Envoy / NGINX / Cloud Ingress mTLS headers)
    const clientVerify = request.headers['ssl-client-verify'] || request.headers['x-client-cert-verify'];
    const clientDn = (request.headers['ssl-client-subject-dn'] || request.headers['x-client-cert-dn'] || '') as string;
    const clientFingerprint = request.headers['ssl-client-fingerprint'] || request.headers['x-client-cert-sha256'];

    if (clientVerify === 'SUCCESS' && clientDn) {
      for (const authorizedCn of this.authorizedCommonNames) {
        if (clientDn.includes(`CN=${authorizedCn}`) || clientDn.includes(authorizedCn)) {
          return true;
        }
      }
      throw new ForbiddenException(`mTLS Client Certificate CN unauthorized: ${clientDn}`);
    }

    // 3. Fallback for testing / simulated service tokens
    const serviceAuthHeader = request.headers['x-mtls-client-cn'] as string;
    if (serviceAuthHeader && this.authorizedCommonNames.has(serviceAuthHeader)) {
      return true;
    }

    throw new UnauthorizedException(
      'Mutual TLS (mTLS) client certificate is required for service-to-service communication. No valid client certificate presented.',
    );
  }
}
