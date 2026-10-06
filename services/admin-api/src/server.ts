import http from 'http';
import { AdminApiService } from './service';

export function createAdminApiServer(port = 8081): {
  server: http.Server;
  service: AdminApiService;
  start: () => Promise<number>;
  stop: () => Promise<void>;
} {
  const service = new AdminApiService();

  const server = http.createServer(async (req, res) => {
    // Enable CORS for isolated Admin app
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    const readBody = (): Promise<any> => {
      return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch {
            resolve({});
          }
        });
      });
    };

    const sendJson = (status: number, data: any) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const ipAddress = req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
      // 1. Health
      if (pathname === '/health' && req.method === 'GET') {
        return sendJson(200, { status: 'healthy', service: 'admin-api' });
      }

      // 2. Hardware Auth Challenge
      if (pathname === '/admin/v1/auth/challenge' && req.method === 'POST') {
        const body = await readBody();
        const admin = service.getAdminByEmail(body.email);
        if (!admin) {
          return sendJson(404, { error: 'Admin user not found' });
        }
        const challenge = service.generateHardwareChallenge(admin.id);
        return sendJson(200, { adminId: admin.id, ...challenge });
      }

      // 3. Hardware Auth Verify
      if (pathname === '/admin/v1/auth/verify' && req.method === 'POST') {
        const body = await readBody();
        const clientDataJSON = Buffer.from(
          JSON.stringify({ type: 'webauthn.get', challenge: body.challenge })
        ).toString('base64url');

        const result = service.verifyHardwareLogin(
          body.adminId,
          body.credentialId,
          clientDataJSON,
          ipAddress,
          userAgent
        );
        return sendJson(200, {
          token: result.rawToken,
          admin: {
            id: result.admin.id,
            email: result.admin.email,
            fullName: result.admin.fullName,
            role: result.admin.roleName,
            permissions: result.admin.permissions,
          },
        });
      }

      // 4. List Pending Approvals
      if (pathname === '/admin/v1/approvals/pending' && req.method === 'GET') {
        const pending = service.approvals.listPendingRequests();
        return sendJson(200, { requests: pending });
      }

      // 5. Create Approval Request (Maker)
      if (pathname === '/admin/v1/approvals/create' && req.method === 'POST') {
        const body = await readBody();
        const admin = service.getAdmin(body.requesterAdminId);
        if (!admin) {
          return sendJson(403, { error: 'Requester admin not authorized' });
        }
        const request = service.initiateApprovalRequest(
          admin,
          body.actionType,
          body.entityId,
          body.reason,
          body.payload || {},
          ipAddress,
          userAgent
        );
        return sendJson(201, { request });
      }

      // 6. Execute Approval Decision (Checker)
      const decisionMatch = pathname.match(/^\/admin\/v1\/approvals\/([^/]+)\/decision$/);
      if (decisionMatch && req.method === 'POST') {
        const requestId = decisionMatch[1]!;
        const body = await readBody();
        const checkerAdmin = service.getAdmin(body.checkerAdminId);
        if (!checkerAdmin) {
          return sendJson(403, { error: 'Checker admin not authorized' });
        }
        const outcome = service.executeApprovalDecision(
          checkerAdmin,
          requestId,
          body.decision,
          body.notes,
          ipAddress,
          userAgent
        );
        return sendJson(200, outcome);
      }

      // 7. Audit Events List
      if (pathname === '/admin/v1/audit/events' && req.method === 'GET') {
        const events = service.auditChain.getEvents(50);
        return sendJson(200, { events });
      }

      // 8. Cryptographic Audit Chain Verification
      if (pathname === '/admin/v1/audit/verify-chain' && req.method === 'GET') {
        const verification = service.auditChain.verifyChain();
        return sendJson(200, verification);
      }

      return sendJson(404, { error: 'Endpoint not found' });
    } catch (err: any) {
      return sendJson(400, { error: err.message || 'Server error' });
    }
  });

  return {
    server,
    service,
    start: () =>
      new Promise((resolve) => {
        server.listen(port, () => resolve(port));
      }),
    stop: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}
